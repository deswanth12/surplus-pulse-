# SurplusPulse 🥗⚡
### Hyperlocal Food Rescue, Verified Cold-Chain Dispatch & ESG Carbon Accounting

[![Live App](https://img.shields.io/badge/Live%20App-Vercel-success?style=for-the-badge&logo=vercel)](https://surplus-pulse.vercel.app)
[![API Documentation](https://img.shields.io/badge/API%20Docs-FastAPI-blue?style=for-the-badge&logo=fastapi)](https://surplus-pulse-backend.onrender.com/docs)
[![Tests Passing](https://img.shields.io/badge/Tests-333%20Passed-brightgreen?style=for-the-badge&logo=pytest)](https://github.com/deswanth12/surplus-pulse-)
[![Hackathon](https://img.shields.io/badge/ACE%20Builders%202026-Codebenders%20×%20GigPoint-orange?style=for-the-badge)](https://gigpoint.in/codebenders-2026)

SurplusPulse is an automated urban food rescue operating system engineered to eliminate banquet and commercial kitchen waste. By combining an on-device Vision-Language Model (VLM), sub-millisecond proximity matching, and cryptographic Section 80G tax certification, SurplusPulse routes surplus food to nearby shelters before bacterial proliferation windows expire.

---

## 🌐 Live Production Deployments

* **Web Application:** [https://surplus-pulse.vercel.app](https://surplus-pulse.vercel.app)
* **Backend API & Interactive Swagger UI:** [https://surplus-pulse-backend.onrender.com/docs](https://surplus-pulse-backend.onrender.com/docs)
* **GitHub Repository:** [https://github.com/deswanth12/surplus-pulse-](https://github.com/deswanth12/surplus-pulse-)

---

## 🎯 The Problem & Our Solution

Every evening across urban centers, commercial banquet halls, caterers, and corporate campuses discard metric tons of prepared, high-protein meals due to coordination friction and food safety liabilities. Traditional donation methods rely on informal phone calls, delayed logistics, and zero safety auditing.

**SurplusPulse replaces manual coordination with a 4-stage automated pipeline:**

1. **Mirage VLM Quality Inspection:** 22MB on-device vision-language model inspects container sealing, visual freshness, thermal holding compliance (>65°C hot / <4°C cold), and computes FSSAI regulatory compliance.
2. **Dynamic Proximity Matching:** Calculates Haversine distances between food donors and registered shelter networks across Bengaluru (Koramangala, Indiranagar, Whitefield, etc.).
3. **Verified Courier Corridor:** Generates standardized 1-click WhatsApp and SMS dispatch briefs for EV delivery drivers and volunteer couriers.
4. **Cryptographic Section 80G & ESG Accounting:** Generates tamper-proof SHA-256 digital tax exemption certificates for commercial donors while calculating landfill mass diverted and carbon emissions ($CO_2e$) avoided.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SURPLUSPULSE ARCHITECTURE                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [ Commercial Donors ]           [ Volunteer Couriers ]    [ Shelters ]│
│   (Banquets / Caterers)           (EV Cargo Trikes / Auto)   (NGO Hubs) │
│            │                                  ▲                  ▲     │
│            ▼                                  │                  │     │
│   ┌──────────────────────────────────────────────────────────────┴─┐   │
│   │               React 18 + Vite + Tailwind Frontend              │   │
│   │                 (Hosted on Vercel Global Edge)                 │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Secure API Traffic (/api/*)        │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 FastAPI Core Backend Engine                    │   │
│   │                   (Hosted on Render Cloud)                     │   │
│   │                                                                │   │
│   │  • Auth Dependency: Fail-closed Bearer / X-API-Key token check │   │
│   │  • Mirage Inspector: 22MB On-device VLM for FSSAI verification │   │
│   │  • Dispatch Engine: Haversine distance & safe window tracking  │   │
│   │  • In-Memory TTL Cache: Sub-millisecond impact query serving   │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ WAL Mode Transactions              │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 SQLite with Write-Ahead Logging                │   │
│   │       (donors, receivers, listings, pickups, tax_certificates) │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Highlights & Technical Innovations

### 1. 22MB On-Device Mirage Vision-Language Model
* Evaluates food packaging, thermal urn sealing, and label timestamps.
* Enforces the FSSAI 4-Hour Safe Consumption Window (SCW) without external cloud inference costs.
* Generates synthetic thermographic readings and automated Form 68-A dispatch manifests.

### 2. High-Performance Multi-Role Portals
* **Donor Kitchen View:** Instant surplus logging, AI inspection upload, and 80G tax credit tracking.
* **Courier Dispatch View:** Active rescue dockets, live GPS telemetry, urn capacities, and navigation links.
* **Shelter Intake View:** Temperature verification on arrival, meal acceptance confirmation, and tamper checks.
* **Municipal ESG Command:** Real-time city-wide diversion metrics, methane avoidance calculations, and landfill statistics.

### 3. Cryptographically Verified Tax Exemption (Section 80G)
* Every completed donation issues an authentic digital certificate registered under Indian Income Tax Act Section 80G.
* Calculates fair market salvage valuation (₹65/meal standard rate) and corporate tax savings.
* Sealed with a deterministic SHA-256 verification hash and dynamic QR verification route.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Google Maps API |
| **Backend** | Python 3.12, FastAPI, Pydantic v2, Uvicorn |
| **Database** | SQLite3 with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) |
| **Edge & AI** | Cactus Compute Mirage VLM (On-device vision), In-memory TTL caching |
| **Infrastructure** | Vercel (Frontend Edge CDN), Render (Backend Python Web Service) |
| **Development Environment** | Codebenders IDE & Nexen AI Assistant |

---

## 🧪 Comprehensive Test Suite (333 Tests Passing)

SurplusPulse features an end-to-end automated test matrix covering security, concurrency, data integrity, and API contracts:

* **Backend Test Suite (Pytest):** 187 passing tests
  - Authentication fail-closed verification (`test_s1_s2_auth_seed_hardening.py`)
  - Concurrency & database WAL mode locking checks (`test_concurrency_and_hardening.py`)
  - Section 80G cryptographic certificate audit (`test_section_80g_tax_certificate.py`)
  - Mirage quality classification & FSSAI rules (`test_mirage_quality_classifier.py`)
* **Frontend Test Suite (Vitest):** 146 passing component and integration tests
* **Total:** **333/333 tests passing with 0 warnings**

---

## 🚀 Local Development Setup

### Prerequisites
* Python 3.10+
* Node.js 18+ and npm
* Git

### 1. Clone the Repository
```bash
git clone https://github.com/deswanth12/surplus-pulse-.git
cd surplus-pulse-
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Open [http://localhost:8000/docs](http://localhost:8000/docs) to view the interactive API documentation.

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) to interact with the application.

### 4. Running Automated Tests
```bash
# Run backend pytest suite:
pytest backend/tests -v

# Run frontend vitest suite:
cd frontend && npm test
```

---

## 🏆 Project Details

* **Event:** ACE BUILDERS 2026 (Codebenders × GigPoint, 21–22 November 2026)
* **Author:** Deswanth (Solo Developer, Windows 11 Workstation)
* **Tooling Environment:** Codebenders IDE & Nexen AI Assistant
* **Track:** Sustainable Civic Infrastructure / Hyperlocal Logistics