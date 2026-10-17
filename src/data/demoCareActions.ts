/**
 * Seed data for Closed-Loop Care Actions
 * PulseBridge AI Phase 4
 */

import type { CareAction } from '@/types/careAction';

export const demoCareActions: CareAction[] = [
  {
    id: 'act-p1-1',
    patientId: 'p1',
    careGapId: 'g1',
    title: 'Urgent Cardiology Teleconsult & 12-Lead ECG Requisition',
    description: 'Patient reported chest heaviness since morning. Arrange priority tele-triage with on-call cardiologist and advise emergency protocol if symptoms worsen.',
    assignedRole: 'doctor',
    assignedTo: 'Dr. Anita Desai',
    priority: 'urgent',
    status: 'in_progress',
    dueDate: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), // Due in 2 hours
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
  },
  {
    id: 'act-p1-2',
    patientId: 'p1',
    careGapId: 'g2',
    title: 'Metformin GI Tolerance Assessment & Reminder Adjustment',
    description: 'Investigate 2 missed doses of Metformin. Check if patient experienced nausea or diarrhea and counsel taking with substantial meals.',
    assignedRole: 'nurse',
    assignedTo: 'Nurse Meena',
    priority: 'high',
    status: 'open',
    dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
  },
  {
    id: 'act-p1-3',
    patientId: 'p1',
    careGapId: null, // Standalone care team action
    title: 'Baseline Serum Electrolytes & Renal Panel Lab Booking',
    description: 'Schedule routine phlebotomy visit for potassium and creatinine check following recent medication adjustments.',
    assignedRole: 'care_coordinator',
    assignedTo: 'Rahul Care Desk',
    priority: 'routine',
    status: 'open',
    dueDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 48 hours overdue!
    createdAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
  },
  {
    id: 'act-p2-1',
    patientId: 'p2',
    careGapId: 'g3',
    title: 'Capture Visual Analogue Pain Scale (1-10) for Knee Arthralgia',
    description: 'Follow up with patient to quantify reported knee discomfort and assess mobility limitations.',
    assignedRole: 'nurse',
    assignedTo: 'Nurse Priya',
    priority: 'routine',
    status: 'resolved',
    dueDate: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    outcomeNote: 'Telephonic follow-up completed. Patient rated pain as 4/10 upon walking, relieved with rest. Advised knee brace and daily mild quadriceps stretching; will re-evaluate at 2-week checkup.',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
  },
  {
    id: 'act-p4-1',
    patientId: 'p4',
    careGapId: 'g5',
    title: 'Evaluate Glimepiride Cross-Reactivity Risk in Sulfa-Allergic Patient',
    description: 'Patient has documented Sulfa allergy. Assess cross-allergenicity between sulfonamide antimicrobials and sulfonylurea oral hypoglycemics.',
    assignedRole: 'doctor',
    assignedTo: 'Dr. V. Gupta',
    priority: 'urgent',
    status: 'documented',
    dueDate: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    documentedDecision: 'Literature review and clinical history confirm patient has tolerated glimepiride for 18+ months without cutaneous or systemic reaction. The arylamine moiety responsible for antibiotic sulfa allergy is absent in sulfonylureas. Clinical decision: Continue glimepiride under close caregiver rash-vigilance; do not abruptly discontinue.',
    createdAt: new Date(Date.now() - 1800 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 600 * 1000).toISOString(),
    documentedAt: new Date(Date.now() - 600 * 1000).toISOString(),
    followUpNote: 'Caregiver instructed to report any immediate erythema or pruritus.',
  },
];
