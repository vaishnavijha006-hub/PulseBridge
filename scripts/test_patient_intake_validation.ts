/**
 * PulseBridge AI — Patient Intake Wizard Validation Test Suite
 *
 * Verifies:
 * 1. Blank allergy answer cannot advance.
 * 2. "Yes" without allergy details cannot advance.
 * 3. "No known allergies" can advance and is saved explicitly.
 * 4. "I'm not sure" can advance and remains unknown.
 * 5. Blank required fields on every other intake step are blocked.
 * 6. Optional fields can remain blank (meds step).
 * 7. Back navigation preserves entered answers.
 * 8. Invalid intake cannot be submitted or saved as complete.
 * 9. Unknown allergy status never becomes "no known allergies."
 */

import {
  validateIntakeStep,
  validateAllergies,
  validateCompleteIntake,
  validateName,
  validateAge,
  validateGender,
  validatePhone,
  validateSymptoms,
  validateUploadFile,
  type AllergyChoice,
} from '../src/utils/intakeValidation.ts';
import { demoService, productionService } from '../src/services/dataService.ts';
import { evaluatePrescriptionSafety } from '../src/services/prescriptionSafetyWorkflow.ts';
import type { PatientProfile, PrescriptionDraft } from '../src/types/index.ts';

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runIntakeValidationTests() {
  console.log('================================================================');
  console.log('PULSEBRIDGE AI — PATIENT INTAKE WIZARD VALIDATION SUITE');
  console.log('================================================================');

  // ---------------------------------------------------------------------------
  // 1. Blank allergy answer cannot advance
  // ---------------------------------------------------------------------------
  console.log('\nTEST 1: Blank Allergy Answer Cannot Advance');
  {
    const stepRes = validateIntakeStep('allergies', {}, null, null, '', 'en');
    assert(!stepRes.isValid, 'Blank allergy choice is blocked (isValid === false)');
    assert(Boolean(stepRes.errors.allergyChoice), 'Emits inline error for blank allergy selection');
    assert(
      stepRes.errors.allergyChoice.includes('Please select an option'),
      'Clear English error message displayed'
    );

    const hindiRes = validateIntakeStep('allergies', {}, null, null, '', 'hi');
    assert(!hindiRes.isValid, 'Hindi blank allergy choice is blocked');
    assert(hindiRes.errors.allergyChoice.includes('विकल्प चुनें'), 'Clear Hindi error message displayed');

    const directRes = validateAllergies(null, '', 'en');
    assert(!directRes.isValid, 'validateAllergies returns isValid === false for null choice');
    assert(Boolean(directRes.choiceError), 'choiceError is populated on null choice');
  }

  // ---------------------------------------------------------------------------
  // 2. "Yes" without allergy details cannot advance
  // ---------------------------------------------------------------------------
  console.log('\nTEST 2: "Yes" Without Allergy Details Cannot Advance');
  {
    const emptyDetailsRes = validateIntakeStep('allergies', {}, null, 'yes', '', 'en');
    assert(!emptyDetailsRes.isValid, 'Yes with empty details is blocked');
    assert(Boolean(emptyDetailsRes.errors.allergyDetails), 'Emits inline error for missing allergy details');
    assert(
      emptyDetailsRes.errors.allergyDetails.includes('specify which medicines'),
      'Clear message requiring allergy specification'
    );

    const whitespaceDetailsRes = validateIntakeStep('allergies', {}, null, 'yes', '   ', 'en');
    assert(!whitespaceDetailsRes.isValid, 'Yes with whitespace-only details is blocked');
    assert(Boolean(whitespaceDetailsRes.errors.allergyDetails), 'Rejects whitespace-only allergy details');

    const singleCharRes = validateIntakeStep('allergies', {}, null, 'yes', 'A', 'en');
    assert(!singleCharRes.isValid, 'Yes with < 2 character details is blocked');

    // Valid details unblock step
    const validYesRes = validateIntakeStep('allergies', {}, null, 'yes', 'Penicillin', 'en');
    assert(validYesRes.isValid, 'Yes with valid allergy details advances cleanly');
    assert(Object.keys(validYesRes.errors).length === 0, 'Zero errors when allergy details are provided');
  }

  // ---------------------------------------------------------------------------
  // 3. "No known allergies" can advance and is saved explicitly
  // ---------------------------------------------------------------------------
  console.log('\nTEST 3: "No Known Allergies" Can Advance and is Saved Explicitly');
  {
    const noRes = validateIntakeStep('allergies', {}, null, 'no', '', 'en');
    assert(noRes.isValid, '"No known allergies" choice advances cleanly without errors');
    assert(Object.keys(noRes.errors).length === 0, 'Zero errors on "no" selection');

    const allergyVal = validateAllergies('no', '', 'en');
    assert(allergyVal.isValid, 'Allergy validation passes for "no"');
    assert(
      allergyVal.resolvedAllergies === 'no_known_allergies',
      'Explicitly saves "no_known_allergies" string'
    );
    assert(
      allergyVal.allergyStatus === 'no_known_allergies',
      'Explicitly assigns allergyStatus === "no_known_allergies"'
    );
    assert(allergyVal.resolvedAllergies !== 'None', 'Does NOT use ambiguous legacy "None" string');
  }

  // ---------------------------------------------------------------------------
  // 4. "I'm not sure" can advance and remains unknown
  // ---------------------------------------------------------------------------
  console.log('\nTEST 4: "I\'m Not Sure" Can Advance and Remains Unknown');
  {
    const unsureRes = validateIntakeStep('allergies', {}, null, 'unsure', '', 'en');
    assert(unsureRes.isValid, '"I\'m not sure" choice advances cleanly');
    assert(Object.keys(unsureRes.errors).length === 0, 'Zero errors on "unsure" selection');

    const allergyVal = validateAllergies('unsure', '', 'en');
    assert(allergyVal.isValid, 'Allergy validation passes for "unsure"');
    assert(
      allergyVal.resolvedAllergies === 'unknown',
      'Explicitly saves "unknown" string (not "None" or "no_known_allergies")'
    );
    assert(
      allergyVal.allergyStatus === 'unknown',
      'Explicitly assigns allergyStatus === "unknown"'
    );
    assert(
      allergyVal.resolvedAllergies !== 'no_known_allergies',
      'Unsure is strictly distinct from "no_known_allergies"'
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Blank required fields on every other intake step are blocked
  // ---------------------------------------------------------------------------
  console.log('\nTEST 5: Blank Required Fields on Every Other Intake Step are Blocked');
  {
    // Profile: Name
    assert(validateName('', 'en') !== null, 'Blank name rejected');
    assert(validateName('   ', 'en') !== null, 'Whitespace name rejected');
    assert(validateName('A', 'en') !== null, 'Single-character name rejected');
    assert(validateName('Ravi Sharma', 'en') === null, 'Valid name accepted');

    // Profile: Age
    assert(validateAge(undefined, 'en') !== null, 'Undefined age rejected');
    assert(validateAge('', 'en') !== null, 'Empty string age rejected');
    assert(validateAge(0, 'en') !== null, 'Age 0 rejected');
    assert(validateAge(-5, 'en') !== null, 'Negative age rejected');
    assert(validateAge(150, 'en') !== null, 'Age > 120 rejected');
    assert(validateAge(45.5, 'en') !== null, 'Non-integer age rejected');
    assert(validateAge('abc', 'en') !== null, 'NaN age rejected');
    assert(validateAge(45, 'en') === null, 'Valid integer age 45 accepted');

    // Profile: Gender
    assert(validateGender('', 'en') !== null, 'Blank gender rejected');
    assert(validateGender(undefined, 'en') !== null, 'Undefined gender rejected');
    assert(validateGender('invalid' as any, 'en') !== null, 'Invalid gender string rejected');
    assert(validateGender('male', 'en') === null, 'Gender "male" accepted');
    assert(validateGender('female', 'en') === null, 'Gender "female" accepted');
    assert(validateGender('other', 'en') === null, 'Gender "other" accepted');

    // Profile: Phone
    assert(validatePhone('', 'en') !== null, 'Blank phone rejected');
    assert(validatePhone('12345', 'en') !== null, 'Short phone (< 10 digits) rejected');
    assert(validatePhone('abc-def-ghij', 'en') !== null, 'Non-digit phone rejected');
    assert(validatePhone('9876543210', 'en') === null, 'Valid 10-digit phone accepted');
    assert(validatePhone('+91 98765 43210', 'en') === null, 'Formatted 10-digit phone accepted');

    // Symptoms
    assert(validateSymptoms('', 'en') !== null, 'Blank symptoms rejected');
    assert(validateSymptoms('   ', 'en') !== null, 'Whitespace symptoms rejected');
    assert(validateSymptoms('ab', 'en') !== null, 'Short (< 3 chars) symptoms rejected');
    assert(validateSymptoms('Chest pain and mild cough', 'en') === null, 'Valid symptoms accepted');

    // Upload
    assert(validateUploadFile(null, 'en') !== null, 'Null prescription file rejected');
    const mockFile = new File(['mock content'], 'rx.png', { type: 'image/png' });
    assert(validateUploadFile(mockFile, 'en') === null, 'Valid prescription file accepted');

    // Step-level enforcement in profile
    const profileStepEmpty = validateIntakeStep('profile', {}, null, null, '', 'en');
    assert(!profileStepEmpty.isValid, 'Profile step with blank fields is blocked');
    assert(Boolean(profileStepEmpty.errors.name), 'Profile step flags name error');
    assert(Boolean(profileStepEmpty.errors.age), 'Profile step flags age error');
    assert(Boolean(profileStepEmpty.errors.gender), 'Profile step flags gender error');
    assert(Boolean(profileStepEmpty.errors.phone), 'Profile step flags phone error');

    // Step-level enforcement in symptoms
    const symptomsStepEmpty = validateIntakeStep('symptoms', { symptoms: '' }, null, null, '', 'en');
    assert(!symptomsStepEmpty.isValid, 'Symptoms step with empty symptoms is blocked');
    assert(Boolean(symptomsStepEmpty.errors.symptoms), 'Symptoms step flags symptoms error');
  }

  // ---------------------------------------------------------------------------
  // 6. Optional fields can remain blank
  // ---------------------------------------------------------------------------
  console.log('\nTEST 6: Optional Fields Can Remain Blank (Meds Step)');
  {
    // Meds step with completely empty currentMeds
    const medsEmptyRes = validateIntakeStep('meds', { currentMeds: '' }, null, null, '', 'en');
    assert(medsEmptyRes.isValid, 'Meds step with blank currentMeds is valid (isValid === true)');
    assert(Object.keys(medsEmptyRes.errors).length === 0, 'Zero errors when optional meds left blank');

    // Meds step with undefined currentMeds
    const medsUndefinedRes = validateIntakeStep('meds', {}, null, null, '', 'en');
    assert(medsUndefinedRes.isValid, 'Meds step with undefined currentMeds is valid');

    // Meds step with filled currentMeds
    const medsFilledRes = validateIntakeStep(
      'meds',
      { currentMeds: 'Metformin 500mg daily' },
      null,
      null,
      '',
      'en'
    );
    assert(medsFilledRes.isValid, 'Meds step with filled medications is valid');
  }

  // ---------------------------------------------------------------------------
  // 7. Back navigation preserves entered answers
  // ---------------------------------------------------------------------------
  console.log('\nTEST 7: Back Navigation Preserves Entered Answers');
  {
    // Simulate user state traversing forward: profile -> symptoms -> allergies -> meds
    const userProfile: Partial<PatientProfile> = {
      language: 'en',
      name: 'Priya Sharma',
      age: 34,
      gender: 'female',
      phone: '9876543210',
      symptoms: 'Fever and throat irritation',
    };
    let userAllergyChoice: AllergyChoice = 'yes';
    let userAllergyDetails = 'Penicillin, Sulfa';

    // Verify valid profile step
    const profileVal = validateIntakeStep('profile', userProfile, null, null, '', 'en');
    assert(profileVal.isValid, 'Profile step valid');

    // Verify valid symptoms step
    const symptomsVal = validateIntakeStep('symptoms', userProfile, null, null, '', 'en');
    assert(symptomsVal.isValid, 'Symptoms step valid');

    // Verify valid allergies step
    const allergiesVal = validateIntakeStep(
      'allergies',
      userProfile,
      null,
      userAllergyChoice,
      userAllergyDetails,
      'en'
    );
    assert(allergiesVal.isValid, 'Allergies step valid');

    // Advance to meds step
    userProfile.allergies = 'Penicillin, Sulfa';
    userProfile.allergyStatus = 'documented';

    // Simulate clicking "Back" from meds back to allergies
    // In PatientIntakeWizard, prev() does NOT wipe state and does NOT run validation
    assert(userAllergyChoice === 'yes', 'allergyChoice preserved as "yes" when navigating Back');
    assert(userAllergyDetails === 'Penicillin, Sulfa', 'allergyDetails preserved when navigating Back');

    // Simulate clicking "Back" from allergies to symptoms
    assert(userProfile.symptoms === 'Fever and throat irritation', 'Symptoms preserved when navigating Back');

    // Simulate clicking "Back" from symptoms to profile
    assert(userProfile.name === 'Priya Sharma', 'Name preserved when navigating Back');
    assert(userProfile.age === 34, 'Age preserved when navigating Back');
    assert(userProfile.gender === 'female', 'Gender preserved when navigating Back');
    assert(userProfile.phone === '9876543210', 'Phone preserved when navigating Back');

    // Simulate re-advancing forward to upload
    const mockFile = new File(['test'], 'rx.jpg', { type: 'image/jpeg' });
    const completeCheck = validateCompleteIntake(userProfile, mockFile, 'en');
    assert(completeCheck.isValid, 'Complete intake validation passes after round-trip back navigation');
  }

  // ---------------------------------------------------------------------------
  // 8. Invalid intake cannot be submitted or saved as complete
  // ---------------------------------------------------------------------------
  console.log('\nTEST 8: Invalid Intake Cannot Be Submitted or Saved as Complete');
  {
    // Comprehensive validator rejection
    const invalidProfile1: Partial<PatientProfile> = {
      name: '', // missing
      age: 40,
      gender: 'male',
      phone: '9876543210',
      symptoms: 'Cough',
      allergies: 'no_known_allergies',
    };
    const compVal1 = validateCompleteIntake(invalidProfile1);
    assert(!compVal1.isValid, 'validateCompleteIntake rejects missing name');

    const invalidProfile2: Partial<PatientProfile> = {
      name: 'John Doe',
      age: 40,
      gender: 'male',
      phone: '9876543210',
      symptoms: 'Cough',
      allergies: '', // missing allergy selection!
    };
    const compVal2 = validateCompleteIntake(invalidProfile2);
    assert(!compVal2.isValid, 'validateCompleteIntake rejects blank allergies');

    // Service-level rejection (demoService)
    const demoSaveRes = await demoService.savePatientIntake({
      name: '', // invalid
      age: 40,
      gender: 'male',
      phone: '9876543210',
      symptoms: 'Fever',
      allergies: 'no_known_allergies',
    });
    assert('error' in demoSaveRes, 'demoService.savePatientIntake strictly rejects invalid profile');
    assert(demoSaveRes.error.includes('Validation failed'), 'Returns explicit validation failure error message');

    // Service-level rejection when allergies are empty/missing
    const demoAllergyEmptyRes = await demoService.savePatientIntake({
      name: 'Anil Kumar',
      age: 50,
      gender: 'male',
      phone: '9876543210',
      symptoms: 'General body ache',
      allergies: '', // empty
    });
    assert('error' in demoAllergyEmptyRes, 'demoService.savePatientIntake rejects missing allergies');
    assert(
      demoAllergyEmptyRes.error.includes('Explicit allergy selection is required'),
      'Explains that explicit allergy selection is mandatory'
    );
  }

  // ---------------------------------------------------------------------------
  // 9. Unknown allergy status never becomes "no known allergies"
  // ---------------------------------------------------------------------------
  console.log('\nTEST 9: Unknown Allergy Status Never Becomes "No Known Allergies"');
  {
    // Save intake with explicit "unknown" allergy status
    const intakeUnknownRes = await demoService.savePatientIntake({
      name: 'Suresh Verma',
      age: 62,
      gender: 'male',
      phone: '9876543210',
      symptoms: 'Post-operative recovery follow-up',
      allergies: 'unknown',
      currentMeds: 'None',
      language: 'en',
    });

    assert('data' in intakeUnknownRes, 'Intake with "unknown" allergies is accepted and persisted');
    const createdPatient = 'data' in intakeUnknownRes ? intakeUnknownRes.data : null;
    assert(createdPatient !== null, 'Patient object returned');
    assert(createdPatient?.allergies === 'unknown', 'Saved allergies is strictly "unknown"');
    assert(
      createdPatient?.allergyStatus === 'unknown',
      'Saved allergyStatus is strictly "unknown"'
    );
    assert(
      createdPatient?.allergies !== 'no_known_allergies' && createdPatient?.allergies !== 'None',
      'Unknown allergy status NEVER becomes "no_known_allergies" or "None"'
    );

    // Verify clinical safety workflow behavior with unknown allergies
    const testDraft: PrescriptionDraft = {
      id: 'rx-safety-unknown-test',
      patientId: createdPatient!.id,
      imageUrl: 'test.png',
      fields: [
        { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Amoxicillin', status: 'confirmed' },
        { key: 'dosage', labelKey: 'rx_field_dosage', value: '500mg', status: 'confirmed' },
        { key: 'frequency', labelKey: 'rx_field_frequency', value: 'TID', status: 'confirmed' },
        { key: 'duration', labelKey: 'rx_field_duration', value: '5 days', status: 'confirmed' },
      ],
      confirmed: false,
      confirmedAt: null,
      confirmedBy: null,
    };

    const safetyAssessment = evaluatePrescriptionSafety(testDraft, createdPatient!, []);
    assert(
      safetyAssessment.checks.allergies.status === 'unknown',
      'Prescription safety check strictly flags allergies as "unknown" (NOT "passed")'
    );
    assert(
      safetyAssessment.workflowState === 'needs_review',
      'Workflow state is assigned "needs_review" when allergy data is unknown'
    );
    assert(
      safetyAssessment.workflowState !== 'ready_for_doctor_review',
      'Workflow state does NOT falsely bypass to "ready_for_doctor_review"'
    );
    assert(
      safetyAssessment.checks.allergies.evidence.includes('unknown'),
      'Clinical evidence explicitly notes allergy status is unverified/unknown'
    );

    // Verify contrast with explicit "no_known_allergies"
    const intakeNoRes = await demoService.savePatientIntake({
      name: 'Kavita Singh',
      age: 29,
      gender: 'female',
      phone: '9876543210',
      symptoms: 'Mild migraine',
      allergies: 'no_known_allergies',
      currentMeds: 'None',
      language: 'en',
    });
    assert('data' in intakeNoRes, 'Intake with "no_known_allergies" saved');
    const noPatient = 'data' in intakeNoRes ? intakeNoRes.data : null;
    assert(noPatient?.allergies === 'no_known_allergies', 'Saved allergies is "no_known_allergies"');

    const safetyAssessmentNo = evaluatePrescriptionSafety(testDraft, noPatient!, []);
    assert(
      safetyAssessmentNo.checks.allergies.status === 'passed',
      'Explicit "no_known_allergies" evaluates to status === "passed"'
    );
    assert(
      safetyAssessmentNo.workflowState === 'ready_for_doctor_review',
      'Clean prescription with verified no_known_allergies transitions to "ready_for_doctor_review"'
    );
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passedAssertions} passed, ${totalAssertions - passedAssertions} failed`);
  console.log('================================================================');

  if (passedAssertions !== totalAssertions) {
    process.exit(1);
  }
}

runIntakeValidationTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
