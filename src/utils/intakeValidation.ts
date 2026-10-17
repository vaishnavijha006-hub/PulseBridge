import type { Language, PatientProfile } from '@/types';

export type IntakeStep = 'language' | 'profile' | 'symptoms' | 'allergies' | 'meds' | 'upload';

export type AllergyChoice = 'yes' | 'no' | 'unsure' | null;

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface AllergyValidationResult {
  isValid: boolean;
  choiceError?: string;
  detailsError?: string;
  resolvedAllergies?: string;
  allergyStatus?: 'no_known_allergies' | 'unknown' | 'documented';
}

/**
 * Validate full patient name (must contain at least 2 non-whitespace characters)
 */
export function validateName(name?: string, lang: Language = 'en'): string | null {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return lang === 'hi'
      ? 'कृपया अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।'
      : 'Please enter your full name (at least 2 characters).';
  }
  return null;
}

/**
 * Validate patient age (must be a valid integer between 1 and 120)
 */
export function validateAge(age?: number | string | null, lang: Language = 'en'): string | null {
  if (age === undefined || age === null || age === '') {
    return lang === 'hi'
      ? 'कृपया अपनी उम्र दर्ज करें।'
      : 'Please enter your age.';
  }
  const num = Number(age);
  if (isNaN(num) || !Number.isInteger(num) || num < 1 || num > 120) {
    return lang === 'hi'
      ? 'कृपया 1 से 120 के बीच एक मान्य उम्र दर्ज करें।'
      : 'Please enter a valid age between 1 and 120.';
  }
  return null;
}

/**
 * Validate patient gender selection
 */
export function validateGender(gender?: string | null, lang: Language = 'en'): string | null {
  if (!gender || !['male', 'female', 'other'].includes(gender)) {
    return lang === 'hi'
      ? 'कृपया लिंग का चयन करें।'
      : 'Please select your gender.';
  }
  return null;
}

/**
 * Validate phone number (must contain at least 10 digits)
 */
export function validatePhone(phone?: string | null, lang: Language = 'en'): string | null {
  if (!phone || typeof phone !== 'string') {
    return lang === 'hi'
      ? 'कृपया एक मान्य फ़ोन नंबर दर्ज करें।'
      : 'Please enter a valid phone number.';
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return lang === 'hi'
      ? 'कृपया 10 अंकों का मान्य फ़ोन नंबर दर्ज करें।'
      : 'Please enter a valid phone number (at least 10 digits).';
  }
  return null;
}

/**
 * Validate symptoms description (must contain at least 3 non-whitespace characters)
 */
export function validateSymptoms(symptoms?: string | null, lang: Language = 'en'): string | null {
  if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length < 3) {
    return lang === 'hi'
      ? 'कृपया अपने लक्षणों या स्वास्थ्य संबंधी चिंताओं का विवरण दें।'
      : 'Please describe your symptoms or health concerns.';
  }
  return null;
}

/**
 * Validate allergy choice and mandatory details
 * 
 * Clinical Invariant:
 * - Empty is NEVER interpreted as "no allergies"
 * - "Yes" strictly requires non-empty allergy details
 * - "No known allergies" explicitly saves "no_known_allergies"
 * - "I'm not sure" explicitly saves "unknown"
 */
export function validateAllergies(
  choice: AllergyChoice,
  details?: string | null,
  lang: Language = 'en'
): AllergyValidationResult {
  if (!choice) {
    return {
      isValid: false,
      choiceError:
        lang === 'hi'
          ? 'आगे बढ़ने के लिए कृपया एलर्जी के बारे में एक विकल्प चुनें।'
          : 'Please select an option about your allergy history to continue.',
    };
  }

  if (choice === 'yes') {
    const trimmedDetails = (details || '').trim();
    if (trimmedDetails.length < 2) {
      return {
        isValid: false,
        detailsError:
          lang === 'hi'
            ? 'कृपया बताएं कि आपको किन दवाइयों या पदार्थों से एलर्जी है।'
            : 'Please specify which medicines or substances you are allergic to.',
      };
    }
    return {
      isValid: true,
      resolvedAllergies: trimmedDetails,
      allergyStatus: 'documented',
    };
  }

  if (choice === 'no') {
    return {
      isValid: true,
      resolvedAllergies: 'no_known_allergies',
      allergyStatus: 'no_known_allergies',
    };
  }

  if (choice === 'unsure') {
    return {
      isValid: true,
      resolvedAllergies: 'unknown',
      allergyStatus: 'unknown',
    };
  }

  return {
    isValid: false,
    choiceError:
      lang === 'hi'
        ? 'अमान्य एलर्जी विकल्प।'
        : 'Invalid allergy selection.',
  };
}

/**
 * Validate prescription upload file
 */
export function validateUploadFile(file: File | null, lang: Language = 'en'): string | null {
  if (!file) {
    return lang === 'hi'
      ? 'इनटेक पूरा करने के लिए कृपया पर्ची की साफ फोटो अपलोड करें।'
      : 'Please upload a prescription image to complete intake.';
  }
  return null;
}

/**
 * Validate a specific step of the wizard
 */
export function validateIntakeStep(
  step: IntakeStep,
  profile: Partial<PatientProfile>,
  prescriptionFile: File | null,
  allergyChoice: AllergyChoice,
  allergyDetails: string,
  lang: Language = 'en'
): ValidationResult {
  const errors: Record<string, string> = {};

  switch (step) {
    case 'language': {
      if (!profile.language || !['hi', 'en'].includes(profile.language)) {
        errors.language =
          lang === 'hi' ? 'कृपया अपनी पसंदीदा भाषा चुनें।' : 'Please select your preferred language.';
      }
      break;
    }

    case 'profile': {
      const nameErr = validateName(profile.name, lang);
      if (nameErr) errors.name = nameErr;

      const ageErr = validateAge(profile.age, lang);
      if (ageErr) errors.age = ageErr;

      const genderErr = validateGender(profile.gender, lang);
      if (genderErr) errors.gender = genderErr;

      const phoneErr = validatePhone(profile.phone, lang);
      if (phoneErr) errors.phone = phoneErr;
      break;
    }

    case 'symptoms': {
      const symptomsErr = validateSymptoms(profile.symptoms, lang);
      if (symptomsErr) errors.symptoms = symptomsErr;
      break;
    }

    case 'allergies': {
      const allergyRes = validateAllergies(allergyChoice, allergyDetails, lang);
      if (!allergyRes.isValid) {
        if (allergyRes.choiceError) errors.allergyChoice = allergyRes.choiceError;
        if (allergyRes.detailsError) errors.allergyDetails = allergyRes.detailsError;
      }
      break;
    }

    case 'meds': {
      // Current medications is strictly OPTIONAL.
      // Patients not taking medications can leave this blank without being blocked.
      break;
    }

    case 'upload': {
      const uploadErr = validateUploadFile(prescriptionFile, lang);
      if (uploadErr) errors.upload = uploadErr;
      break;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Perform complete intake validation across all required clinical steps
 */
export function validateCompleteIntake(
  profile: Partial<PatientProfile>,
  prescriptionFile?: File | null,
  lang: Language = 'en'
): ValidationResult {
  const errors: Record<string, string> = {};

  const nameErr = validateName(profile.name, lang);
  if (nameErr) errors.name = nameErr;

  const ageErr = validateAge(profile.age, lang);
  if (ageErr) errors.age = ageErr;

  const genderErr = validateGender(profile.gender, lang);
  if (genderErr) errors.gender = genderErr;

  const phoneErr = validatePhone(profile.phone, lang);
  if (phoneErr) errors.phone = phoneErr;

  const symptomsErr = validateSymptoms(profile.symptoms, lang);
  if (symptomsErr) errors.symptoms = symptomsErr;

  // Allergy validation
  const allergiesStr = (profile.allergies || '').trim().toLowerCase();
  if (!allergiesStr) {
    errors.allergies =
      lang === 'hi'
        ? 'एलर्जी का चयन अनिवार्य है।'
        : 'Allergy status is required and cannot be blank.';
  }

  // Prescription file validation (if required for final submission)
  if (prescriptionFile !== undefined && prescriptionFile === null) {
    const uploadErr = validateUploadFile(prescriptionFile, lang);
    if (uploadErr) errors.upload = uploadErr;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
