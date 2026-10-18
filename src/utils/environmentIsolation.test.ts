import { describe, it, expect } from 'vitest';
import { isDemoMode, supabase } from '@/lib/supabase';
import { dataService } from '@/services/dataService';

describe('Hermetic Test Environment Isolation Regression', () => {
  it('enforces Demo Mode during test execution so unit tests never alter live Supabase data', () => {
    expect(isDemoMode).toBe(true);
    expect(dataService.mode).toBe('demo');
    expect(supabase).toBeNull();
  });

  it('guarantees dataService.savePatientIntake persists in-memory without network dependency', async () => {
    const testPatient = {
      name: 'Regression Test Patient',
      age: 45,
      gender: 'male' as const,
      phone: '+91 98765 43210',
    };

    const res = await dataService.savePatientIntake(testPatient);
    expect('data' in res).toBe(true);
    if ('data' in res) {
      expect(res.data.id).toMatch(/^p-/);
      expect(res.data.name).toBe('Regression Test Patient');
      expect(res.data.phone).toBe('9876543210');
    }
  });
});
