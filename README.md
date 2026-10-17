# PulseBridge AI

PulseBridge AI is a clinical intelligence and care-coordination platform designed to bridge communication gaps among doctors, patients, and caregivers during post-consultation recovery.

> **Local Development**: Run `npm run dev` in the project root to start the Vite development server at `http://localhost:5173`. Quick role switchers are provided in the top navigation.

---

## Live Verification & Quality Assurance Report

*Timestamp: October 2026 | Branch: `main` | Commit: [`4c6c6fa`](https://github.com/vaishnavijha006-hub/PulseBridge/commit/4c6c6fa)*

### Test Suite Execution Summary
```bash
npm test -- --run
```
- **Test Files**: **13 passed (13 of 13 suites)**
- **Total Tests**: **188 passed | 10 skipped | 0 failed (198 tests)**
- **Test Execution Time**: ~13.32s

| Test Suite File | Tests Passed | Status | Coverage Scope |
| :--- | :---: | :---: | :--- |
| `src/services/familyConsentService.test.ts` | **15** |  Passed | Invitations, permissions, token hashing, audit log |
| `src/services/careActionService.test.ts` | **44** |  Passed | Lifecycle state machine, validation, overdue calculation |
| `src/services/familyConsentAuthorization.test.ts` | **54** |  Passed (10 skip)* | Granular permission boundary, email-token binding, fail-closed access |
| `src/services/voiceGuidanceService.test.ts` | **8** |  Passed | ElevenLabs speech synthesis, rate limits, audio caching |
| `src/pages/DoctorToPatientWorkflow.test.tsx` | **6** |  Passed | End-to-end doctor review, care-plan update, patient sync |
| `src/pages/AbhaIntegration.test.tsx` | **12** |  Passed | ABHA format validation, unverified tagging, intake flow |
| `src/pages/PhoneValidation.test.tsx` | **7** |  Passed | 10-digit phone number intake validation, error states |
| `src/utils/phone.test.ts` | **16** |  Passed | Phone normalization (+91, trunk 0), 10-digit rule |
| `src/components/ClosedLoopCareView.test.tsx` | **5** |  Passed | Closed-loop UI components, filter tabs, outcome modals |
| `src/components/VoiceGuidanceControl.test.tsx` | **7** |  Passed | Bilingual speech playback, accessibility attributes |
| `src/pages/PatientContextContinuity.test.tsx` | **5** |  Passed | Intake-to-dashboard identity continuity, demo fallback |
| `src/pages/FamilyRecoveryCircle.test.tsx` | **12** |  Passed | Family portal, timeline updates, notes, consent UI |
| `src/pages/Dashboards.test.tsx` | **7** |  Passed | Admin System Ops, Doctor Command Center, patient triage |
| **Total** | **188 passed** |  | *(10 database-level RLS skipped for live Supabase testing)* |

### TypeScript Compilation
```bash
npx tsc --noEmit -p tsconfig.app.json
```
- **Exit Code**: `0` (Zero compiler warnings or type errors across the entire codebase).

### Production Build
```bash
npm run build
```
- **Result**: Built successfully in `9.30s`.
- `dist/index.html`: `0.72 kB` (gzip: `0.39 kB`)
- `dist/assets/index.css`: `62.38 kB` (gzip: `10.90 kB`)
- `dist/assets/index.js`: `765.56 kB` (gzip: `192.86 kB`)

---

## Repository Architecture & Merged Branches

All 6 primary feature branches have been unified into `main` with zero merge conflicts:

| Branch Name | Primary Capability Integrated | Ancestry Status |
| :--- | :--- | :---: |
| **`main`** | Unified clinical platform, premium homepage redesign | `HEAD` |
| **`feature/closed-loop-care`** | 6-feature closed-loop care engine, CareGap radar, prescription scanner |  Merged |
| **`feature/consent-family-recovery-circle`** | Patient consent center, family companion portal, granular permissions |  Merged |
| **`feature/premium-ui-redesign`** | Clinical Command Center, Personal Companion, System Ops redesign |  Merged |
| **`feature/secure-ai-report-summarization`** | Edge AI summarization with Groq LLaMA 3.3 70B, doctor lock |  Merged |
| **`feature/report-summary-mvp`** | Safe diagnostic report parsing, lab findings comparison |  Merged |

---

## Core Platform Capabilities

### 1. Premium Clinical Intelligence Homepage
- **Architectural Dual Showcase**: Side-by-side interactive simulation of the **Doctor Clinical Command Center** (triage queue, prescription OCR verification, closed-loop actions) and the **Patient Companion** (dynamic medication schedule, adherence check-ins, family circle sync).
- **Engineering Capabilities Grid**: Highlights prescription OCR, closed-loop care engine, consent-driven recovery circle, and Hindi/English voice guidance.
- **ABHA & Safety Transparency**: Prominent amber disclosure panel detailing truthful ABHA support (format validation and database schema without claiming live unconfigured ABDM production verification).
- **Accessible Design**: Complies with `prefers-reduced-motion`, responsive across mobile/tablet/desktop, with semantic ARIA landmarks.

### 2. Truthful ABHA (Ayushman Bharat Health Account) Support Layer
- **Model**: Optional fields `abhaNumber`, `abhaAddress`, and `abhaVerificationStatus` (`'not_provided' | 'unverified' | 'verified'`).
- **Validation**: 14-digit format validation supporting standard hyphens (`12-3456-7890-1234`), normalized internally to clean digits.
- **Database Schema**: Supabase migration [`20261017000005_add_abha_patient_columns.sql`](supabase/migrations/20261017000005_add_abha_patient_columns.sql) added to persist ABHA fields backward-compatibly.
- **Honest UI**: Displays an explicit `ABHA (Unverified)` status tag in patient and doctor charts. Never displays a misleading green "Verified" badge without active ABDM gateway integration.

### 3. Patient Context Continuity & Doctor-to-Patient Workflow
- **Identity Retention**: When a patient completes the intake wizard, their unique record ID and profile persist across the application, preventing fallback to demo defaults.
- **Closed-Loop Workflow**: Doctors can search, filter, and review submitted patient profiles, review prescriptions with OCR doctor lock, and issue updated medication schedules that immediately reflect on the patient's companion dashboard.

### 4. Closed-Loop Care Action Tracking
- **State Machine**: Validates transitions: `open` &rarr; `in_progress` &rarr; `resolved` (requires mandatory outcome note) or `documented` (retains unresolved status for clinical monitoring).
- **Decoupled Architecture**: Actions link to identified CareGaps without mutating underlying EHR records or triage scores.
- **Overdue Detection**: Identifies missed deadlines and elevates overdue alerts without suppressing emergency symptom overrides.

### 5. Consent-Based Family Recovery Circle & Hardened RLS
- **Cryptographic Invitations**: SHA-256 token hashing with 7-day expiration and recipient email binding.
- **Granular Permissions**: Patients independently control sharing of profile, medications, vitals, appointments, care instructions, milestones, and direct calling.
- **Immediate Revocation**: One-click revocation cuts off all subsequent reads fail-closed.
- **Immutable Audit Trail**: Append-only log recording all invitation, grant, and revocation events.
- **Hardened RLS**: Supabase migration [`20261017000004_hardened_family_consent_authorization.sql`](supabase/migrations/20261017000004_hardened_family_consent_authorization.sql) replaces permissive policies with strict tenant isolation.

### 6. Bilingual Voice Guidance (English & Hindi)
- **ElevenLabs Speech Synthesis**: Natural bilingual audio guidance across patient intake and companion recovery.
- **Smart Audio Caching & Throttling**: Client-side audio buffer caching and debounce mechanisms to protect API rate limits.
- **Accessible Controls**: Screen-reader friendly play, pause, replay, and speed controls.

---

## Workspaces & Portals

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               PulseBridge AI Ecosystem                                 │
├────────────────────┬────────────────────┬──────────────────────────────┬───────────────┤
│  DOCTOR DASHBOARD  │ PATIENT DASHBOARD  │       ADMIN DASHBOARD        │ FAMILY CIRCLE │
│  Clinical Command  │  Personal Health   │      System Operations       │   Recovery    │
│       Center       │     Companion      │            Center            │   Companion   │
├────────────────────┼────────────────────┼──────────────────────────────┼───────────────┤
│ • Dark clinical    │ • Soft, reassuring │ • Technical slate / deep     │ • Warm family │
│   workspace theme  │   light aesthetic  │   navy operations console    │   companion   │
│ • Collapsible      │ • Recovery meter & │ • Live telemetry &           │ • Permitted   │
│   sidebar nav      │   progress ring    │   infrastructure status      │   recovery    │
│ • Emergency        │ • Daily dose cards │ • Role directory &           │   timeline    │
│   override banner  │   with snooze      │   permission matrix          │ • Check-in    │
│ • EHR chart tabs   │ • Daily health     │ • Security audit catalog &   │   support     │
│   & prescription   │   check-in & voice │   enterprise roadmap notes   │   notes       │
│   lock             │   guidance         │ • Store re-seed & JSON export│ • Fail-closed │
└────────────────────┴────────────────────┴──────────────────────────────┴───────────────┘
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation & Run
```bash
# Install dependencies
npm install

# Start development server on port 5173
npm run dev

# Run comprehensive test suite
npm test -- --run

# Run TypeScript typecheck
npx tsc --noEmit -p tsconfig.app.json

# Build for production
npm run build
```
