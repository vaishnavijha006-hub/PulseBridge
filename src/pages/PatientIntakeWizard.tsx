import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Mic, MicOff, User } from 'lucide-react';
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

interface PatientIntakeWizardProps {
  onComplete: (profile: Partial<PatientProfile>, prescriptionFile: File | null) => void;
  onBack: () => void;
}

type Step = 'language' | 'profile' | 'symptoms' | 'allergies' | 'meds' | 'upload';

const STEPS: Step[] = ['language', 'profile', 'symptoms', 'allergies', 'meds', 'upload'];

const STEP_VOICE_KEYS: Record<Step, TranslationKey> = {
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

  const next = () => {
    if (isLast) {
      onComplete(profile, prescriptionFile);
    } else {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }
  };

  const prev = () => {
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
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-navy-500 hover:text-navy-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('back')}</span>
            </button>
            <PulseBridgeLogo variant="light" size="sm" showTagline={false} />
            <span className="hidden md:inline-flex text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {t('nav_patient_intake')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Voice Guidance Toggle in Top Toolbar */}
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
          {step === 'language' && <LanguageStep current={lang} onSelect={(l) => { setLang(l); setProfile({ ...profile, language: l }); }} />}
          {step === 'profile' && <ProfileStep profile={profile} setProfile={setProfile} />}
          {step === 'symptoms' && <TextStep
            title={t('intake_symptoms_q')}
            hint={t('intake_symptoms_hint')}
            value={profile.symptoms ?? ''}
            onChange={(v) => setProfile({ ...profile, symptoms: v })}
            voiceSupported={voiceSupported}
            setVoiceSupported={setVoiceSupported}
            voiceActive={voiceActive}
            setVoiceActive={setVoiceActive}
            onVoiceResult={(v) => setProfile({ ...profile, symptoms: (profile.symptoms ?? '') + ' ' + v })}
            placeholder="e.g., chest pain, fatigue..."
          />}
          {step === 'allergies' && <TextStep
            title={t('intake_allergies_q')}
            hint={t('intake_allergies_hint')}
            value={profile.allergies ?? ''}
            onChange={(v) => setProfile({ ...profile, allergies: v })}
            allowNone
            voiceSupported={voiceSupported}
            setVoiceSupported={setVoiceSupported}
            voiceActive={voiceActive}
            setVoiceActive={setVoiceActive}
            onVoiceResult={(v) => setProfile({ ...profile, allergies: (profile.allergies ?? '') + ' ' + v })}
            placeholder="e.g., Penicillin, peanuts..."
          />}
          {step === 'meds' && <TextStep
            title={t('intake_meds_q')}
            hint={t('intake_meds_hint')}
            value={profile.currentMeds ?? ''}
            onChange={(v) => setProfile({ ...profile, currentMeds: v })}
            allowNone
            voiceSupported={voiceSupported}
            setVoiceSupported={setVoiceSupported}
            voiceActive={voiceActive}
            setVoiceActive={setVoiceActive}
            onVoiceResult={(v) => setProfile({ ...profile, currentMeds: (profile.currentMeds ?? '') + ' ' + v })}
            placeholder="e.g., Aspirin 75mg..."
          />}
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold text-navy-800 mb-2">{t('intake_upload_q')}</h2>
                <p className="text-sm text-navy-500">{t('intake_upload_hint')}</p>
              </div>
              <PrescriptionUpload onUpload={(file) => setPrescriptionFile(file)} />
            </div>
          )}
        </div>
      </main>

      {/* Footer nav */}
      <footer className="border-t border-surface-border bg-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={prev}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-white px-5 py-3 text-sm font-semibold text-navy-600 hover:bg-surface-muted transition-colors min-h-[48px]"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </button>
          <button
            onClick={next}
            disabled={step === 'upload' && !prescriptionFile}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold transition-all min-h-[48px]',
              step === 'upload' && !prescriptionFile
                ? 'bg-surface-muted text-navy-300 cursor-not-allowed'
                : 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm',
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
            onClick={() => onSelect(l)}
            className={cn(
              'flex items-center gap-4 rounded-2xl border-2 p-5 transition-all min-h-[80px]',
              current === l
                ? 'border-teal-500 bg-teal-50 shadow-sm'
                : 'border-surface-border bg-white hover:border-teal-300',
            )}
          >
            <div className={cn(
              'flex w-10 h-10 items-center justify-center rounded-full text-lg font-bold',
              current === l ? 'bg-teal-500 text-white' : 'bg-surface-muted text-navy-500',
            )}>
              {l === 'hi' ? 'अ' : 'E'}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-semibold text-navy-800">{l === 'hi' ? 'हिंदी (Hindi)' : 'English'}</span>
              <span className="text-sm text-navy-500">{l === 'hi' ? 'संपूर्ण इंटरफ़ेस और आवाज़ हिंदी में' : 'Complete interface & voice in English'}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileStep({ profile, setProfile }: { profile: Partial<PatientProfile>; setProfile: (p: Partial<PatientProfile>) => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 mb-2">
        <User className="w-6 h-6 text-teal-500" />
        <h2 className="text-xl font-bold text-navy-800">{t('intake_profile_q')}</h2>
      </div>
      <div className="flex flex-col gap-4">
        <Field label={t('intake_name')}>
          <input
            type="text"
            value={profile.name ?? ''}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full rounded-xl border border-surface-border bg-white px-4 py-3 text-base text-navy-800 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none transition-colors"
            placeholder="Ravi Sharma"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('intake_age')}>
            <input
              type="number"
              value={profile.age ?? ''}
              onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
              className="w-full rounded-xl border border-surface-border bg-white px-4 py-3 text-base text-navy-800 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none transition-colors"
              placeholder="62"
            />
          </Field>
          <Field label={t('intake_gender')}>
            <select
              value={profile.gender ?? ''}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value as 'male' | 'female' | 'other' })}
              className="w-full rounded-xl border border-surface-border bg-white px-4 py-3 text-base text-navy-800 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none transition-colors"
            >
              <option value="">—</option>
              <option value="male">{t('gender_male')}</option>
              <option value="female">{t('gender_female')}</option>
              <option value="other">{t('gender_other')}</option>
            </select>
          </Field>
        </div>
        <Field label={t('intake_phone')}>
          <input
            type="tel"
            value={profile.phone ?? ''}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="w-full rounded-xl border border-surface-border bg-white px-4 py-3 text-base text-navy-800 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none transition-colors"
            placeholder="9876543210"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-navy-600">{label}</span>
      {children}
    </label>
  );
}

function TextStep({
  title,
  hint,
  value,
  onChange,
  placeholder,
  allowNone,
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
        <h2 className="text-xl font-bold text-navy-800 mb-2">{title}</h2>
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
          onClick={toggleVoice}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
            voiceActive
              ? 'border-danger-200 bg-danger-50 text-danger-600'
              : 'border-surface-border bg-white text-navy-600 hover:bg-surface-muted',
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
