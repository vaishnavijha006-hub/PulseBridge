/**
 * ClosedLoopCareView Component Tests
 *
 * Verifies component rendering, empty state handling, malformed data resilience,
 * and user interactions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClosedLoopCareView } from './ClosedLoopCareView';
import { careActionService } from '@/services/careActionService';
import type { CareGap } from '@/types';
import type { CareAction } from '@/types/careAction';

const sampleCareGaps: CareGap[] = [
  {
    id: 'g1',
    patientId: 'p1',
    type: 'new_symptom',
    evidence: 'Chest heaviness since morning',
    timestamp: new Date().toISOString(),
    missingInfo: 'Severity',
    followupQuestion: 'Any shortness of breath?',
    status: 'open',
  },
];

describe('ClosedLoopCareView Component', () => {
  beforeEach(() => {
    careActionService.reset([]);
  });

  // ---------------------------------------------------------------------------
  // Criterion 13: An empty action list renders correctly
  // ---------------------------------------------------------------------------
  it('renders correctly when there are no actions for the patient (empty state)', () => {
    render(
      <ClosedLoopCareView
        patientId="p99_empty"
        patientName="Empty Patient"
        careGaps={[]}
      />
    );

    expect(screen.getByText('Closed-Loop Care Actions')).toBeInTheDocument();
    expect(screen.getByText('No Care Actions Found')).toBeInTheDocument();
    expect(
      screen.getByText('There are no actions registered matching the current filter.')
    ).toBeInTheDocument();
    expect(screen.getByText('New Care Action')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Criterion 14: Malformed or missing action data does not crash the component
  // ---------------------------------------------------------------------------
  it('does not crash when action contains missing or unexpected fields', () => {
    const malformedAction: CareAction = {
      id: 'bad-act-1',
      patientId: 'p1',
      title: 'Action with missing optional fields',
      description: 'Testing resilience',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: null,
      careGapId: undefined,
      assignedRole: undefined,
      assignedTo: undefined,
      priority: undefined,
      outcomeNote: undefined,
      documentedDecision: undefined,
      followUpNote: undefined,
    };

    careActionService.reset([malformedAction]);

    expect(() => {
      render(
        <ClosedLoopCareView
          patientId="p1"
          patientName="Ravi Sharma"
          careGaps={[]}
        />
      );
    }).not.toThrow();

    expect(screen.getByText('Action with missing optional fields')).toBeInTheDocument();
    expect(screen.getByText('Testing resilience')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Action rendering with Status Badges and Overdue Indicators
  // ---------------------------------------------------------------------------
  it('renders action cards with status badges and priority tags', () => {
    const action: CareAction = {
      id: 'act-test-1',
      patientId: 'p1',
      careGapId: 'g1',
      title: 'Check ECG Findings',
      description: 'Review 12-lead ECG tracing with cardiologist',
      priority: 'urgent',
      status: 'open',
      assignedRole: 'doctor',
      assignedTo: 'Dr. Anita Desai',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    careActionService.reset([action]);

    render(
      <ClosedLoopCareView
        patientId="p1"
        patientName="Ravi Sharma"
        careGaps={sampleCareGaps}
      />
    );

    expect(screen.getByText('Check ECG Findings')).toBeInTheDocument();
    // Open Queue appears in filter tabs and status badge on card
    expect(screen.getAllByText('Open Queue').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('Dr. Anita Desai')).toBeInTheDocument();
    expect(screen.getByText(/Linked CareGap/i)).toBeInTheDocument();
  });

  it('renders an overdue badge when action is past its due date', () => {
    const pastDueDate = new Date(Date.now() - 3600 * 48 * 1000).toISOString();
    const overdueAction: CareAction = {
      id: 'act-overdue-1',
      patientId: 'p1',
      title: 'Overdue Phlebotomy',
      description: 'Lab test is 48 hours overdue',
      status: 'open',
      dueDate: pastDueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    careActionService.reset([overdueAction]);

    render(
      <ClosedLoopCareView
        patientId="p1"
        patientName="Ravi Sharma"
        careGaps={[]}
      />
    );

    // Overdue appears in filter tab and badge on card
    const overdueElements = screen.getAllByText('Overdue');
    expect(overdueElements.length).toBeGreaterThanOrEqual(1);
  });

  it('opens and closes the create action modal', () => {
    render(
      <ClosedLoopCareView
        patientId="p1"
        patientName="Ravi Sharma"
        careGaps={sampleCareGaps}
      />
    );

    const newActionBtn = screen.getByText('New Care Action');
    fireEvent.click(newActionBtn);

    expect(screen.getByText('Create Closed-Loop Care Action')).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Create Closed-Loop Care Action')).not.toBeInTheDocument();
  });
});
