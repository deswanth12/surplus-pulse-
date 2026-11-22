# SurplusPulse Implementation Roadmap (Stage 4 Output)

Status: PLAN ONLY. No application code has been changed in this stage. No item in this document is fixed.

Labels:
- CONFIRMED = read in code during Stage 4.
- SUSPECTED = not yet run or reproduced; verify before coding.

Priority tiers:
- P0: security, data integrity, food safety, broken core workflows.
- P1: end-to-end and API integration.
- P2: UI reliability.
- P3: performance and enhancements.

Test baseline to preserve: 333 passing (backend pytest 187 + frontend Vitest 146 across 15 files). Any change to this count must be documented.

---

## Food-safety and regulatory caveats (read first)

- FSSAI applicability must be verified against official FSSAI guidance before any temperature or time threshold is coded. Which rule applies to which food category is not yet established.
- Do NOT treat a four-hour rule as universal. Any time limit depends on food category and on the applicable FSSAI guidance, which has not been verified in this stage.
- The 4 C and 65 C thresholds in the code are an existing project choice. They need explicit team confirmation and a citation to FSSAI guidance before they are relied on as compliance rules.
- Form 68-A applicability is UNVERIFIED. Do not implement or extend Form 68-A generation until its applicability is verified.
- 80G certificate handling and the deduction rate are UNVERIFIED. Do not treat any generated certificate as a valid tax document until verified.

---

## Decisions needed from the team

These decisions gate specific items. Stage 5 must not start the gated items until the decision is recorded.

1. Production auth model: single shared key, or per-role accounts (donor, shelter, courier, admin). Gates P0-1, P0-2, P1-1, P1-3.
2. Food categories and temperature/time rules: which categories apply, and which temperature and time rules apply to each. Verify against FSSAI guidance first. Gates P0-5, P0-6, P2-3.
3. Form 68-A and 80G scope: whether they are in scope at all, and which deduction rate applies. Gates P0-3, P1-2.
4. Demo mode: whether it stays, and how it is labelled in the UI and API. Gates P1-8, P2-6, P3-3.
5. Post modal 21–31 C range: whether this range is allowed for posting. Gates P2-3.
6. Seed route: whether POST /api/seed should exist outside development at all. Gates P0-2.

---

## P0 items

### P0-1 — Dev mode accepts any token or no token
- Status: CONFIRMED.
- Reason: In non-production configuration, authentication in `auth.py` accepts requests with any token or with no token, so `require_auth` routes are effectively open outside production.
- Affected files: `backend/app/auth.py:127-138`.
- Smallest reliable fix: Make the default fail-closed. Dev bypass only when an explicit dev opt-in setting is true. Reject missing or wrong keys with 401 otherwise.
- Regression test: In a non-dev environment, a wrong key and a missing key each return 401 on every `require_auth` route. Add one test per route group. Add one positive test that the correct key returns success.
- Open decision: Decision 1 (auth model). The fail-closed default can be done before the decision; the per-role model cannot.

### P0-2 — Unauthenticated POST /api/seed outside production
- Status: CONFIRMED.
- Reason: The seed route is reachable without authentication outside production. The `force` parameter can also reset or overwrite data outside development.
- Affected files: `backend/app/routers/seed.py:31`, `backend/app/routers/seed.py:47`.
- Smallest reliable fix: Require auth and an admin secret in all modes. Refuse `force` outside development. If Decision 6 says the route should not exist outside development, remove registration of the route in non-dev builds.
- Regression test: Unauthenticated POST /api/seed returns 401 or 403 in every mode. `force=true` outside development is refused and leaves row counts unchanged.
- Open decision: Decision 6 (seed route outside development) and Decision 1.

### P0-3 — Tax verification always returns valid; fabricated government-style constants
- Status: CONFIRMED.
- Reason: The verify endpoint always returns `valid=True` with status `OFFICIALLY_VERIFIED_AND_SEALED`. Constants for CA, UDIN and PAN are fabricated and presented as official identifiers. Nothing is checked against a stored record.
- Affected files: `backend/app/routers/tax.py` around line 285 (also check the constants block in the same module).
- Smallest reliable fix: Verify the submitted certificate against the stored hash. If no stored record matches, or the hash does not match, return `UNVERIFIED`. Remove the fabricated CA, UDIN and PAN constants. Remove any "OFFICIAL", "OFFICIALLY VERIFIED" and "SEALED" wording that implies government or professional certification.
- Regression test: An unknown certificate returns not-valid. A tampered certificate (one changed character) returns not-valid. Response bodies contain no "OFFICIAL" or "SEALED" strings. Add a test that a stored, untampered certificate verifies as valid.
- Open decision: Decision 3 (80G scope and deduction rate). Until decided, the fix should only remove false claims and return UNVERIFIED for everything.

### P0-4 — Mirage unavailable returns FRESH_AND_GOOD with is_safe=True
- Status: CONFIRMED.
- Reason: When the Mirage service is unavailable or times out, the inspector falls through to a FRESH_AND_GOOD result with `is_safe=True`. A failed scan is reported as a safe food result.
- Affected files: `backend/app/services/mirage_inspector.py` around lines 641–690.
- Smallest reliable fix: On unavailable or timeout, return status UNVERIFIED with `is_safe=False`. Never derive a safe result from a failed call.
- Regression test: With Mirage mocked as unavailable, and separately as timed out, `is_safe` is never true and status is never FRESH_AND_GOOD. Add a test that a successful mocked Mirage response still maps correctly.
- Open decision: None for the minimal fix. Thresholds used by a successful scan remain under Decision 2.

### P0-5 — Listing creation is not gated by inspection
- Status: CONFIRMED.
- Reason: A listing can be created and moved to POSTED or made available for dispatch without an inspection or eligibility check.
- Affected files: `backend/app/routers/listings.py` around line 190 (creation and status transition), plus the dispatch eligibility path.
- Smallest reliable fix: Add an eligibility precondition for transition to POSTED and for dispatch. The precondition uses deterministic rules from the decided rule set. Reject with a clear error code when the precondition is not met.
- Regression test: A listing without a passing inspection cannot be posted or dispatched (returns a 4xx and state is unchanged). A listing that meets the rule set can be posted and dispatched.
- Open decision: Decision 2 (rule set) must be decided first. Do not write the eligibility rules before it.

### P0-6 — Thermal breach still reaches DELIVERED
- Status: CONFIRMED.
- Reason: The telemetry flow allows a listing to reach DELIVERED even when a recorded temperature breaches the threshold. The rejection is not recorded.
- Affected files: `backend/app/routers/telemetry.py` around lines 207–291.
- Smallest reliable fix: Block DELIVERED when a breach is recorded. Record the rejection with the reading that caused it. Apply the same temperature check on the alternate delivery path.
- Regression test: A recorded temperature of 60 C does not allow DELIVERED. The alternate path (any other route that sets DELIVERED) also refuses when temperature breaches. Add a test that a compliant temperature allows DELIVERED.
- Open decision: Decision 2. The threshold values stay as currently coded until confirmed. The block logic does not depend on which values are final.

### P0-7 — Delivery confirm race and duplicate shelter intakes
- Status: CONFIRMED.
- Reason: `confirm_delivery` checks status and then updates it in separate steps, so two concurrent confirms can both succeed. `shelter_intakes` has no UNIQUE constraint on `listing_id`, so duplicate intakes can be written.
- Affected files: `backend/app/routers/telemetry.py` (`confirm_delivery`); `backend/app/database.py` (`shelter_intakes` table definition).
- Smallest reliable fix: Use a conditional UPDATE with `WHERE status = <expected>`. Check the rowcount and reject when it is 0. Add UNIQUE(listing_id) to `shelter_intakes` through a migration.
- Migration safety steps (required, in order):
  1. Take a backup of the database file before anything else. Keep the copy outside the working tree.
  2. Run a read-only query that detects existing duplicate `listing_id` values in `shelter_intakes`.
  3. Resolve duplicates by a decided rule (keep earliest record, or keep the one matching the delivered listing). Record what was removed.
  4. Only then add the UNIQUE constraint.
  Do not run the migration against the live database without a verified backup.
- Regression test: Two concurrent confirms on one listing produce exactly one intake and one successful status change. The second confirm is rejected by rowcount check. A duplicate insert for the same `listing_id` fails at the database level.
- Open decision: The rule for which duplicate to keep.

---

## P1 items

### P1-1 — Frontend sends no auth header; production writes will fail
- Status: CONFIRMED.
- Reason: The frontend API client does not attach an authentication header. Once P0-1 is fixed, all write requests will be rejected in production.
- Affected files: `frontend/src/services/api.ts`.
- Smallest reliable fix: Inject a configured key from an environment variable at build or run time. No secret is stored in source.
- Regression test: The API client adds the header on write methods (POST, PUT, PATCH, DELETE). It does not add the header to a test fixture that is committed to source. Add a Vitest test for header injection.
- Open decision: Decision 1.

### P1-2 — GET requests write 80G certificates
- Status: CONFIRMED.
- Reason: Certificate creation happens as a side effect of GET requests in the portal and tax paths. A read changes stored data.
- Affected files: `backend/app/routers/portals.py:94`; `backend/app/routers/tax.py:236`.
- Smallest reliable fix: Move creation to an explicit POST endpoint. GET only reads.
- Regression test: A GET on the affected route does not change row counts in the certificate table. A POST creates exactly one record.
- Open decision: Decision 3.

### P1-3 — Unauthenticated personal-data GETs; no role model
- Status: CONFIRMED.
- Reason: Portal, courier, shelter and directory GET routes return contact fields without authentication, and there is no role model.
- Affected files: `backend/app/routers/portals.py`; courier and shelter routers; `backend/app/routers/directory.py:20`, `backend/app/routers/directory.py:41`.
- Smallest reliable fix: Either require role-scoped auth, or minimise fields returned to unauthenticated callers (remove contact fields). Field minimisation is the smaller change and can ship before the full role model.
- Regression test: An unauthenticated request receives no contact fields (phone, email, address, PAN or similar). Add one test per affected route.
- Open decision: Decision 1 (auth model).

### P1-4 — DispatchTriggerResponse mismatch with GET response; undeclared consumers
- Status: CONFIRMED (register S17).
- Reason: The TypeScript type for the dispatch trigger response does not match the GET response shape. Some consumers use the type without declaring it.
- Affected files: `frontend/src/types.ts`; `frontend/src/services/api.ts`.
- Smallest reliable fix: Split the type into separate trigger-response and GET-response types. Update each consumer to the type it uses.
- Regression test: A type test (compile-time or Vitest type assertion) fails if the two shapes are merged again.

### P1-5 — Literal key strings in tests and backup; no secret scan
- Status: CONFIRMED (register S13, S14).
- Reason: Literal key strings appear in test files and a backup folder.
- Affected files: test files under `backend/tests/` and `frontend/src/test/`; `backup_ledgerpulse/`.
- Smallest reliable fix: Replace literals with environment-sourced fixtures in tests. Remove key strings from the backup folder (or exclude it from the repository). Add a secret-scan step to the pipeline.
- Regression test: A secret scan over the repository finds no key literals. Tests still pass using environment fixtures.
- Open decision: Whether the backup folder is kept in the repository at all.

### P1-6 — CORS origins are not an explicit list
- Status: CONFIRMED (register S12).
- Reason: CORS origin configuration is not an explicit allow list.
- Affected files: backend CORS configuration (app entry point and `config.py`).
- Smallest reliable fix: Use an explicit list of origins from configuration.
- Regression test: A request from an unknown origin receives no `Access-Control-Allow-Origin` header. A request from a listed origin receives it.

### P1-7 — pydantic_settings requirement
- Status: SUSPECTED. Re-check required.
- Reason: The configuration code may depend on `pydantic_settings`, which may not be declared in requirements.
- Affected files: `backend/requirements.txt`.
- Smallest reliable fix: Confirm the import, then add the package with a pinned version if it is missing.
- Regression test: A clean install from `requirements.txt` imports the configuration module without error.

### P1-8 — Dead configuration: mirage_enabled and cache_mirage_ttl_seconds
- Status: CONFIRMED.
- Reason: Two settings in `config.py` (lines 21 and 26) are not read by the code that should use them.
- Affected files: `backend/app/config.py:21`, `backend/app/config.py:26`.
- Smallest reliable fix: Either wire them into the Mirage path or remove them. Pick one.
- Regression test: If wired, a test confirms `mirage_enabled=False` skips the call. If removed, a search finds no remaining references.
- Open decision: Decision 4 (demo mode) affects whether `mirage_enabled` is needed.

### P1-9 — Dead frontend code candidates
- Status: SUSPECTED. Confirm before removing.
- Reason: `useModalState` openers and the `getTelemetry` and `getDispatchTrigger` helpers may be unused.
- Affected files: frontend hooks and `frontend/src/services/api.ts`.
- Smallest reliable fix: Use a symbol-reference search for each. Remove only if no callers exist.
- Regression test: Full Vitest suite still passes after removal (baseline 146 frontend tests).

---

## P2 items (UI reliability)

### P2-1 — Mirage modal has no client-side type or size check
- Status: SUSPECTED.
- Affected files: Mirage upload modal in `frontend/src`.
- Smallest reliable fix: Add client validation that mirrors the server limit and accepted types. The server remains the authority.
- Regression test: A file over the limit or of a wrong type shows a visible error and is not submitted.

### P2-2 — Certificates setTimeout not cleared on unmount
- Status: SUSPECTED. Verify.
- Affected files: certificate component in `frontend/src`.
- Smallest reliable fix: Store the timer id and clear it in the effect cleanup.
- Regression test: Unmounting before the timer fires produces no state update and no console warning.

### P2-3 — Post modal 21–31 C block
- Status: CONFIRMED as a product question.
- Reason: The post modal accepts a 21–31 C range. This range is a product decision, not a code defect.
- Affected files: post modal in `frontend/src`.
- Action: Do not change behaviour until Decision 5 is recorded. If allowed, document it. If not allowed, add validation with a visible error.
- Open decision: Decision 5, and Decision 2 for food-safety basis.

### P2-4 — Form validation is mostly HTML `required` only
- Status: CONFIRMED.
- Smallest reliable fix: Add field-level validation with visible error text, linked to the input with `aria-describedby`.
- Regression test: Invalid input shows an error message and blocks submit. Valid input submits.

### P2-5 — Accessibility unverified
- Status: SUSPECTED.
- Smallest reliable fix: Audit labels, focus order and visible focus, and colour contrast on primary screens. Fix only the failures found.
- Regression test: An automated accessibility check on each primary screen reports no critical violations.

### P2-6 — Demo and fallback values shown as real results
- Status: CONFIRMED.
- Reason: The following values appear as if they were real results: a 133 KG fallback; the text "HYGIENE VERIFIED" for a simulated scan; hard-coded 98.5 and 68.4; a WARDS fallback of 295; a shelter default of 66.8.
- Affected files: frontend components and services that render these values.
- Smallest reliable fix: Label each as DEMO, or show "no data" when the real value is unavailable. Do not show a fallback number without a label.
- Regression test: No fallback number renders without a DEMO or "no data" label.
- Open decision: Decision 4.

---

## P3 items (performance and enhancements)

### P3-1 — Per-process cache not shared across workers; read-triggered writes
- Status: CONFIRMED.
- Reason: The cache is per process, so behaviour differs across workers. Related to P1-2.
- Smallest reliable fix: Remove read-triggered writes (P1-2). Use a shared cache only if more than one worker is deployed.

### P3-2 — Blocking Mirage lock with no timeout
- Status: CONFIRMED.
- Smallest reliable fix: Add a lock timeout. On timeout, return UNVERIFIED with `is_safe=False` (same rule as P0-4).
- Regression test: A held lock causes a timed-out result, not an indefinite wait.

### P3-3 — Simulated telemetry and ETA
- Status: CONFIRMED.
- Smallest reliable fix: Replace simulated values with a clearly labelled demo mode, per Decision 4.
- Regression test: With demo mode off, no simulated telemetry or ETA is returned.

### P3-4 — Duplicated ESG constant (tax and impact)
- Status: CONFIRMED.
- Smallest reliable fix: Move the constant to one shared module and import it in both places.
- Regression test: One definition exists; both modules return the same value.

### P3-5 — No migrations system
- Status: CONFIRMED.
- Smallest reliable fix: Introduce a migration step only if P0-7 needs one beyond a one-off script. Do not add a framework speculatively.

---

## Section: Stage 5 execution order

Each step needs its regression test and a full test-suite run. The baseline of 333 must remain passing, or any change to it must be documented.

1. P0-1 and P0-2 (small, testable). Gated by Decisions 1 and 6 for the final form.
2. P0-3 and P0-4 (remove false positives).
3. P0-5, P0-6 and P0-7 (data integrity and food safety). P0-5 requires Decision 2 first. P0-7 requires a verified database backup before any migration.

Later tiers (P1 to P3) follow after P0 is complete, in the order of their list above, with P1-1 following P0-1.

Database backup rule: take and verify a backup of the SQLite database before any migration, including P0-7. Keep the backup outside the working tree.

---

## Not fixed in this stage

- No application code has been changed.
- No test has been added or run in this stage.
- No item in this roadmap is marked fixed.
- The regression tests listed above are proposed, not written.
- The FSSAI, Form 68-A and 80G points are unverified and are not implementation requirements until verified.
