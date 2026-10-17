import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Mic,
  MicOff,
  User,
  AlertCircle,
  AlertTriangle,
  Check,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { PulseProgress } from '@/components/PulseProgress';
import { LanguageToggle } from '@/components/LanguageToggle';
import { DemoBadge } from '@/components/DemoBanner';
import { PrescriptionUpload } from '@/components/PrescriptionUpload';
import { VoiceGuidanceControl } from '@/components/VoiceGuidanceControl';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';

import { useLanguage } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';
import type { Language, PatientProfile } from '@/types';
import { cn } from '@/utils/cn';
import {
  validateIntakeStep,
  validateAllergies,
  validateCompleteIntake,
  type IntakeStep,
  type AllergyChoice,
} from '@/utils/intakeValidation';

interface PatientIntakeWizardProps {
  onComplete: (profile: Partial<PatientProfile>, prescriptionFile: File | null) => void;
  onBack: () => void;
}

const STEPS: IntakeStep[] = ['language', 'profile', 'symptoms', 'allergies', 'meds', 'upload'];

const STEP_VOICE_KEYS: Record<IntakeStep, TranslationKey> = {
  language: 'voice_step_language',
  profile: 'voice_step_profile',
  symptoms: 'voice_step_symptoms',
  allergies: 'voice_step_allergies',
  meds: 'voice_step_meds',
  upload: 'voice_step_upload',
};

export function PatientIntakeWizard({ onComplete, onBack }: PatientIntakeWizardProps) {
  const { t, lang, setLang } = useLanguage();
  const [stepIdx, setStepIdx] = useState(0);
  const [profile, setProfile] = useState<Partial<PatientProfile>>({ language: lang });
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);

  // Allergy state
  const [allergyChoice, setAllergyChoice] = useState<AllergyChoice>(() => {
    if (!profile.allergies) return null;
    const lower = profile.allergies.trim().toLowerCase();
    if (lower === 'no_known_allergies' || lower === 'none' || lower === 'no known allergies') return 'no';
    if (lower === 'unknown' || lower === 'not_sure') return 'unsure';
    return 'yes';
  });
  const [allergyDetails, setAllergyDetails] = useState<string>(() => {
    if (!profile.allergies) return '';
    const lower = profile.allergies.trim().toLowerCase();
    if (lower === 'no_known_allergies' || lower === 'none' || lower === 'unknown' || lower === 'not_sure') return '';
    return profile.allergies;
  });

  // Inline validation errors for the current step
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const voice = useVoiceGuidance();
  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  useEffect(() => {
    if (voice.isEnabled) {
      const voiceKey = STEP_VOICE_KEYS[step];
      if (voiceKey) {
        voice.speakInstruction(voiceKey, lang);
      }
    }
  }, [stepIdx, lang, voice.isEnabled]);

  // Synchronize language selection into profile
  useEffect(() => {
    setProfile((prev) => ({ ...prev, language: lang }));
  }, [lang]);

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const next = () => {
    // 1. Enforce validation for the current step inside step-navigation handler
    const validation = validateIntakeStep(
      step,
      profile,
      prescriptionFile,
      allergyChoice,
      allergyDetails,
      lang
    );

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});

    // 2. Commit resolved allergies to profile state when on or leaving allergy step
    const updatedProfile = { ...profile };
    if (step === 'allergies') {
      const allergyRes = validateAllergies(allergyChoice, allergyDetails, lang);
      if (allergyRes.resolvedAllergies) {
        updatedProfile.allergies = allergyRes.resolvedAllergies;
        updatedProfile.allergyStatus = allergyRes.allergyStatus;
        setProfile(updatedProfile);
      }
    }

    // 3. Final submission gate: block completed intake if any required step is invalid
    if (isLast) {
      const completeValidation = validateCompleteIntake(updatedProfile, prescriptionFile, lang);
      if (!completeValidation.isValid) {
        setErrors(completeValidation.errors);
        return;
      }
      onComplete(updatedProfile, prescriptionFile);
    } else {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }
  };

  const prev = () => {
    // Back navigation is ALWAYS available without requiring current step to be valid
    setErrors({});
    if (stepIdx === 0) {
      onBack();
    } else {
      setStepIdx((i) => Math.max(i - 1, 0));
    }
  };

  return (
    <div className="min-h-screen bg-surface-light flex flex-col">
      {/* Top Toolbar / Header */}
      <header className="border-b border-surface-border bg-white sticky top-0 z-20 shadow-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-medium text-navy-500 hover:text-navy-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('back')}</span>
            </button>
            <PulseBridgeLogo variant="light" size="sm" showTagline={false} />
            <span className="hidden md:inline-flex text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {t('nav_patient_intake')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <VoiceGuidanceControl voice={voice} variant="compact" />
            <DemoBadge variant="light" />
            <LanguageToggle variant="light" />
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="mx-auto max-w-2xl w-full px-4 sm:px-6 pt-6">
        <PulseProgress current={stepIdx} total={STEPS.length} variant="light" />
      </div>

      {/* Content */}
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 sm:px-6 py-8">
        <div key={step} className="animate-slide-up">
          {step === 'language' && (
            <LanguageStep
              current={lang}
              onSelect={(l) => {
                setLang(l);
                setProfile((prev) => ({ ...prev, language: l }));
                clearFieldError('language');
              }}
            />
          )}

          {step === 'profile' && (
            <ProfileStep
              profile={profile}
              setProfile={setProfile}
              errors={errors}
              clearError={clearFieldError}
            />
          )}

          {step === 'symptoms' && (
            <SymptomsStep
              value={profile.symptoms ?? ''}
              onChange={(v) => {
                setProfile((prev) => ({ ...prev, symptoms: v }));
                clearFieldError('symptoms');
              }}
              error={errors.symptoms}
              voiceSupported={voiceSupported}
              setVoiceSupported={setVoiceSupported}
              voiceActive={voiceActive}
              setVoiceActive={setVoiceActive}
              onVoiceResult={(v) => {
                setProfile((prev) => ({ ...prev, symptoms: ((prev.symptoms ?? '') + ' ' + v).trim() }));
                clearFieldError('symptoms');
              }}
            />
          )}

          {step === 'allergies' && (
            <AllergiesStep
              choice={allergyChoice}
              details={allergyDetails}
              onSelectChoice={(choice) => {
                setAllergyChoice(choice);
                clearFieldError('allergyChoice');
                if (choice === 'no') {
                  clearFieldError('allergyDetails');
                  setProfile((prev) => ({ ...prev, allergies: 'no_known_allergies', allergyStatus: 'no_known_allergies' }));
                } else if (choice === 'unsure') {
                  clearFieldError('allergyDetails');
                  setProfile((prev) => ({ ...prev, allergies: 'unknown', allergyStatus: 'unknown' }));
                } else if (choice === 'yes') {
                  setProfile((prev) => ({ ...prev, allergies: allergyDetails.trim(), allergyStatus: 'documented' }));
                }
              }}
              onChangeDetails={(details) => {
                setAllergyDetails(details);
                clearFieldError('allergyDetails');
                setProfile((prev) => ({ ...prev, allergies: details.trim(), allergyStatus: 'documented' }));
              }}
              choiceError={errors.allergyChoice}
              detailsError={errors.allergyDetails}
              voiceSupported={voiceSupported}
              setVoiceSupported={setVoiceSupported}
              voiceActive={voiceActive}
              setVoiceActive={setVoiceActive}
              onVoiceResult={(v) => {
                const nextDetails = ((allergyDetails || '') + ' ' + v).trim();
                setAllergyDetails(nextDetails);
                clearFieldError('allergyDetails');
                setProfile((prev) => ({ ...prev, allergies: nextDetails, allergyStatus: 'documented' }));
              }}
            />
          )}

          {step === 'meds' && (
            <TextStep
              title={t('intake_meds_q')}
              hint={t('intake_meds_hint')}
              value={profile.currentMeds ?? ''}
              onChange={(v) => setProfile((prev) => ({ ...prev, currentMeds: v }))}
              optional
              allowNone
              voiceSupported={voiceSupported}
              setVoiceSupported={setVoiceSupported}
              voiceActive={voiceActive}
              setVoiceActive={setVoiceActive}
              onVoiceResult={(v) =>
                setProfile((prev) => ({ ...prev, currentMeds: ((prev.currentMeds ?? '') + ' ' + v).trim() }))
              }
              placeholder="e.g., Aspirin 75mg, Metformin 500mg, multivitamin..."
            />
          )}

          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold text-navy-800 mb-1 flex items-center gap-1.5">
                  {t('intake_upload_q')}
                  <span className="text-rose-500 font-bold" aria-hidden="true">*</span>
                </h2>
                <p className="text-sm text-navy-500">{t('intake_upload_hint')}</p>
              </div>

              {errors.upload && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 flex items-center gap-2.5 text-rose-700 text-sm font-semibold animate-slide-up"
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{errors.upload}</span>
                </div>
              )}

              <PrescriptionUpload
                onUpload={(file) => {
                  setPrescriptionFile(file);
                  clearFieldError('upload');
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer nav */}
      <footer className="border-t border-surface-border bg-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={prev}
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-white px-5 py-3 text-sm font-semibold text-navy-600 hover:bg-surface-muted transition-colors min-h-[48px]"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </button>
          <button
            onClick={next}
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold transition-all min-h-[48px]',
              step === 'upload' && !prescriptionFile
                ? 'bg-surface-muted text-navy-400 hover:bg-surface-muted cursor-pointer'
                : 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm'
            )}
          >
            {isLast ? t('submit') : t('continue')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function LanguageStep({ current, onSelect }: { current: Language; onSelect: (l: Language) => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-navy-800 mb-2">{t('intake_lang_q')}</h2>
        <p className="text-sm text-navy-500">{t('intake_lang_hint')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(['hi', 'en'] as Language[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onSelect(l)}
            className={cn(
              'flex items-center gap-4 rounded-2xl border-2 p-5 transition-all min-h-[80px]',
              current === l
                ? 'border-teal-500 bg-teal-50 shadow-sm'
                : 'border-surface-border bg-white hover:border-teal-300'
            )}
          >
            <div
              className={cn(
                'flex w-10 h-10 items-center justify-center rounded-full text-lg font-bold',
                current === l ? 'bg-teal-500 text-white' : 'bg-surface-muted text-navy-500'
              )}
            >
              {l === 'hi' ? 'अ' : 'E'}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-semibold text-navy-800">
                {l === 'hi' ? 'हिंदी (Hindi)' : 'English'}
              </span>
              <span className="text-sm text-navy-500">
                {l === 'hi' ? 'संपूर्ण इंटरफ़ेस और आवाज़ हिंदी में' : 'Complete interface & voice in English'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileStep({
  profile,
  setProfile,
  errors,
  clearError,
}: {
  profile: Partial<PatientProfile>;
  setProfile: React.Dispatch<React.SetStateAction<Partial<PatientProfile>>>;
  errors: Record<string, string>;
  clearError: (field: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 mb-2">
        <User className="w-6 h-6 text-teal-500" />
        <h2 className="text-xl font-bold text-navy-800">{t('intake_profile_q')}</h2>
      </div>

      <div className="flex flex-col gap-4">
        <Field label={t('intake_name')} required error={errors.name}>
          <input
            type="text"
            value={profile.name ?? ''}
            onChange={(e) => {
              setProfile((prev) => ({ ...prev, name: e.target.value }));
              clearError('name');
            }}
            aria-invalid={Boolean(errors.name)}
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-3 text-base text-navy-800 outline-none transition-colors',
              errors.name
                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                : 'border-surface-border focus:border-teal-400 focus:ring-1 focus:ring-teal-400'
            )}
            placeholder="Ravi Sharma"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('intake_age')} required error={errors.age}>
            <input
              type="number"
              min="1"
              max="120"
              value={profile.age ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? undefined : Number(e.target.value);
                setProfile((prev) => ({ ...prev, age: val }));
                clearError('age');
              }}
              aria-invalid={Boolean(errors.age)}
              className={cn(
                'w-full rounded-xl border bg-white px-4 py-3 text-base text-navy-800 outline-none transition-colors',
                errors.age
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-surface-border focus:border-teal-400 focus:ring-1 focus:ring-teal-400'
              )}
              placeholder="62"
            />
          </Field>

          <Field label={t('intake_gender')} required error={errors.gender}>
            <select
              value={profile.gender ?? ''}
              onChange={(e) => {
                setProfile((prev) => ({
                  ...prev,
                  gender: e.target.value as 'male' | 'female' | 'other',
                }));
                clearError('gender');
              }}
              aria-invalid={Boolean(errors.gender)}
              className={cn(
                'w-full rounded-xl border bg-white px-4 py-3 text-base text-navy-800 outline-none transition-colors',
                errors.gender
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-surface-border focus:border-teal-400 focus:ring-1 focus:ring-teal-400'
              )}
            >
              <option value="">— Select Gender —</option>
              <option value="male">{t('gender_male')}</option>
              <option value="female">{t('gender_female')}</option>
              <option value="other">{t('gender_other')}</option>
            </select>
          </Field>
        </div>

        <Field label={t('intake_phone')} required error={errors.phone}>
          <input
            type="tel"
            value={profile.phone ?? ''}
            onChange={(e) => {
              setProfile((prev) => ({ ...prev, phone: e.target.value }));
              clearError('phone');
            }}
            aria-invalid={Boolean(errors.phone)}
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-3 text-base text-navy-800 outline-none transition-colors',
              errors.phone
                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                : 'border-surface-border focus:border-teal-400 focus:ring-1 focus:ring-teal-400'
            )}
            placeholder="9876543210"
          />
        </Field>
      </div>
    </div>
  );
}

function SymptomsStep({
  value,
  onChange,
  error,
  voiceSupported,
  setVoiceSupported,
  voiceActive,
  setVoiceActive,
  onVoiceResult,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  voiceSupported: boolean;
  setVoiceSupported: (v: boolean) => void;
  voiceActive: boolean;
  setVoiceActive: (v: boolean) => void;
  onVoiceResult: (v: string) => void;
}) {
  const { t, lang } = useLanguage();
  const recognitionRef = useRef<any>(null);

  const toggleVoice = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }
    setVoiceSupported(true);

    if (voiceActive) {
      recognitionRef.current?.stop();
      setVoiceActive(false);
      return;
    }

    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onVoiceResult(transcript);
    };
    rec.onerror = () => setVoiceActive(false);
    rec.onend = () => setVoiceActive(false);
    rec.start();
    recognitionRef.current = rec;
    setVoiceActive(true);
  }, [voiceActive, onVoiceResult, setVoiceActive, setVoiceSupported, lang]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-navy-800 mb-1 flex items-center gap-1.5">
          {t('intake_symptoms_q')}
          <span className="text-rose-500 font-bold" aria-hidden="true">*</span>
        </h2>
        <p className="text-sm text-navy-500">{t('intake_symptoms_hint')}</p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., chest pain, fatigue, mild shortness of breath..."
        rows={4}
        aria-invalid={Boolean(error)}
        className={cn(
          'w-full rounded-xl border bg-white px-4 py-3 text-base text-navy-800 outline-none transition-colors resize-none',
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
            : 'border-surface-border focus:border-teal-400 focus:ring-1 focus:ring-teal-400'
        )}
      />

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 animate-slide-up">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleVoice}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
            voiceActive
              ? 'border-danger-200 bg-danger-50 text-danger-600'
              : 'border-surface-border bg-white text-navy-600 hover:bg-surface-muted'
          )}
        >
          {voiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-teal-500" />}
          {voiceActive ? t('voice_stop') : t('intake_voice')}
        </button>
        {voiceActive && (
          <span className="text-sm text-rose-500 font-medium animate-pulse">
            {lang === 'hi' ? 'सुन रहा है...' : 'Listening...'}
          </span>
        )}
      </div>
    </div>
  );
}

function AllergiesStep({
  choice,
  details,
  onSelectChoice,
  onChangeDetails,
  choiceError,
  detailsError,
  voiceSupported,
  setVoiceSupported,
  voiceActive,
  setVoiceActive,
  onVoiceResult,
}: {
  choice: AllergyChoice;
  details: string;
  onSelectChoice: (choice: 'yes' | 'no' | 'unsure') => void;
  onChangeDetails: (details: string) => void;
  choiceError?: string;
  detailsError?: string;
  voiceSupported: boolean;
  setVoiceSupported: (v: boolean) => void;
  voiceActive: boolean;
  setVoiceActive: (v: boolean) => void;
  onVoiceResult: (v: string) => void;
}) {
  const { t, lang } = useLanguage();
  const recognitionRef = useRef<any>(null);

  const toggleVoice = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }
    setVoiceSupported(true);

    if (voiceActive) {
      recognitionRef.current?.stop();
      setVoiceActive(false);
      return;
    }

    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onVoiceResult(transcript);
    };
    rec.onerror = () => setVoiceActive(false);
    rec.onend = () => setVoiceActive(false);
    rec.start();
    recognitionRef.current = rec;
    setVoiceActive(true);
  }, [voiceActive, onVoiceResult, setVoiceActive, setVoiceSupported, lang]);

  const QUICK_ALLERGIES = ['Penicillin', 'Sulfa', 'Aspirin / NSAIDs', 'Cephalosporin', 'Peanuts'];

  const addQuickAllergy = (name: string) => {
    if (!details.trim()) {
      onChangeDetails(name);
    } else if (!details.toLowerCase().includes(name.toLowerCase())) {
      onChangeDetails(`${details.trim()}, ${name}`);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-navy-800 mb-1 flex items-center gap-1.5">
          {t('intake_allergies_q')}
          <span className="text-rose-500 font-bold" aria-hidden="true">*</span>
        </h2>
        <p className="text-sm text-navy-500">{t('intake_allergies_hint')}</p>
      </div>

      {choiceError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 flex items-center gap-2.5 text-rose-700 text-sm font-semibold animate-slide-up"
        >
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{choiceError}</span>
        </div>
      )}

      {/* 3 Explicit Clinical Allergy Options */}
      <div
        role="radiogroup"
        aria-label={t('intake_allergies_q')}
        className="grid grid-cols-1 gap-3.5"
      >
        {/* Choice 1: Yes */}
        <button
          type="button"
          role="radio"
          aria-checked={choice === 'yes'}
          tabIndex={0}
          onClick={() => onSelectChoice('yes')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onSelectChoice('yes');
            }
          }}
          className={cn(
            'flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition-all min-h-[72px]',
            choice === 'yes'
              ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500'
              : 'border-surface-border bg-white hover:border-amber-300 hover:bg-slate-50/50'
          )}
        >
          <div
            className={cn(
              'mt-0.5 flex w-5 h-5 items-center justify-center rounded-full border-2 transition-colors shrink-0',
              choice === 'yes' ? 'border-amber-600 bg-amber-500' : 'border-navy-300 bg-white'
            )}
          >
            {choice === 'yes' && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-base font-bold text-navy-900">{t('intake_allergy_yes')}</span>
            </div>
            <p className="text-xs text-navy-600 mt-0.5">{t('intake_allergy_yes_hint')}</p>
          </div>
        </button>

        {/* Choice 2: No */}
        <button
          type="button"
          role="radio"
          aria-checked={choice === 'no'}
          tabIndex={0}
          onClick={() => onSelectChoice('no')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onSelectChoice('no');
            }
          }}
          className={cn(
            'flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition-all min-h-[72px]',
            choice === 'no'
              ? 'border-teal-500 bg-teal-50/70 shadow-sm ring-1 ring-teal-500'
              : 'border-surface-border bg-white hover:border-teal-300 hover:bg-slate-50/50'
          )}
        >
          <div
            className={cn(
              'mt-0.5 flex w-5 h-5 items-center justify-center rounded-full border-2 transition-colors shrink-0',
              choice === 'no' ? 'border-teal-600 bg-teal-500' : 'border-navy-300 bg-white'
            )}
          >
            {choice === 'no' && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-base font-bold text-navy-900">{t('intake_allergy_no')}</span>
            </div>
            <p className="text-xs text-navy-600 mt-0.5">{t('intake_allergy_no_hint')}</p>
          </div>
        </button>

        {/* Choice 3: Unsure */}
        <button
          type="button"
          role="radio"
          aria-checked={choice === 'unsure'}
          tabIndex={0}
          onClick={() => onSelectChoice('unsure')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onSelectChoice('unsure');
            }
          }}
          className={cn(
            'flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition-all min-h-[72px]',
            choice === 'unsure'
              ? 'border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-500'
              : 'border-surface-border bg-white hover:border-blue-300 hover:bg-slate-50/50'
          )}
        >
          <div
            className={cn(
              'mt-0.5 flex w-5 h-5 items-center justify-center rounded-full border-2 transition-colors shrink-0',
              choice === 'unsure' ? 'border-blue-600 bg-blue-500' : 'border-navy-300 bg-white'
            )}
          >
            {choice === 'unsure' && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-base font-bold text-navy-900">{t('intake_allergy_unsure')}</span>
            </div>
            <p className="text-xs text-navy-600 mt-0.5">{t('intake_allergy_unsure_hint')}</p>
          </div>
        </button>
      </div>

      {/* When Yes is selected: Mandatory details textarea */}
      {choice === 'yes' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4.5 flex flex-col gap-3 animate-slide-up mt-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-navy-800 flex items-center gap-1.5">
              <span>{t('intake_allergy_details_q')}</span>
              <span className="text-rose-500 font-bold" aria-hidden="true">*</span>
            </label>
          </div>

          <textarea
            value={details}
            onChange={(e) => onChangeDetails(e.target.value)}
            placeholder={t('intake_allergy_details_placeholder')}
            rows={3}
            aria-invalid={Boolean(detailsError)}
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-3 text-base text-navy-800 outline-none transition-colors resize-none shadow-sm',
              detailsError
                ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                : 'border-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
            )}
          />

          {detailsError && (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 animate-slide-up">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span>{detailsError}</span>
            </p>
          )}

          {/* Quick select pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs font-medium text-navy-500 mr-1">{t('intake_allergy_quick_add')}</span>
            {QUICK_ALLERGIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => addQuickAllergy(item)}
                className="text-xs font-medium px-2.5 py-1 rounded-full border border-amber-300 bg-white hover:bg-amber-100/60 text-navy-700 transition-colors"
              >
                + {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={toggleVoice}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[40px]',
                voiceActive
                  ? 'border-danger-200 bg-danger-50 text-danger-600'
                  : 'border-amber-300 bg-white text-navy-600 hover:bg-amber-50'
              )}
            >
              {voiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-amber-600" />}
              {voiceActive ? t('voice_stop') : t('intake_voice')}
            </button>
            {voiceActive && (
              <span className="text-sm text-rose-500 font-medium animate-pulse">
                {lang === 'hi' ? 'सुन रहा है...' : 'Listening...'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  required,
  optional,
  error,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-navy-600 flex items-center gap-1">
          {label}
          {required && <span className="text-rose-500 font-bold" aria-hidden="true">*</span>}
        </label>
        {optional && (
          <span className="text-xs text-navy-400 font-medium">({t('intake_optional')})</span>
        )}
      </div>
      {children}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 animate-slide-up">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function TextStep({
  title,
  hint,
  value,
  onChange,
  placeholder,
  allowNone,
  optional,
  voiceSupported,
  setVoiceSupported,
  voiceActive,
  setVoiceActive,
  onVoiceResult,
}: {
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowNone?: boolean;
  optional?: boolean;
  voiceSupported: boolean;
  setVoiceSupported: (v: boolean) => void;
  voiceActive: boolean;
  setVoiceActive: (v: boolean) => void;
  onVoiceResult: (v: string) => void;
}) {
  const { t, lang } = useLanguage();
  const recognitionRef = useRef<any>(null);

  const toggleVoice = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }
    setVoiceSupported(true);

    if (voiceActive) {
      recognitionRef.current?.stop();
      setVoiceActive(false);
      return;
    }

    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onVoiceResult(transcript);
    };
    rec.onerror = () => setVoiceActive(false);
    rec.onend = () => setVoiceActive(false);
    rec.start();
    recognitionRef.current = rec;
    setVoiceActive(true);
  }, [voiceActive, onVoiceResult, setVoiceActive, setVoiceSupported, lang]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-navy-800">{title}</h2>
          {optional && (
            <span className="text-xs text-navy-500 font-semibold px-2 py-0.5 rounded bg-surface-muted border border-surface-border">
              {t('intake_optional')}
            </span>
          )}
        </div>
        <p className="text-sm text-navy-500">{hint}</p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-xl border border-surface-border bg-white px-4 py-3 text-base text-navy-800 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none transition-colors resize-none"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleVoice}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
            voiceActive
              ? 'border-danger-200 bg-danger-50 text-danger-600'
              : 'border-surface-border bg-white text-navy-600 hover:bg-surface-muted'
          )}
        >
          {voiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-teal-500" />}
          {voiceActive ? t('voice_stop') : t('intake_voice')}
        </button>
        {voiceActive && (
          <span className="text-sm text-rose-500 font-medium animate-pulse">
            {lang === 'hi' ? 'सुन रहा है...' : 'Listening...'}
          </span>
        )}
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(t('intake_none'))}
            className="ml-auto text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
          >
            {t('intake_none')}
          </button>
        )}
      </div>
    </div>
  );
}
