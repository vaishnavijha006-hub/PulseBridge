/**
 * Closed-Loop Care — CareActionTracker
 *
 * Facade component providing compatibility for CareActionTracker
 * while delegating to the comprehensive ClosedLoopCareView implementation.
 */

import { ClosedLoopCareView } from './ClosedLoopCareView';
import type { CareGap } from '@/types';

export interface CareActionTrackerProps {
  patientId?: string;
  patientName?: string;
  linkedCareGaps?: CareGap[];
  className?: string;
}

export function CareActionTracker({
  patientId = 'p1',
  patientName,
  linkedCareGaps,
  className,
}: CareActionTrackerProps) {
  return (
    <ClosedLoopCareView
      patientId={patientId}
      patientName={patientName}
      careGaps={linkedCareGaps}
      className={className}
    />
  );
}

export { ClosedLoopCareView };
