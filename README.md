# PulseBridge

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-6ykwyue8)

PulseBridge is an AI-augmented care-coordination platform designed to bridge communication gaps among doctors, patients, and caregivers during post-consultation recovery.

---

## Closed-Loop Care Action Tracking

### Purpose
The **Closed-Loop Care Action Tracking and Resolution Workflow** addresses clinical follow-up drop-offs by providing structured task lifecycle tracking for identified care gaps and clinical follow-ups. In post-consultation management, identified issues (such as missed doses, new or worsening symptoms, uncertain lab findings, or overdue reviews) require accountable tracking until either fully resolved or clinically documented.

### Action Lifecycle & State Machine
Every care action proceeds through an explicitly validated state machine:

```
          ┌───────────────────────────────────┐
          │                                   ▼
[ open ] ───► [ in_progress ] ─────────► [ resolved ]
   │              │                           │
   │              ▼                           │ (reopen with justification)
   └───────► [ documented ]                   ▼
                  │                    [ in_progress ]
                  └───────────────────────────┘
```

1. **`open`**: The action has been identified (manually or prompted by an existing care gap) but work has not yet started. Every new action strictly defaults to `open`.
2. **`in_progress`**: A care team member (doctor, nurse, coordinator, caregiver, pharmacist) is actively working on the task.
3. **`resolved`**: The required intervention is complete and a verified clinical outcome has been recorded.
   - **Validation Rule**: Transition to `resolved` strictly requires a meaningful, non-empty `outcomeNote`. Submissions without an outcome note are rejected with an informative error.
   - Recording an outcome sets the `resolvedAt` timestamp and updates `updatedAt`.
   - Re-opening a `resolved` action back to `in_progress` is restricted and strictly requires an explicit clinical justification (`reopenJustification`).
4. **`documented`**: A clinical decision or interim finding has been recorded (`documentedDecision`), but the underlying condition or action is **not** marked as cured or resolved.
   - **Crucial Distinction**: `documented` differs from `resolved`. Documenting an action preserves its visibility as **unresolved** for clinical monitoring, preventing premature closure of care issues.

### Linking to CareGap Radar (Decoupled & Non-Mutating)
Care actions can be linked to existing care gaps (e.g., new symptoms, missing severity, repeated missed doses, allergy conflicts, or overdue updates) via optional `careGapId` references:
- **Decoupled Architecture**: Creating an action does **not** resolve or alter the care gap.
- **No Side-Effect Mutation**: Resolving or documenting an action does **not** modify or delete the linked CareGap record, prescription drafts, patient records, or triage priority scores.
- **Reference-Only Context**: The UI displays the linked care gap's evidence, but explicitly notes that completing an action does not discharge the underlying care gap or diagnostic uncertainty without independent review.

### Visibility of Overdue & Unresolved Actions
- **Unresolved Actions Monitoring**: All actions in `open`, `in_progress`, or `documented` states remain continuously visible in active queues. They are never prematurely hidden upon note entry.
- **Overdue Detection**: Actions with a `dueDate` prior to the current timestamp that are not in `resolved` status are flagged as **OVERDUE** with high-visibility badges and an aggregate overdue alert banner.
- **Preservation of Critical Warnings & Overrides**: Critical alerts, emergency overrides, and urgent priority badges are strictly preserved and never suppressed, minimized, or dismissed when an action is updated, documented, or resolved.

### Safety & Clinical Disclaimers
- **Notes Are Not Proof of Care**: An outcome note or documented clinical decision alone does not constitute proof that clinical work was completed. It serves as an audit trail for the care team.
- **Uncertain Findings**: Uncertain laboratory or prescription readings remain uncertain until formal clinical review.

### Component & Module Architecture
- **Types**: [`src/types/careAction.ts`](src/types/careAction.ts) — domain model, roles (`doctor`, `nurse`, `care_coordinator`, `caregiver`, `pharmacist`, `other`), priorities (`urgent`, `high`, `routine`), lifecycle statuses, and input payloads.
- **Service**: [`src/services/careActionService.ts`](src/services/careActionService.ts) — in-memory reactive store, deterministic validation engine (`validateNewAction`, `validateTransition`), overdue calculator (`isActionOverdue`), and unresolved checker (`isActionUnresolved`).
- **Seed Data**: [`src/data/demoCareActions.ts`](src/data/demoCareActions.ts) — realistic clinical demo actions across multiple patient profiles (`p1`, `p2`, `p4`).
- **UI Components**:
  - [`src/components/ClosedLoopCareView.tsx`](src/components/ClosedLoopCareView.tsx) — primary interactive care action tracker featuring action list, filter tabs, modal workflows for status transition, resolution note capture, decision documentation, re-opening with justification, and overdue warnings.
  - [`src/components/CareActionTracker.tsx`](src/components/CareActionTracker.tsx) — modular facade component enabling drop-in integration by other developers into the Doctor Dashboard or patient views.

### Persistence Model & Limitations
- **Current Persistence**: In-memory demo store for the active browser session. Changes persist across component unmounts in the session, but reset on full page reload.
- **Database Status**: Remote Supabase database tables and migrations exist for core schema, but closed-loop actions currently utilize the client-side reactive store pending production backend endpoint wiring.

---

## Contribution Details

### My Contribution: Closed-Loop Care Action Tracking
My responsibility in PulseBridge is **Part B: Closed-Loop Care — Action Tracking and Resolution Workflow**:
- Implemented and verified the complete care action domain model, lifecycle validation rules, and deterministic state transitions.
- Designed and verified resolution outcome enforcement requiring non-empty outcome notes before an action can transition to `resolved`.
- Established the distinction between `documented` (clinical decision recorded, remains unresolved for ongoing monitoring) and `resolved` (intervention completed).
- Built comprehensive automated verification test suites (Vitest unit test suite with 41 assertions and TSX verification script with 50 assertions) covering all 12 criteria: lifecycle states, transition rejection, note preservation, overdue flags, malformed data safety, and strict decoupling from CareGap mutation and triage scores.
- Implemented the modular, responsive React component and facade (`ClosedLoopCareView.tsx` / `CareActionTracker.tsx`) with accessible controls, status badges, overdue alerts, and filter tabs.

*Note: This contribution is scoped specifically to Part B (Closed-Loop Care). It does not claim implementation of the initial repository setup, medical report summarization MVP, live remote ABDM/ABHA integration, HIPAA compliance, or persistent database storage beyond the verified local in-memory capabilities.*

---

## Verification & Testing

The implementation was verified using the following automated commands:

1. **Unit Test Suite (Vitest)**:
   ```bash
   npm run test
   ```
   *Result: 41/41 unit tests passing across all lifecycle, validation, and safety isolation scenarios.*

2. **Integration Verification Suite (TSX Script)**:
   ```bash
   npm run test:care-actions
   ```
   *Result: 50/50 test criteria passing, verifying all 12 clinical safety requirements, triage immutability, and gap decoupling.*

3. **TypeScript Typecheck**:
   ```bash
   npm run typecheck
   ```
   *Result: Clean, 0 type errors with strict typechecking enabled.*

4. **Production Build**:
   ```bash
   npm run build
   ```
   *Result: Vite production build completed successfully with all modules bundled.*

---

## Advanced Premium UI/UX Redesign — All Three Dashboards

### 1. Design Vision & Architectural Differentiation
PulseBridge AI features **three distinct visual identities and user experiences** tailored specifically for clinical, patient, and operational workflows while maintaining shared brand cohesion:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PulseBridge AI Ecosystem                        │
├────────────────────┬────────────────────┬──────────────────────────────┤
│  DOCTOR DASHBOARD  │ PATIENT DASHBOARD  │       ADMIN DASHBOARD        │
│  Clinical Command  │  Personal Health   │      System Operations       │
│       Center       │     Companion      │            Center            │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ • Dark clinical    │ • Soft, reassuring │ • Technical slate / deep     │
│   workspace theme  │   light aesthetic  │   navy operations console    │
│ • Collapsible      │ • Generous spacing │ • Live telemetry &           │
│   sidebar nav      │   & warm cards     │   infrastructure status      │
│ • Emergency        │ • Recovery meter & │ • Role directory &           │
│   override strip   │   progress ring    │   permission matrix          │
│ • Integrated EHR   │ • Minimal jargon,  │ • Security audit catalog &   │
│   actions & labs   │   accessible labs  │   enterprise roadmap notes   │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

#### A. Doctor Dashboard — Clinical Command Center ([`src/pages/DoctorDashboard.tsx`](src/pages/DoctorDashboard.tsx))
- **Collapsible Clinical Navigation**: Professional sidebar toggleable between compact icon mode and expanded navigation with real-time badges for urgent triage alerts, open care gaps, pending actions, and pending prescriptions.
- **Critical Safety Override Banner**: High-priority clinical alert strip prominently placed at the top whenever an emergency symptom (e.g. chest heaviness) or severe allergy conflict is detected. Guarantees immediate physician review without cosmetic click-away dismissals.
- **Patient Detail (EHR Chart Mode)**: 5 comprehensive clinical tabs covering Overview (triage score breakdown & heuristics), Prescription Verification (`PrescriptionReview`), Diagnostic Reports & AI (`ReportSummaryView`), Closed-Loop Care Actions (`ClosedLoopCareView`), and Care Gaps (`CareGapCard`).

#### B. Patient Dashboard — Personal Health Companion ([`src/pages/PatientDashboard.tsx`](src/pages/PatientDashboard.tsx))
- **Reassuring Personal Hero**: Warm greeting with a visual recovery progress bar indicating daily medication completion percentage and next upcoming dose.
- **Gentle Grace Period Visibility**: Accessible notice explaining the 20-minute gentle grace window for scheduled doses.
- **Today's Medicines (`DoseCard`)**: High-contrast, friendly dose cards with intuitive action buttons (Taken, Snooze 10m, and Cannot Take with structured reason selector).
- **My Medical Reports & Instructions**: Accessible tab allowing patients to view doctor-approved test summaries and care instructions without intimidating clinical abbreviations.
- **Daily Health Check-in**: Expressive feeling buttons (Feeling Good, Okay, Unwell) with instant confirmation and feedback.

#### C. Admin Dashboard — System Operations Center ([`src/pages/AdminDashboard.tsx`](src/pages/AdminDashboard.tsx))
- **Real Operational Telemetry**: Displays real-time database connectivity (Supabase Cloud or Secure Local Edge Adapter), Groq LLaMA 3.3 70B AI edge summarizer status, and object storage bucket health.
- **Role & Access Directory**: Transparent table of configured personas (`Dr. S. Sharma`, `Ravi Sharma`, `Priya Daughter`, `System Admin`) and their permission matrix.
- **Security & Compliance Audit**: Interactive security catalog validating Row Level Security (RLS) enforcement across 9 tables, AI grounding fail-closed authorization, and emergency override immunity.
- **Honest Roadmap Representation**: Clearly labels unimplemented enterprise capabilities (e.g. Enterprise IAM & Single Sign-On SSO) without fake non-working controls.
- **Diagnostic Export & Store Re-seed**: One-click telemetry JSON export and certified demo action store re-seeding.

### 2. Advanced Bilingual System (English + Hindi)
- **Centralized Translation Architecture**: [`src/i18n/translations.ts`](src/i18n/translations.ts) and [`src/i18n/LanguageContext.tsx`](src/i18n/LanguageContext.tsx).
- **Default Language & Persistence**: Defaults to English (`en`) with automatic persistence in browser `localStorage` (`pulsebridge_lang`).
- **Comprehensive Coverage**: Natural Hindi translations across all navigation items, role cards, action labels, status badges, emergency banners, telemetry cards, and empty states.
- **Clinical Data Integrity**: Patient identifiers, medication names, dosages, timestamps, and raw laboratory pathology texts remain unmutated to ensure clinical safety.

### 3. Verification & Quality Assurance
- **Unit & Integration Tests**: `npm run test` &rarr; **56/56 passing tests** across 3 test suites:
  - [`careActionService.test.ts`](src/services/careActionService.test.ts) (44 tests)
  - [`ClosedLoopCareView.test.tsx`](src/components/ClosedLoopCareView.test.tsx) (5 tests)
  - [`Dashboards.test.tsx`](src/pages/Dashboards.test.tsx) (7 tests)
- **TypeScript Typecheck**: `npm run typecheck` &rarr; **0 errors**.
- **Production Build**: `npm run build` &rarr; **Successfully built with Vite**.

