# SurplusPulse Deletion & Dead Code Safety Log

**Generated Date:** 2026-11-22  
**Target Repository:** `C:\building for codebas3e`  
**Integrity Mode:** Genuine Demo & Verification  
**Auditor Target:** Teamwork Auditor / Forensic Verification  

---

## 1. Executive Summary

In accordance with project requirements (`ORIGINAL_REQUEST.md`), this audit and cleanup log documents every deleted file and dead code removal across the repository. Every item underwent automated AST reference analysis, global full-text grep verification across frontend, backend, test suites, and build scripts, and post-deletion regression testing.

### Key Metrics
- **Unwanted and Large Files Removed:** 151 files across 6 major candidate categories, freeing ~129.8 MB of disk space.
- **Dead Code Blocks Removed:** 38 candidate items across 11 active source files (13 unused imports, 2 unused variables/constants, 4 unreferenced functions/methods, 4 unreferenced Pydantic models, 8 unreferenced frontend API wrapper functions, 7 unreferenced type imports, plus 1 dependent unreferenced typing import).
- **Protected Assets Intact:** `backend/surpluspulse.db` (126,976 bytes, 6 tables) intact; zero test files modified or deleted in `backend/tests/` or `frontend/src/test/`.
- **Test & Build Integrity Preserved:**
  - `backend`: Exactly **235 passed**, 1 warning in 20.94s (`python -m pytest`).
  - `frontend`: Exactly **146 passed** across 15 test files in 7.07s (`npm test -- --run`).
  - `frontend build`: **0 errors**, clean production bundling (`tsc --noEmit && vite build`).

---

## 2. Unwanted & Large Files Deletion Log (151 Files)

### Category A: Demo Recordings & Media Blobs (`demo_recordings/`)
- **Path:** `C:\building for codebas3e\demo_recordings/`
- **Total Files:** 37 files (126.74 MB)
- **Safety Check Rationale:**
  - Files are ad-hoc recordings, raw webm browser recordings, uncompressed WAV clips, and generated audio from hackathon demo creation.
  - Zero imports or references across `backend/app/`, `frontend/src/`, `backend/tests/`, or `frontend/src/test/`.
  - Static files in backend are served from `frontend/dist/` only; no endpoint or asset loader references `demo_recordings/`.
- **Files Removed:**
  1. `demo_recordings/surpluspulse_competition_demo_2min.mp4` (14.66 MB) — Final demo video
  2. `demo_recordings/surpluspulse_competition_demo_narrated_final.mp4` (50.12 MB) — Narrated video
  3. `demo_recordings/raw/page@e0f40332ce0000718b66a12cf4431103.webm` (8.44 MB) — Raw screen capture
  4. `demo_recordings/raw_narrated/page@dde32193122d2378b547651ccab7f581.webm` (8.51 MB) — Raw screen capture
  5. `demo_recordings/master_audio_track.wav` (2.42 MB) — Master audio mix
  6. `demo_recordings/test_simple.mp4` (3.97 MB) — Test render
  7. `demo_recordings/voice_clips/scene_1.wav` (5.08 MB) — Voice clip WAV
  8. `demo_recordings/voice_clips/scene_2.wav` (4.02 MB) — Voice clip WAV
  9. `demo_recordings/voice_clips/scene_3.wav` (4.25 MB) — Voice clip WAV
  10. `demo_recordings/voice_clips/scene_4.wav` (4.03 MB) — Voice clip WAV
  11. `demo_recordings/voice_clips/scene_5.wav` (4.45 MB) — Voice clip WAV
  12. `demo_recordings/voice_clips/scene_6.wav` (4.02 MB) — Voice clip WAV
  13. `demo_recordings/voice_clips/scene_7.wav` (3.83 MB) — Voice clip WAV
  14. `demo_recordings/voice_clips/scene_1.mp3` (162.7 KB) — Voice clip MP3
  15. `demo_recordings/voice_clips/scene_2.mp3` (128.7 KB) — Voice clip MP3
  16. `demo_recordings/voice_clips/scene_3.mp3` (135.8 KB) — Voice clip MP3
  17. `demo_recordings/voice_clips/scene_4.mp3` (129.1 KB) — Voice clip MP3
  18. `demo_recordings/voice_clips/scene_5.mp3` (142.5 KB) — Voice clip MP3
  19. `demo_recordings/voice_clips/scene_6.mp3` (128.5 KB) — Voice clip MP3
  20. `demo_recordings/voice_clips/scene_7.mp3` (122.6 KB) — Voice clip MP3
  21. `demo_recordings/sample_in.mp3` (29.5 KB) — Audio sample
  22. `demo_recordings/sample_us.mp3` (28.5 KB) — Audio sample
  23. `demo_recordings/test_voice.mp3` (42.3 KB) — Voice test MP3
  24. `demo_recordings/real_map_satellite.png` (464.4 KB) — Satellite screenshot
  25. `demo_recordings/real_map_streets.png` (192.1 KB) — Street map screenshot
  26. `demo_recordings/form68a_improved.png` (253.5 KB) — Form screenshot
  27. `demo_recordings/form68a_spoiled.png` (243.4 KB) — Form screenshot
  28. `demo_recordings/frame_mirage_fresh.jpg` (181.2 KB) — Video frame
  29. `demo_recordings/frame_mirage_open.jpg` (225.9 KB) — Video frame
  30. `demo_recordings/frame_scene2.jpg` (120.1 KB) — Video frame
  31. `demo_recordings/frame_scene4.jpg` (170.3 KB) — Video frame
  32. `demo_recordings/frame_scene6.jpg` (255.2 KB) — Video frame
  33. `demo_recordings/frame_tax_80g.jpg` (201.9 KB) — Video frame
  34. `demo_recordings/frame_vlm_fresh.jpg` (295.6 KB) — Video frame
  35. `demo_recordings/frame_vlm_rejection.jpg` (294.9 KB) — Video frame
  36. `demo_recordings/captions.srt` (2.0 KB) — Video subtitle track
  37. `demo_recordings/fonts.conf` (124 B) — Local fontconfig file

### Category B: Scratch Demo Automation Scripts (5 Files)
- **Path:** `C:\building for codebas3e/`
- **Total Files:** 5 files (48.19 KB)
- **Safety Check Rationale:**
  - One-off scripts used to run Playwright or FFmpeg to create the demo recordings.
  - Zero imports or invocations in backend app, frontend app, tests, or package.json scripts.
- **Files Removed:**
  1. `capture_map.py` (878 B) — Playwright map capture scratch script
  2. `edit_demo.py` (1.71 KB) — FFmpeg clip assembly script
  3. `generate_audio_production.py` (10.17 KB) — Edge-TTS voice generation script
  4. `record_demo.py` (16.68 KB) — Playwright walkthrough script
  5. `record_narrated_demo.py` (18.76 KB) — Playwright narrated walkthrough script

### Category C: External Codelab Repository (`codelab-maps-platform-101-react-js/`)
- **Path:** `C:\building for codebas3e\codelab-maps-platform-101-react-js/`
- **Total Files:** 50 files (2.68 MB)
- **Safety Check Rationale:**
  - Cloned Google Maps tutorial repository containing standalone starter/solution apps and a 1.25 MB screenshot.
  - Zero imports across the SurplusPulse frontend or backend.
  - SurplusPulse's `GoogleMapsCircle.tsx` is completely self-contained in `frontend/src/components/maps/` and does not depend on this external folder.
- **Files Removed:** Entire folder of 50 files including `screenshot.png` (1.25 MB), nested `.git/` repository, `starter/`, and `solution/`.

### Category D: Obsolete Previous-Project Backup (`backup_ledgerpulse/`)
- **Path:** `C:\building for codebas3e\backup_ledgerpulse/`
- **Total Files:** 31 files (349.78 KB)
- **Safety Check Rationale:**
  - Backup snapshot of prior "LedgerPulse" application containing obsolete SQLite database `ledgerpulse.db`.
  - The live application is SurplusPulse and operates against `backend/surpluspulse.db`.
  - Zero imports or runtime references in active application or test runners.
- **Files Removed:** Entire folder of 31 files including `backup_ledgerpulse/backend/ledgerpulse.db`, obsolete backend code, and old test files.

### Category E: Obsolete Scratch Directory (`.codebenders/`)
- **Path:** `C:\building for codebas3e\.codebenders/`
- **Total Files:** 24 files (257.02 KB)
- **Safety Check Rationale:**
  - Temporary scratchpad containing old pytest logs (`pytest_full.txt`, `pytest_fail_list.txt`), debug JSON dumps, and one-off repro scripts.
  - Zero references in active code or test suites.
- **Files Removed:** Entire folder of 24 files.

### Category F: Stale Root-Level Pytest Cache (`.pytest_cache/`)
- **Path:** `C:\building for codebas3e\.pytest_cache/`
- **Total Files:** 4 files (20.99 KB)
- **Safety Check Rationale:**
  - Leftover root-level cache from historical execution at repository root.
  - Active pytest suite executes inside `backend/` and maintains its own isolated cache at `backend/.pytest_cache/`.
- **Files Removed:** Entire folder of 4 files (`CACHEDIR.TAG`, `README.md`, `.gitignore`, `v/cache/nodeids`).

---

## 3. Dead Code Removal Log (Active Files)

### 1. `backend/app/database.py`
- **Candidate Items:** `from pathlib import Path`, `from uuid import uuid4`
- **Safety Check Rationale:** Global AST search in `database.py` confirmed `Path` and `uuid4` were never referenced; `database.py` receives `DB_PATH` as a string from `settings.db_path`.
- **Action Taken:** Removed unused imports `Path` and `uuid4`.

### 2. `backend/app/main.py`
- **Candidate Items:** `_row_to_listing`, `get_connection`
- **Safety Check Rationale & Key Decision:**
  - `_row_to_listing` was imported from `app.routers.listings` but never called or referenced anywhere in `main.py` or by callers. Safely removed.
  - **RE-EXPORTED ON MAIN.PY:** `get_connection` was initially proposed as an unused import in `main.py`. However, deep safety verification during test execution discovered that `backend/tests/test_concurrency_and_hardening.py` line 174 (`old_get_conn = main_mod.get_connection`) accesses `main_mod.get_connection` during transaction rollback testing. To avoid Ruff `F401 'get_connection' imported but unused` while preserving the attribute on `app.main` for test monkeypatching, `get_connection` was removed from line 17 (`from app.database import init_db, seed_data`) and explicitly re-exported in the `# Backward Compatibility Re-Exports` section (`get_connection = database.get_connection`).
- **Action Taken:** Removed unreferenced import `_row_to_listing`. Re-exported `get_connection = database.get_connection` under Backward Compatibility Re-Exports, eliminating `F401` unused import warning while preserving test monkeypatch compatibility.

### 3. `backend/app/mirage_inspector.py`
- **Candidate Items:** Unused import `ImageFont` (line 15), unused local variable `preset_ids` (lines 217-223).
- **Safety Check Rationale:**
  - `ImageFont` was imported from `PIL` but text rendering in synthetic sample generation is not used.
  - `preset_ids` was a set literal initialized in `_inspect_food_payload_inner` but never read or referenced.
- **Action Taken:** Removed `ImageFont` from `PIL` import. Removed dead `preset_ids` set literal.

### 4. `backend/app/routers/inspection.py`
- **Candidate Items:** Unused constant `KNOWN_PRESETS` (lines 21-27).
- **Safety Check Rationale:** Global search across all project files confirmed `KNOWN_PRESETS` in `inspection.py` appeared only once (its declaration). Dynamic inspection and fallback logic do not reference it.
- **Action Taken:** Removed dead constant `KNOWN_PRESETS`.

### 5. `backend/app/routers/listings.py`
- **Candidate Items:**
  - Unused imports: `STATUS_CLAIMED`, `VALID_STATUSES` from `app.database`, `require_api_key` from `app.security`.
  - Unreferenced helper method: `_row_to_listing` (58 lines).
  - Dependent unused import: `typing.Optional` (only used in `_row_to_listing` signature).
- **Safety Check Rationale:**
  - `STATUS_CLAIMED`, `VALID_STATUSES`, and `require_api_key` appeared only on their import lines.
  - `_row_to_listing` was superseded by `_row_to_listing_joined` for single-query N+1 optimization. It was never invoked in any route, router, or test.
  - Removing `_row_to_listing` left `Optional` unused in `listings.py`; removing `Optional` satisfies strict Ruff static analysis (`F401`).
- **Action Taken:** Removed unused imports `STATUS_CLAIMED`, `VALID_STATUSES`, `require_api_key`, `Optional`. Removed entire dead function `_row_to_listing`.

### 6. `backend/app/routers/portals.py`
- **Candidate Items:** Unused imports `uuid4` from `uuid`, `FoodListingOut` from `app.schemas`.
- **Safety Check Rationale:** `uuid4` and `FoodListingOut` appeared only on their import lines in `portals.py`.
- **Action Taken:** Removed unused imports `uuid4` and `FoodListingOut`.

### 7. `backend/app/routers/seed.py`
- **Candidate Items:** Unused imports `Depends` from `fastapi`, `require_auth` from `app.auth`.
- **Safety Check Rationale:** Seed endpoint is guarded via `x_admin_secret: Optional[str] = Header(...)` directly, and does not use `Depends(require_auth)`.
- **Action Taken:** Removed unused imports `Depends` and `require_auth`.

### 8. `backend/app/routers/telemetry.py`
- **Candidate Items:** Unused import `Optional` from `typing`.
- **Safety Check Rationale:** `Optional` appeared only on line 11 and was never used in any type annotation or function signature in `telemetry.py`.
- **Action Taken:** Removed unused import `Optional`.

### 9. `backend/app/cache.py`
- **Candidate Items:** Unreferenced methods `get_or_set`, `invalidate_key`, `invalidate_tags`, and their associated unused type annotations (`Callable`, `TypeVar`, `T`).
- **Safety Check Rationale:** Global search across entire repository confirmed 0 references to `get_or_set`, `invalidate_key`, or `invalidate_tags`. The active codebase exclusively uses `cache_service.get`, `cache_service.set`, `cache_service.invalidate_tag`, and `cache_service.clear`.
- **Action Taken:** Removed methods `get_or_set`, `invalidate_key`, and `invalidate_tags`. Cleaned `Callable`, `TypeVar`, and `T = TypeVar("T")` to prevent unused symbol warnings.

### 10. `backend/app/schemas.py`
- **Candidate Items:** Unreferenced Pydantic models `DonorCreate`, `ReceiverCreate`, `ThermographyTelemetry`, `FSSAIRuleEngineOut`.
- **Safety Check Rationale:** Donors and receivers are seeded directly via database scripts and never created through REST endpoints. `ThermographyTelemetry` and `FSSAIRuleEngineOut` are dead schemas with zero references across backend, frontend, or tests.
- **Action Taken:** Removed models `DonorCreate`, `ReceiverCreate`, `ThermographyTelemetry`, and `FSSAIRuleEngineOut`.

### 11. `frontend/src/services/api.ts`
- **Candidate Items:**
  - 8 unreferenced exported API wrapper functions: `getDispatchTrigger`, `getTelemetry`, `getSection80GTaxSlip`, `verifyTaxCertificate`, `getDonorPortal`, `getCourierPortal`, `getShelterPortal`, `getMunicipalPortal`.
  - 7 corresponding unused type imports: `Section80GTaxSlip`, `CourierTelemetry`, `TaxVerificationDocket`, `DonorPortalData`, `CourierPortalData`, `ShelterPortalData`, `MunicipalCommandData`.
- **Safety Check Rationale:**
  - Comprehensive regex search across all 48 frontend TypeScript files confirmed zero usages outside `api.ts`. Components receive these data structures via props or client-side simulations.
  - Because `tsconfig.json` enforces `"noUnusedLocals": true`, removing the 8 dead functions while keeping the 7 type imports would cause TypeScript compiler errors during `npm run build`. Removing both ensures 0 compiler errors and 0 runtime bloat.
- **Action Taken:** Removed the 8 unreferenced functions and 7 unused type imports.

---

## 4. Protected Assets Verification

| Asset | Role | Status Post-Cleanup |
|---|---|---|
| `backend/surpluspulse.db` | Primary SQLite live database | **INTACT** (126,976 bytes, verified table counts: donors=4, receivers=4, food_listings=6, pickups=4, tax_certificates=2, shelter_intakes=2) |
| `backend/tests/` (17 test files) | Backend pytest test suite & fixtures | **INTACT & UNMODIFIED** (0 files modified or deleted) |
| `frontend/src/test/` (15 test files) | Frontend vitest test suite & mocks | **INTACT & UNMODIFIED** (0 files modified or deleted) |
| Core application source | App modules, components, routers | **INTACT & CLEAN** |

---

## 5. Verification Commands and Canonical Results

### A. Backend Pytest
- **Directory:** `C:\building for codebas3e\backend`
- **Command:** `python -m pytest`
- **Result:**
  ```text
  ======================= 235 passed, 1 warning in 20.94s =======================
  ```
- **Exit Code:** `0` (100% pass rate, 235/235 tests passing)

### B. Frontend Vitest
- **Directory:** `C:\building for codebas3e\frontend`
- **Command:** `npm test -- --run`
- **Result:**
  ```text
  Test Files  15 passed (15)
       Tests  146 passed (146)
    Duration  7.07s
  ```
- **Exit Code:** `0` (100% pass rate, 146/146 tests passing)

### C. Frontend Production Build
- **Directory:** `C:\building for codebas3e\frontend`
- **Command:** `npm run build` (`tsc --noEmit && vite build`)
- **Result:**
  ```text
  vite v5.4.21 building for production...
  transforming...
  ✓ 1612 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                       1.57 kB │ gzip:   0.80 kB
  dist/assets/index-2wSQixGa.css       77.60 kB │ gzip:  17.46 kB
  dist/assets/icons-C6X8XtjC.js        24.05 kB │ gzip:   5.35 kB
  dist/assets/animations-BUvdtkoY.js   79.38 kB │ gzip:  31.19 kB
  dist/assets/vendor-DC-8Taon.js      133.93 kB │ gzip:  43.12 kB
  dist/assets/index-DIKIG4RW.js       469.54 kB │ gzip: 122.95 kB
  ✓ built in 3.29s
  ```
- **Exit Code:** `0` (0 TypeScript compiler errors, 0 build warnings/errors)

### D. Static Code Linting
- **Backend:** `python -m ruff check "C:\building for codebas3e\backend\app" --select F401,F841`
- **Result:**
  ```text
  All checks passed!
  ```
- **Exit Code:** `0` (0 unused imports, 0 unused variables across `backend/app`).
