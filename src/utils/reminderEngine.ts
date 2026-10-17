import type { DoseStatus, MedicationSchedule, DoseActionReason } from '@/types';

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
