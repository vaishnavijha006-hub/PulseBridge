import type { DoseStatus, MedicationSchedule, DoseActionReason, Reminder, FollowUp } from '@/types';

export const GRACE_WINDOW_MINUTES = 20;
export const DEFAULT_SNOOZE_MINUTES = 10;

export interface DoseTimeStatus {
  isUpcoming: boolean;
  isInGracePeriod: boolean;
  isOverdue: boolean;
  isSnoozed: boolean;
  snoozeRemainingMinutes: number | null;
  scheduledDate: Date;
  graceEndDate: Date;
}

export const DOSE_REASON_OPTIONS: { id: DoseActionReason; labelKey: string; defaultLabel: string }[] = [
  { id: 'side_effect', labelKey: 'reason_side_effect', defaultLabel: 'Side effect experienced / तकलीफ़' },
  { id: 'medicine_unavailable', labelKey: 'reason_unavailable', defaultLabel: 'Medicine unavailable / दवा ख़त्म या उपलब्ध नहीं' },
  { id: 'forgot', labelKey: 'reason_forgot', defaultLabel: 'Forgot scheduled dose / भूल गए' },
  { id: 'doctor_advised_stop', labelKey: 'reason_doctor_stopped', defaultLabel: 'Doctor advised pause / डॉक्टर ने मना किया' },
  { id: 'other', labelKey: 'reason_other', defaultLabel: 'Other reason / अन्य कारण' },
];

/**
 * Parses an HH:MM time string into a Date object for today.
 */
export function parseScheduleTimeToDate(timeStr: string, referenceDate: Date = new Date()): Date {
  const [hours, minutes] = timeStr.split(':').map((n) => parseInt(n, 10) || 0);
  const target = new Date(referenceDate);
  target.setHours(hours, minutes, 0, 0);
  return target;
}

/**
 * Calculates current timing status for a scheduled medication dose.
 * Rule: Pending before due time and during the 20-minute grace window.
 * If unacknowledged past grace window, evaluated as overdue.
 */
export function evaluateDoseTiming(
  schedule: MedicationSchedule,
  now: Date = new Date()
): DoseTimeStatus {
  const scheduledDate = parseScheduleTimeToDate(schedule.scheduledTime, now);
  const graceEndDate = new Date(scheduledDate.getTime() + GRACE_WINDOW_MINUTES * 60 * 1000);

  // Check active snooze
  let isSnoozed = false;
  let snoozeRemainingMinutes: number | null = null;

  if (schedule.status === 'snoozed' && schedule.snoozedUntil) {
    const snoozeEnd = new Date(schedule.snoozedUntil);
    if (now.getTime() < snoozeEnd.getTime()) {
      isSnoozed = true;
      snoozeRemainingMinutes = Math.max(1, Math.ceil((snoozeEnd.getTime() - now.getTime()) / 60000));
    }
  }

  const isUpcoming = now.getTime() < scheduledDate.getTime();
  const isInGracePeriod = now.getTime() >= scheduledDate.getTime() && now.getTime() <= graceEndDate.getTime();
  const isOverdue =
    (schedule.status === 'pending' || (schedule.status === 'snoozed' && !isSnoozed)) &&
    now.getTime() > graceEndDate.getTime();

  return {
    isUpcoming,
    isInGracePeriod,
    isOverdue,
    isSnoozed,
    snoozeRemainingMinutes,
    scheduledDate,
    graceEndDate,
  };
}

/**
 * Calculates snooze ISO timestamp for a dose without permanently altering the prescribed schedule.
 */
export function calculateSnoozeTimestamp(minutes: number = DEFAULT_SNOOZE_MINUTES): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/**
 * Evaluates whether any pending schedules in a list should be flagged as overdue.
 */
export function applyOverdueEvaluations(
  schedules: MedicationSchedule[],
  now: Date = new Date()
): { schedules: MedicationSchedule[]; overdueCount: number } {
  let overdueCount = 0;

  const updated = schedules.map((s) => {
    if (s.status !== 'pending' && s.status !== 'snoozed') {
      return s;
    }

    const timing = evaluateDoseTiming(s, now);
    if (timing.isOverdue) {
      overdueCount++;
      // Mark as missed/overdue according to agreed demo rule
      return {
        ...s,
        status: 'missed' as DoseStatus,
        reason: s.reason || 'Overdue (exceeded 20-min grace window)',
      };
    }
    return s;
  });

  return { schedules: updated, overdueCount };
}

/**
 * Generates structured in-app reminders for medication schedules and pending clinical follow-ups.
 *
 * Rules:
 * 1. Doses in the 20-min grace window: type 'dose' (Due Now).
 * 2. Unacknowledged doses > 20 min past scheduled time: type 'missed_dose', escalated: true.
 * 3. Snoozed doses: reminder with remaining snooze minutes.
 * 4. Pending follow-ups: type 'followup'.
 * 5. Channel: strictly labeled 'in_app_simulated' (external SMS/Push delivery requires carrier gateway).
 * 6. Deduplication: returns exactly one unique reminder per schedule item.
 */
export function generateReminders(
  schedules: MedicationSchedule[],
  followUps: FollowUp[] = [],
  now: Date = new Date()
): Reminder[] {
  const reminders: Reminder[] = [];
  const seenScheduleIds = new Set<string>();

  for (const schedule of schedules) {
    if (seenScheduleIds.has(schedule.id)) continue;
    seenScheduleIds.add(schedule.id);

    // Skip already taken or confirmed doses
    if (schedule.status === 'taken' || schedule.status === 'cannot_take') {
      continue;
    }

    const timing = evaluateDoseTiming(schedule, now);

    if (timing.isOverdue || schedule.status === 'missed') {
      // Escalated missed-dose reminder (> 20 min grace window exceeded)
      reminders.push({
        id: `rem-missed-${schedule.id}`,
        patientId: schedule.patientId || 'p1',
        scheduleId: schedule.id,
        type: 'missed_dose',
        message: `ESCALATION ALERT: Missed dose of ${schedule.medicineName} (${schedule.dosage}) scheduled for ${schedule.scheduledTime}. 20-minute grace window expired.`,
        scheduledFor: timing.scheduledDate.toISOString(),
        acknowledged: false,
        escalated: true,
        channel: 'in_app_simulated',
      });
    } else if (timing.isInGracePeriod || schedule.status === 'pending') {
      if (now.getTime() >= timing.scheduledDate.getTime()) {
        // Due Now reminder
        reminders.push({
          id: `rem-due-${schedule.id}`,
          patientId: schedule.patientId || 'p1',
          scheduleId: schedule.id,
          type: 'dose',
          message: `Dose Due Now: ${schedule.medicineName} (${schedule.dosage}) scheduled for ${schedule.scheduledTime}. Grace period: 20 minutes.`,
          scheduledFor: timing.scheduledDate.toISOString(),
          acknowledged: false,
          escalated: false,
          channel: 'in_app_simulated',
        });
      }
    } else if (timing.isSnoozed) {
      reminders.push({
        id: `rem-snooze-${schedule.id}`,
        patientId: schedule.patientId || 'p1',
        scheduleId: schedule.id,
        type: 'dose',
        message: `Snoozed: ${schedule.medicineName} (${schedule.dosage}) will remind again in ${timing.snoozeRemainingMinutes || 10} minute(s).`,
        scheduledFor: timing.scheduledDate.toISOString(),
        acknowledged: false,
        escalated: false,
        channel: 'in_app_simulated',
      });
    }
  }

  // Pending follow-up reminders
  for (const fu of followUps) {
    if (fu.status === 'pending') {
      reminders.push({
        id: `rem-fu-${fu.id}`,
        patientId: fu.patientId,
        type: 'followup',
        message: `Doctor Follow-up Question Pending: "${fu.question}"`,
        scheduledFor: fu.askedAt,
        acknowledged: false,
        escalated: false,
        channel: 'in_app_simulated',
      });
    }
  }

  return reminders;
}

