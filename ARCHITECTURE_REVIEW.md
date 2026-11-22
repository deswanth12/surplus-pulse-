# SurplusPulse: Architecture Review (Stage 4)

Scope: architecture, security, and data-integrity findings from static reading of the repository. No application code was changed. No finding in this document is marked fixed.

This document is not a production-readiness or security certification. Several findings below are CONFIRMED by reading code; others are SUSPECTED because they were not run or not fully read.

Status legend:
- **CONFIRMED** = read in code.
- **SUSPECTED** = not run, or not fully read.

Host OS: Windows. Paths use backslashes where they are relative to the repo.

## Baseline (already run, not re-run for this document)

- Backend pytest: 187 passed, 0 failed.
- Frontend Vitest: 146 passed (15 files).
- `npm run build`: succeeded.
- Total: 333 tests passing.
- Tests use a temporary database. The live `backend\surpluspulse.db` hash was unchanged after the test run.

---

## 1. Stack and layout

- **Backend:** FastAPI with Pydantic v2 and SQLite (WAL mode) in `backend\app`.
- **Routing:** `main.py` mounts ten routers under `/api`: directory, dispatch, impact, inspection, listings, matches, portals, seed, tax, telemetry.
- **Frontend:** React 18 + TypeScript + Vite + GSAP in `frontend\src`.
- **Navigation:** state-based in `App.tsx`. There is no router library.
- **API client:** `services\api.ts`.
- **Tests:** pytest in `backend\tests`; Vitest in `frontend\src\test`.

## 2. Feature inventory per portal and modal

Derived from the register and the workflow trace. This is not an exhaustive UI component listing.

- **Donor portal:** create food listing; run food inspection (Mirage); view donor record; 80G certificate view (GET triggers a write, see S9); Form 68-A (UI labels and a "TRANSMITTED" toast only, see S19).
- **Courier portal:** view available listings; claim listing (dispatch); mark collected; confirm delivery; dispatch trigger status (see S17); contact links built from donor and shelter phone numbers (see S8).
- **Shelter portal:** view incoming deliveries; view shelter contact data (see S8); fallback temperature display (see S16). No accept or reject step exists.
- **Directory and impact views:** donor and receiver directory (see S8); impact figures, including a "133 KG" fallback (see S16).
- **Matches:** read-only matching of listings to receivers.
- **Modals and toasts:** "HYGIENE VERIFIED" toast for a simulated scan (see S16); "TRANSMITTED" toast for Form 68-A (see S19); tax verification display (see S3).

## 3. Backend dependency map

- `app\auth.py` is imported by every router that uses `require_auth` (listings, dispatch, inspection, telemetry, and others). Auth changes affect all of them.
- `tax` is used by `portals` (portals call `get_or_create_80g_certificate` in `tax.py:83`).
- `mirage_inspector.py` is used by the inspection router and by listing flows. Its results are cached in process memory only.
- `config.py` feeds `auth.py` (environment mode, see S1) and `mirage_inspector.py` (intended kill switch, see S13). Both fields are dead for Mirage (see S13).
- `database.py` holds the DDL for all tables. There is no migration layer.

## 4. Frontend component map

- `App.tsx`: state-based navigation between portals and modals.
- `services\api.ts`: single API client. It sends no `X-API-Key` or `Authorization` header anywhere in `frontend\src` (see S11).
- Portal components: donor, courier, shelter. `ShelterPortal.tsx` contains the fallback temperature constant (see S16).
- Full component-to-component graph was not enumerated in this pass.

## 5. Database tables

Tables from the DDL in `database.py`:

- **receivers**: shelters and recipient records.
- **donors**: donor records. Full columns were NOT re-read in this pass. Donor PAN and address are exposed by the unauthenticated portal GET (see S8).
- **food_listings**: has `donor_id`. `status` has no CHECK constraint; default is `POSTED` (see S12).
- **pickups**: `UNIQUE(listing_id)`. This is a positive finding.
- **tax_certificates**: `certificate_number UNIQUE`.
- **shelter_intakes**: has no UNIQUE on `listing_id` (`database.py` ~139-150) and no CHECK on `intake_temp_c` (see S7, S12).

Important: the live database schema was NOT dumped. The schema above reflects the DDL in `database.py`, not the live file.

## 6. API endpoint inventory with auth status

This table covers the routes named in the register. It is not a complete enumeration of every route.

| Area | Route | Auth status | Finding |
|---|---|---|---|
| listings | create, claim, status | `require_auth` (dev bypass in non-production) | S1, S5 |
| dispatch | POST dispatch | `require_auth` (dev bypass in non-production) | S1 |
| dispatch | GET dispatch-trigger | unauthenticated; response lacks declared fields | S17 |
| inspection | inspect-food | `require_auth` (dev bypass in non-production) | S1, S4 |
| telemetry | confirm-delivery | `require_auth` (dev bypass in non-production) | S1, S6, S7 |
| seed | POST /api/seed | no auth dependency | S2 |
| tax | verify endpoint | no route-level auth verified; returns fixed result | S3 |
| tax | certificate read path (via portals and tax) | GET triggers write | S9 |
| portals | donor GET | unauthenticated; exposes personal fields | S8 |
| portals | courier GET | unauthenticated; exposes donor and phone-link data | S8 |
| portals | shelter GET | unauthenticated; exposes contact data | S8 |
| directory | directory.py:20, :41 | unauthenticated; exposes donor and receiver data | S8 |
| all id-keyed portal routes | by id | no owner check verified | S10 (SUSPECTED per route) |

Authentication model overall: one shared static key, accepted as `X-API-Key` or `Bearer`. No user table, no credential table, no token issuance, no per-role check (S10).

## 7. Workflow trace: listing to delivery

Happy path as the code is read:

1. **Listing created** as `POSTED`. Creation does not read any inspection result; the only check is a regex over free-text handling notes (S5).
2. **Mirage inspection** runs. It writes no database rows; results are held in a per-process cache only. If Mirage is unavailable, the fallback returns a passing result (S4).
3. **Match** is computed. It is read-only.
4. **Claim** sets the listing to `CLAIMED` and inserts a `pickups` row (`UNIQUE(listing_id)`).
5. **Collected** sets the listing to `COLLECTED`.
6. **Delivered** sets the listing to `DELIVERED` and inserts a `shelter_intakes` row. A thermal breach (below 65 or above 4 C) only sets a `fssai_compliance_status` string and still reaches `DELIVERED` (S6). The alternate delivery path writes no intake row and no temperature (S6). Delivery is allowed directly from `CLAIMED`, so pickup can be skipped (S6).
7. **No shelter accept step exists.** The shelter does not confirm receipt in the workflow.

Concurrency: the status read in `confirm_delivery` is followed by an UPDATE with no status condition, and `shelter_intakes` has no unique key on `listing_id`. Duplicate intakes are possible under concurrent confirms (S7, code shape CONFIRMED; runtime race SUSPECTED, not run).

## 8. Test coverage

- Backend: 187 tests passing. Frontend: 146 tests passing (15 files). Total 333.
- Gap: the test suites do not cover wrong-key behaviour in development mode (S1).
- Gap: the test suites do not cover the seed route (S2).
- Gap: no test was found for the concurrent confirm race (S7).
- Gap: no test was found for the Mirage-unavailable fallback (S4).

## 9. Broken or incomplete workflows

- **S3** Tax verify endpoint returns a fixed "verified" result with a hard-coded issuer, firm, and ICAI number. UDIN and PAN are derived from hashes, not validated.
- **S5** Listing creation does not check inspection results.
- **S6** Thermal breach does not block delivery; alternate delivery path writes no intake or temperature.
- **S7** Duplicate intakes possible under concurrent confirm.
- **S16** Simulated values are shown as real (see section 11).
- **S17** Frontend expects fields that the GET dispatch-trigger response does not return (SUSPECTED).
- **S19** Form 68-A has no backend generator; "TRANSMITTED" toast has no verified backing POST (SUSPECTED).

## 10. Performance

- The Mirage cache is per process. Multiple workers do not share it, and it is lost on restart (S13 for the TTL being hard-coded).
- The Mirage lock is blocking with no timeout. Concurrent requests queue rather than fail (S22).
- Some GET requests write rows (S9): `portals.py:94` and `tax.py:236` call `get_or_create_80g_certificate`, which inserts or updates `tax_certificates`.
- Cache tag `listings` appears never invalidated (S23, SUSPECTED).

## 11. Technical debt

- **Hard-coded demo values** (S16): frontend fallback "133 KG" impact; ETA from simulated speed; "HYGIENE VERIFIED" for a simulated scan; donor hygiene 98.5% and core temp 68.4 hard-coded; telemetry constants (speed 28.6, battery 79.4, core 68.4); synthetic core temp 68.2 for non-chilled images; seed intake temperatures labelled "verified compliant"; `ShelterPortal.tsx` fallback temperature 66.8; municipal `WARDS` constant with fallback "295 Standard Meals".
- **Dead config** (S13): `config.py:21` `mirage_enabled` and `config.py:26` `cache_mirage_ttl_seconds` are never read. The Mirage TTL is hard-coded to 86400 in the inspector.
- **Duplicated ESG constant**: the ESG figure is defined in more than one place (noted in the register's debt list).
- **Tax constants presented as statutory** (S18): 50% deduction, 26% rate, Rs65 per plate fair market value. The 80G deduction depends on donee category, which was not verified.
- **Certificate number** (S21): `80G-BLR-2026-` plus the first 8 characters of the listing id (`tax.py`). The insert has no try/except, so a collision would be unhandled. Impact is SUSPECTED.
- **No migrations** (S12): schema is created from DDL in `database.py` only.
- **Hard-coded test keys** (S14): literal API key strings exist as fixtures in `backend\tests` and `backup_ledgerpulse`. Values are not reproduced here. Confirming they are never used as production keys is an open check.
- **Dependency declaration** (S15): `config.py:8` imports `pydantic_settings`. An earlier read found it missing from `backend\requirements.txt`. Must be re-checked before any fix.
- **Two delivery paths** (S23): listings and telemetry confirm endpoints both reach `DELIVERED`, with different side effects.

## 12. Production requirements missing

- Per-user authentication with roles, token issuance, and owner checks on id-keyed routes (S10).
- Production-mode frontend auth: the UI sends no credential header, so every protected write returns 401 in production (S11). Runtime not tested.
- Non-development default for the environment mode. The default is `development` (S1).
- Removal or lock-down of the seed route outside a controlled environment (S2).
- Authentication or read restriction on portal, courier, shelter, and directory GETs (S8).
- Database constraints: CHECK on `food_listings.status`, CHECK on `shelter_intakes.intake_temp_c`, UNIQUE on `shelter_intakes.listing_id` (S7, S12).
- Migration system (S12).
- Genuine Mirage behaviour: no pass result when Mirage is unavailable (S4); kill switch wired to config (S13).
- Real tax validation, or removal of the fixed verification result (S3).
- CORS review: `main.py:39-40` sets `allow_credentials=True` with `settings.cors_origins`; the origin values were not verified (S20).
- Bounded Mirage lock timeout (S22).

## 13. Existing functionality to preserve

- Production auth fails closed, using constant-time comparison (`auth.py:102-124`, `secrets.compare_digest`).
- Mutating routes listed in section 6 carry `require_auth` (the production path). Do not remove those dependencies.
- WAL mode and `busy_timeout` configured in `database.py`.
- `pickups` has `UNIQUE(listing_id)`.
- Dispatch claim uses a conditional UPDATE.
- Matching is read-only.
- Cache invalidation runs after commit.
- 333 tests passing (187 backend, 146 frontend).

## 14. Note on ARCHITECTURAL_AUDIT_REPORT.md

`ARCHITECTURAL_AUDIT_REPORT.md` describes `main.py` as monolithic. That is out of date: `main.py` mounts ten routers under `/api` (section 1). This review does not modify that report.

---

## Findings register

Each entry lists ID, severity, status, file and line, evidence, and reproduction in one line. No secret or personal value is reproduced.

### S1 (High, CONFIRMED)
- **File:** `backend\app\auth.py:127-138` (mode read at `auth.py:25`).
- **Evidence:** In non-production mode, `require_auth` accepts any non-empty token (method `dev_token`) and allows requests with no token (method `dev_bypass`). Mode comes from `SURPLUSPULSE_ENV`, then `ENVIRONMENT`; the default is `development`. Affects listing create/claim/status, dispatch POST, inspect-food, and confirm-delivery.
- **Reproduction:** Start backend with no environment variables set; send a protected POST with no credential, then with any non-empty token; both are accepted.

### S2 (High, CONFIRMED)
- **File:** `backend\app\routers\seed.py` (POST `/api/seed`; env check at `seed.py:31`; refusal message at `seed.py:47`).
- **Evidence:** The decorator has no `require_auth` dependency. Outside production there is no environment check at all. The endpoint accepts a force flag.
- **Reproduction:** Outside production, POST `/api/seed` with no credential and force set.

### S3 (High, CONFIRMED)
- **File:** `backend\app\routers\tax.py` verify endpoint (~line 285).
- **Evidence:** Always returns `valid=True` and `verification_status` "OFFICIALLY_VERIFIED_AND_SEALED" with a hard-coded issuer naming a government body. CA name, firm, and ICAI number are literal constants. UDIN is a hash-derived string never validated. PAN is hash-derived from donor id and name. This is a compliance misrepresentation.
- **Reproduction:** Call the tax verify endpoint with any certificate reference; the response is always "verified".

### S4 (High, CONFIRMED)
- **File:** `backend\app\mirage_inspector.py` (~641-690).
- **Evidence:** If Mirage fails to import, non-corrupt images receive `FRESH_AND_GOOD` with `is_safe=True` and a quality score of 90-98 with no real assessment. A runtime exception fails closed (`is_safe=False`). Preset sample IDs bypass Mirage.
- **Reproduction:** Run with Mirage unavailable; inspect a non-corrupt image; expect a pass result.

### S5 (High, CONFIRMED)
- **File:** `backend\app\routers\listings.py` `create_listing` (~line 190).
- **Evidence:** Listing creation never reads an inspection result. The only check is a regex over free-text handling notes. Listings start `POSTED`.
- **Reproduction:** Create a listing with no inspection run; it is stored as `POSTED`.

### S6 (High, CONFIRMED)
- **File:** `backend\app\routers\telemetry.py` `confirm_delivery` (~lines 207-291).
- **Evidence:** A thermal breach (below 65 or above 4 C) only sets a `fssai_compliance_status` string on `shelter_intakes`; the listing still becomes `DELIVERED`. The alternate delivery path writes no intake row and no temperature. Delivery is allowed from `CLAIMED`, so pickup can be skipped.
- **Reproduction:** Confirm delivery with an out-of-range temperature; the listing becomes `DELIVERED`.

### S7 (High, CONFIRMED in code shape; runtime SUSPECTED)
- **File:** `backend\app\routers\telemetry.py` `confirm_delivery` (UPDATE to `DELIVERED` around line 268 per one pass); `backend\app\database.py` (~139-150) for the missing UNIQUE.
- **Evidence:** Status is read, then UPDATE to `DELIVERED` with no status condition. `shelter_intakes` has no UNIQUE on `listing_id`. Concurrent confirms can insert duplicate intakes. A sequential second confirm returned 409 in one pass; the race itself was not run.
- **Reproduction:** Send two confirm-delivery requests for the same listing at the same time against a running backend; count `shelter_intakes` rows (not run).

### S8 (Medium, CONFIRMED)
- **File:** `backend\app\routers\portals.py` (donor GET, courier GET, shelter GET); `backend\app\routers\directory.py:20` and `:41`.
- **Evidence:** Unauthenticated GET routes expose personal contact data. Donor GET exposes phone, address, coordinates, and certificate PAN and address. Courier GET exposes donor name and address and WhatsApp/SMS links with phone numbers. Shelter GET exposes contact name, phone, and address. Directory exposes donor and receiver data. Field names only; no values reproduced.
- **Reproduction:** Call each GET route with no credential and inspect the returned fields.

### S9 (Medium, CONFIRMED)
- **File:** `backend\app\routers\portals.py:94` and `backend\app\routers\tax.py:236` call `get_or_create_80g_certificate` (`tax.py:83`).
- **Evidence:** The helper INSERTs or UPDATEs `tax_certificates`. GET requests therefore write rows. Enclosing handler names were not confirmed.
- **Reproduction:** Call the GET route for a donor with no certificate; a `tax_certificates` row appears.

### S10 (Medium, CONFIRMED for model; per-route IDOR SUSPECTED)
- **File:** Auth model across `backend\app\auth.py` and routers.
- **Evidence:** No user or credential table, no token issuance, no per-role check. Authentication is one shared static key (`X-API-Key` or Bearer). Portal GETs by id are unauthenticated. No owner check on id-keyed routes was verified.
- **Reproduction:** Request an id-keyed portal resource with the shared key; no owner check applies (per-route verification not run).

### S11 (Medium, CONFIRMED in code; runtime not tested)
- **File:** `frontend\src` (no header set); `backend\app\auth.py:112-123` (production 401).
- **Evidence:** The frontend contains no `X-API-Key` or `Authorization` header anywhere. In production mode every `require_auth` write returns 401, so the UI cannot perform protected writes.
- **Reproduction:** Run the frontend against backend in production mode; attempt a protected write (not run).

### S12 (Medium, CONFIRMED)
- **File:** `backend\app\database.py` DDL.
- **Evidence:** `food_listings.status` has no CHECK constraint (default `POSTED`). `shelter_intakes.intake_temp_c` has no CHECK. No migration system; DDL only.
- **Reproduction:** Inspect the DDL in `database.py`; no CHECK clauses exist on these columns.

### S13 (Medium, CONFIRMED)
- **File:** `backend\app\config.py:21` (`mirage_enabled`) and `config.py:26` (`cache_mirage_ttl_seconds`); TTL hard-coded in `mirage_inspector.py`.
- **Evidence:** Both config fields are defined but never read. Mirage TTL is hard-coded to 86400. The kill switch has no effect.
- **Reproduction:** Set the Mirage-enabled setting to false; Mirage still runs.

### S14 (Medium, CONFIRMED that literals exist; production-use check OPEN)
- **File:** `backend\tests` and `backup_ledgerpulse` (fixture literals).
- **Evidence:** Hard-coded literal API key strings are used as test fixtures. Values are not reproduced here. That they are never used as production keys has not been verified.
- **Reproduction:** Search these folders for the key literal and compare against the deployed configuration (not run).

### S15 (Medium, CONFIRMED; re-check required)
- **File:** `backend\app\config.py:8` (import); `backend\requirements.txt`.
- **Evidence:** `config.py` imports `pydantic_settings`. An earlier read found it missing from `requirements.txt`.
- **Reproduction:** Fresh install from `requirements.txt`, then import `app.config` (not run).

### S16 (Medium, CONFIRMED)
- **File:** Frontend fallback "133 KG" impact; ETA from simulated speed; "HYGIENE VERIFIED" toast; donor hygiene 98.5% and core temp 68.4; telemetry constants (speed 28.6, battery 79.4, core 68.4); synthetic core temp 68.2 for non-chilled images; seed intake temperatures labelled "verified compliant" (`backend\app\routers\seed.py`); `ShelterPortal.tsx` fallback temperature 66.8; municipal `WARDS` constant with fallback "295 Standard Meals". Exact line numbers per item not recorded in the register.
- **Evidence:** Simulated or fixed values are displayed or stored as real measurements.
- **Reproduction:** Open the relevant portal view with no live data; the fixed values display as real.

### S17 (Medium, SUSPECTED)
- **File:** Frontend `DispatchTriggerResponse` type; backend GET dispatch-trigger response.
- **Evidence:** The frontend type declares `success` and `pickup_id`; the GET dispatch-trigger response has neither.
- **Reproduction:** Call GET dispatch-trigger and compare fields with the frontend type (not run).

### S18 (Medium, CONFIRMED)
- **File:** Tax constants in `backend\app\routers\tax.py`.
- **Evidence:** Rates hard-coded and presented as statutory: 50% deduction, 26% rate, Rs65 per plate fair market value. The 80G deduction depends on donee category; not verified.
- **Reproduction:** Read the constants and the certificate output; the values appear without a category check.

### S19 (Medium, CONFIRMED for labels; SUSPECTED for backing call)
- **File:** Frontend Form 68-A labels and "TRANSMITTED" toast; no backend generator.
- **Evidence:** Form 68-A exists only as frontend labels and a toast. No verified POST sits behind the toast.
- **Reproduction:** Trigger the Form 68-A transmit action and watch network calls (not run).

### S20 (Medium, CONFIRMED for setting; origin values NOT verified)
- **File:** `backend\app\main.py:39-40`.
- **Evidence:** `allow_credentials=True` is set with `settings.cors_origins`. The origin values were not verified.
- **Reproduction:** Inspect the configured origins and send a cross-origin request with credentials (not run).

### S21 (Low, CONFIRMED for construction; impact SUSPECTED)
- **File:** `backend\app\routers\tax.py` (certificate number construction and insert).
- **Evidence:** Certificate number is `80G-BLR-2026-` plus the first 8 characters of the listing id. The insert has no try/except; a collision would be unhandled.
- **Reproduction:** Create two listings whose ids share the first 8 characters and generate certificates (not run).

### S22 (Low, CONFIRMED)
- **File:** Mirage lock in `backend\app\mirage_inspector.py`.
- **Evidence:** The lock is blocking with no timeout. Concurrent requests queue rather than fail.
- **Reproduction:** Send concurrent inspection requests while one is slow; the others wait.

### S23 (Low, CONFIRMED for two paths; cache impact SUSPECTED)
- **File:** Listings and telemetry confirm endpoints; cache tag `listings`.
- **Evidence:** Two backend paths reach `DELIVERED`. Cache tag `listings` appears never invalidated.
- **Reproduction:** Deliver via each path and check whether cached listing reads update (not run).

---

## Open items (not verified in this pass)

- Live database schema dump (not done).
- Full donor table columns (not re-read).
- Runtime behaviour of S1, S7, S11, S17, S19, S20, S21, S22, S23 (not run).
- Whether S14 key literals match any deployed key (not checked).
- Full list of routes and frontend components (only the register items are covered).
