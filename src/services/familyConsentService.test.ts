import { describe, it, expect, beforeEach } from 'vitest';
import { familyConsentService } from './familyConsentService';

describe('FamilyConsentService (Consent-Based Family Recovery Circle)', () => {
  const PATIENT_ID = 'p1';

  beforeEach(() => {
    familyConsentService.resetToDemo();
  });

  it('lists existing family members for a patient', () => {
    const members = familyConsentService.listMembers(PATIENT_ID);
    expect(members.length).toBeGreaterThanOrEqual(1);
    expect(members.some((m) => m.caregiverName === 'Priya Sharma')).toBe(true);
  });

  it('allows a patient to invite a new family member with custom permissions', () => {
    const newMember = familyConsentService.inviteMember({
      patientId: PATIENT_ID,
      caregiverName: 'Sunita Sharma',
      relationship: 'Sister',
      contactNumber: '+91 91234 56789',
      permissions: {
        shareMedicationStatus: true,
        shareDailyVitals: false,
        allowDirectCalling: true,
        shareCareInstructions: false,
      },
    });

    expect(newMember.id).toBeDefined();
    expect(newMember.caregiverName).toBe('Sunita Sharma');
    expect(newMember.status).toBe('accepted');
    expect(newMember.authorized).toBe(true);
    expect(newMember.permissions.shareMedicationStatus).toBe(true);
    expect(newMember.permissions.shareDailyVitals).toBe(false);
    expect(newMember.inviteCode).toMatch(/^PB-REC-\d{4}$/);

    const members = familyConsentService.listMembers(PATIENT_ID);
    expect(members.some((m) => m.id === newMember.id)).toBe(true);
  });

  it('allows a patient to update granular permissions', () => {
    const member = familyConsentService.listMembers(PATIENT_ID)[0];
    const updated = familyConsentService.updatePermissions({
      patientId: PATIENT_ID,
      memberId: member.id,
      permissions: {
        shareDailyVitals: false,
        allowDirectCalling: false,
      },
    });

    expect(updated.permissions.shareDailyVitals).toBe(false);
    expect(updated.permissions.allowDirectCalling).toBe(false);
    expect(updated.permissions.shareMedicationStatus).toBe(true); // preserved
  });

  it('immediately revokes access when triggered by patient', () => {
    const member = familyConsentService.listMembers(PATIENT_ID)[0];
    const revoked = familyConsentService.revokeConsent(member.id, PATIENT_ID);

    expect(revoked.authorized).toBe(false);
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedAt).toBeDefined();

    // Verify fail-closed redacted family view for this member
    const view = familyConsentService.getGranularFamilyView(PATIENT_ID, member.id);
    expect(view.authorized).toBe(false);
    expect(view.dosesToday).toBeNull();
    expect(view.nextDoseTime).toBeNull();
    expect(view.healthUpdateStatus).toBeNull();
    expect(view.contactNumber).toBeNull();
    expect(view.careInstructions).toBeNull();
    expect(view.redactedReason).toContain('revoked');
  });

  it('restores access when re-authorized by patient', () => {
    const member = familyConsentService.listMembers(PATIENT_ID)[0];
    familyConsentService.revokeConsent(member.id, PATIENT_ID);
    const restored = familyConsentService.restoreConsent(member.id, PATIENT_ID);

    expect(restored.authorized).toBe(true);
    expect(restored.status).toBe('accepted');
    expect(restored.revokedAt).toBeNull();

    const view = familyConsentService.getGranularFamilyView(PATIENT_ID, member.id);
    expect(view.authorized).toBe(true);
    expect(view.dosesToday).not.toBeNull();
  });

  it('enforces granular fail-closed redaction per specific permission', () => {
    const member = familyConsentService.listMembers(PATIENT_ID)[0];

    // Turn off Medication Status & Direct Calling
    familyConsentService.updatePermissions({
      patientId: PATIENT_ID,
      memberId: member.id,
      permissions: {
        shareMedicationStatus: false,
        shareDailyVitals: true,
        allowDirectCalling: false,
        shareCareInstructions: true,
      },
    });

    const view = familyConsentService.getGranularFamilyView(PATIENT_ID, member.id);
    expect(view.authorized).toBe(true);
    // Medication status is redacted
    expect(view.dosesToday).toBeNull();
    expect(view.nextDoseTime).toBeNull();
    // Vitals are permitted
    expect(view.healthUpdateStatus).not.toBeNull();
    // Direct calling is redacted
    expect(view.contactNumber).toBeNull();
    // Instructions are permitted
    expect(view.careInstructions).toBeDefined();
    expect(view.careInstructions?.length).toBeGreaterThan(0);
  });

  it('handles family support messages', () => {
    const note = familyConsentService.sendSupportNote({
      patientId: PATIENT_ID,
      caregiverId: 'fcm_1',
      caregiverName: 'Priya Sharma',
      relationship: 'Daughter',
      message: 'Get well soon Papa! Have sent warm soup.',
    });

    expect(note.id).toBeDefined();
    expect(note.message).toBe('Get well soon Papa! Have sent warm soup.');

    const notes = familyConsentService.listSupportNotes(PATIENT_ID);
    expect(notes.some((n) => n.id === note.id)).toBe(true);
  });

  it('returns fail-closed redacted payload for unknown caregiver', () => {
    const view = familyConsentService.getGranularFamilyView(PATIENT_ID, 'non_existent_id');
    expect(view.authorized).toBe(false);
    expect(view.dosesToday).toBeNull();
    expect(view.healthUpdateStatus).toBeNull();
    expect(view.redactedReason).toBeDefined();
  });
});
