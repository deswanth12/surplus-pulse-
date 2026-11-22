# SurplusPulse Security Audit (Stage 4)

**Scope:** practical code review of the SurplusPulse backend (FastAPI, `backend\app\`) and frontend (`frontend\src`), with the register below as the verified finding set.

**Not a security certification.** This document does not certify security or production readiness. It is a practical review, not a penetration test. No runtime attack was run, and no dynamic test was executed. Reproduction steps describe what to try; they have not been run unless stated.

**Status labels**
- `CONFIRMED` = read in code.
- `SUSPECTED` = not run or not fully read.

**Host:** Windows. Paths use `\`.

**No fixes applied.** Every item below is open. No item in this document is fixed.

---

## Findings summary

| ID | Severity | Status | Title |
|----|----------|--------|-------|
| S1 | High | CONFIRMED | Non-production auth accepts any token or no token |
| S2 | High | CONFIRMED | `POST /api/seed` has no auth in non-production |
| S3 | High | CONFIRMED | Tax `verify` always returns valid and "officially verified" |
| S4 | High | CONFIRMED | Mirage unavailable yields positive food-safety result |
| S5 | High | CONFIRMED | Listings are POSTED without inspection |
| S6 | High | CONFIRMED | Thermal breach still allows DELIVERED |
| S7 | High | CONFIRMED (code shape) / runtime SUSPECTED | Delivery confirm race creates duplicate intakes |
| S8 | Medium | CONFIRMED | Unauthenticated GETs expose personal contact data |
| S9 | Medium | CONFIRMED | GET requests write rows |
| S10 | Medium | CONFIRMED | No role model, no user store, one shared key; IDOR risk SUSPECTED |
| S11 | Medium | CONFIRMED | Frontend sends no auth header |
| S12 | Medium | CONFIRMED | CORS credentials with unverified origin list |
| S13 | Medium | CONFIRMED | Hard-coded key-like literals in test fixtures |
| S14 | Medium | SUSPECTED | No rate limiting observed |
| S15 | Medium | CONFIRMED (limit) / SUSPECTED (validation) | Upload type validation not verified |
| S16 | Low | CONFIRMED | Certificate number collision risk |
| S17 | Low | CONFIRMED | Mirage kill-switch settings are never read |
| S18 | Low | CONFIRMED | `pydantic_settings` may be missing from requirements |
| S19 | Medium | CONFIRMED | Tax constants presented as statutory |

---

## Findings

### S1 — High — CONFIRMED
- **Location:** `backend\app\auth.py:127-138` (mode resolution at `auth.py:25`)
- **Evidence:** In non-production mode, any non-empty token is accepted with method `dev_token`. Requests with no token are accepted with method `dev_bypass`. Mode is read from `SURPLUSPULSE_ENV`, then `ENVIRONMENT`, and defaults to `development`.
- **Reproduction:** Unset both `SURPLUSPULSE_ENV` and `ENVIRONMENT`. Send `POST /api/listings` with no key. Expected per code: the request succeeds.
- **Recommended fix:** Default to fail-closed. In development, accept only the configured key, or require an explicit opt-in flag for bypass.
- **Regression test:** In development mode, a wrong key and no key each return 401 on every `require_auth` route.

### S2 — High — CONFIRMED
- **Location:** `backend\app\routers\seed.py` `POST /api/seed`; environment check at `seed.py:31`; refusal at `seed.py:47`
- **Evidence:** The route has no `require_auth` dependency. The admin-secret gate applies only in production.
- **Reproduction:** Default environment. Send `POST /api/seed` with no auth header.
- **Recommended fix:** Require auth in every mode. Require the admin secret in every mode. Disable the `force` option outside development.
- **Regression test:** Unauthenticated seed returns 401 or 403 in every mode.

### S3 — High — CONFIRMED
- **Location:** `backend\app\routers\tax.py` `verify` (around line 285)
- **Evidence:** The response always sets `valid=True` and `status="OFFICIALLY_VERIFIED_AND_SEALED"`. The issuer names a government body. The CA name, firm, and ICAI reference are constants. The UDIN is an unvalidated hash-derived string. The PAN is hash-derived.
- **Reproduction:** Call the verify endpoint with any certificate identifier, including an unknown one. Expected per code: `valid=true` with the sealed status.
- **Recommended fix:** Verify against the stored record and its hash. Return `UNVERIFIED` for anything that cannot be verified. Remove professional and government claims. Label all generated numbers as internal references.
- **Regression test:** A tampered or unknown certificate returns not valid. The response never contains `OFFICIALLY` or `SEALED`.

### S4 — High — CONFIRMED
- **Location:** `backend\app\mirage_inspector.py` (around lines 641-690)
- **Evidence:** When Mirage is unavailable, the result is `FRESH_AND_GOOD` with `is_safe=True` and a score of 90-98 for non-corrupt images.
- **Reproduction:** Make the Mirage import fail. Send `POST /api/inspect-food` with a normal image.
- **Recommended fix:** Unknown or unavailable Mirage yields `UNVERIFIED` with `is_safe` false. Never return a positive certification in this case.
- **Regression test:** With Mirage unavailable or timing out, `is_safe` is not true.

### S5 — High — CONFIRMED
- **Location:** `backend\app\routers\listings.py` `create_listing` (around line 190)
- **Evidence:** The handler does not read the inspection result. The listing is set to `POSTED`.
- **Reproduction:** Create a listing with no inspection.
- **Recommended fix:** Listing eligibility must be a precondition for `POSTED` and for dispatch.
- **Regression test:** A listing without a passing inspection cannot be dispatched.

### S6 — High — CONFIRMED
- **Location:** `backend\app\routers\telemetry.py` `confirm_delivery` (around lines 207-291)
- **Evidence:** A thermal breach (below 65 C or above 4 C) still sets the status to `DELIVERED`.
- **Reproduction:** Submit an intake temperature of 60 C and confirm delivery.
- **Recommended fix:** A breach blocks `DELIVERED` and records a rejection.
- **Regression test:** Intake at 60 C does not result in `DELIVERED`.

### S7 — High — CONFIRMED (code shape) / runtime SUSPECTED
- **Location:** `backend\app\routers\telemetry.py` `confirm_delivery` (around line 268); `backend\app\database.py` (around lines 139-150) for `shelter_intakes`
- **Evidence:** The handler reads the listing state, then runs an unconditional UPDATE. This is a read-then-write pattern. `shelter_intakes` has no UNIQUE constraint on `listing_id`.
- **Reproduction (not yet run):** Send two concurrent confirm requests for one listing.
- **Recommended fix:** Use a conditional UPDATE with `WHERE status=...` and check `rowcount`. Add a UNIQUE constraint on `listing_id` with a migration.
- **Regression test:** Concurrent confirms for one listing produce exactly one intake row.

### S8 — Medium — CONFIRMED
- **Location:** `backend\app\routers\portals.py` donor GET; `backend\app\routers\portals.py` courier GET; shelter GET; `backend\app\routers\directory.py:20,41`
- **Evidence:** These GETs are unauthenticated and return personal contact data. Field names only:
  - Donor GET: contact phone, address, coordinates, certificate PAN and address.
  - Courier GET: donor name and address, messaging links that embed phone numbers.
  - Shelter GET: contact name, phone, address.
- **Recommended fix:** Require auth, or return role-scoped responses. Minimise the fields returned.
- **Regression test:** Anonymous requests to these GETs do not return the personal fields listed above.

### S9 — Medium — CONFIRMED
- **Location:** `backend\app\routers\portals.py:94` and `backend\app\routers\tax.py:236`; both call `get_or_create_80g_certificate` (`tax.py:83`)
- **Evidence:** GET handlers create certificate rows as a side effect.
- **Recommended fix:** Move creation to a POST route.
- **Regression test:** A GET leaves row counts unchanged.

### S10 — Medium — CONFIRMED (IDOR risk SUSPECTED)
- **Location:** Backend-wide auth model
- **Evidence:** There is no role model and no user or credential store. A single static key is shared. ID-keyed portal and listing GETs are unauthenticated. Per-route owner checks were not verified.
- **Recommended fix:** Introduce per-user or per-role credentials. Add owner checks on every ID-keyed route.
- **Regression test:** A user cannot read another user's record by ID.

### S11 — Medium — CONFIRMED
- **Location:** `frontend\src` (API client)
- **Evidence:** The frontend sends neither `X-API-Key` nor `Authorization`. In production mode, protected writes return 401 (`auth.py:112-123`).
- **Recommended fix:** Attach the key through a configured client setting. Do not commit any key to frontend code.
- **Regression test:** The API client sends the auth header on write requests.

### S12 — Medium — CONFIRMED
- **Location:** `backend\app\main.py:39-40`
- **Evidence:** `allow_credentials=True` is set with `settings.cors_origins`. The origin values were not verified.
- **Recommended fix:** Use an explicit origin list per environment.
- **Regression test:** A request from an unknown origin receives no `Access-Control-Allow-Origin` header.

### S13 — Medium — CONFIRMED
- **Location:** Test files under `backend\tests` and the `backup_ledgerpulse` test files
- **Evidence:** Hard-coded key-like string literals are used as fixtures. Values were not reproduced in this document.
- **Recommended fix:** Move fixtures to environment-based values. Confirm none of these values are used in production.
- **Regression test:** None required. Add a secret scan to the pipeline.

### S14 — Medium — SUSPECTED
- **Location:** Backend-wide
- **Evidence:** No rate limiting was observed in the code read. Coverage across all routes was not verified.
- **Recommended fix:** Add rate limiting on auth-protected writes and on the inspection and seed routes first.
- **Regression test:** Repeated requests above the threshold return 429.

### S15 — Medium — CONFIRMED (limit) / SUSPECTED (validation)
- **Location:** Backend upload handling; frontend Mirage modal
- **Evidence:** The backend upload size limit of 10 MiB is configured. The frontend Mirage modal has no client-side type or size check. Backend type validation was not read in full.
- **Recommended fix:** Enforce a magic-byte type check and a size cap on the server.
- **Regression test:** A non-image payload is rejected.

### S16 — Low — CONFIRMED
- **Location:** `backend\app\routers\tax.py` (certificate number generation)
- **Evidence:** `certificate_number` uses the first 8 characters of the listing ID. There is no pre-insert check. A collision would be unhandled.
- **Recommended fix:** Use a full random ID, with retry on collision.
- **Regression test:** Generating certificate numbers produces unique values without error.

### S17 — Low — CONFIRMED
- **Location:** `backend\app\config.py:21` and `:26`
- **Evidence:** `mirage_enabled` and `cache_mirage_ttl_seconds` are never read. The Mirage kill switch has no effect.
- **Recommended fix:** Wire the kill switch into the Mirage call path and check it there.
- **Regression test:** With the kill switch off, the Mirage path is not invoked.

### S18 — Low — CONFIRMED
- **Location:** `backend\app\config.py:8`; `requirements.txt`
- **Evidence:** `pydantic_settings` is imported. An earlier read found it missing from `requirements.txt`. This was not re-checked in this pass.
- **Recommended fix:** Add the dependency to `requirements.txt` with a pinned version.
- **Regression test:** A clean install from `requirements.txt` imports `config.py` without error.

### S19 — Medium — CONFIRMED
- **Location:** Tax constants in the tax module
- **Evidence:** The 50% deduction, 26% rate, and Rs 65 per plate are presented as statutory. The 80G category was not verified.
- **Recommended fix:** Label these values as configurable assumptions, not statutory facts, until reviewed.
- **Regression test:** None in this pass. Add a review checklist item.

---

## Not covered

- Live database schema dump.
- Full column list of the donors table.
- Per-route owner checks.
- Rate limiting across all routes.
- Session handling (there are no sessions).
- CORS origin values.
- Full Mirage upload type validation.
- No penetration test or dynamic test was run.
- No regulatory review of FSSAI or Form 68-A was done.

## Positive controls

- **Production fail-closed auth:** Supported by the evidence at `auth.py:112-123`, where production protected writes return 401 without a valid key. Not re-verified in this pass beyond that read.
- **Constant-time comparison:** Reported in an earlier pass. Not re-verified in this pass.
- **WAL and busy_timeout:** Reported in an earlier pass. Not re-verified in this pass.
- **Parameterised SQL:** Not verified in this pass.

---

**Status:** Not a security certification. Findings are open and unfixed. Written as a documentation file only; no code was changed. Edited, not test-verified (no shell).
