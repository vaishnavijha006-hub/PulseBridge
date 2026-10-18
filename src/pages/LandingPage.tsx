import { useState } from 'react';
import {
  HeartPulse,
  Stethoscope,
  Users,
  ArrowRight,
  ShieldCheck,
  Activity,
  Clock,
  Server,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Lock,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  CreditCard,
  Volume2,
  Menu,
  X,
  Play,
  Pill,
  FileText,
  Phone,
} from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { RoleCard } from '@/components/RoleCard';
import { CursorGlow } from '@/components/CursorGlow';
import { DemoBanner } from '@/components/DemoBanner';
import { LanguageToggle } from '@/components/LanguageToggle';
import { PatientWorkflowDemoModal } from '@/components/PatientWorkflowDemoModal';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';

type Role = 'patient' | 'doctor' | 'family' | 'admin' | 'patient_intake';

interface LandingPageProps {
  onRoleSelect: (role: Role) => void;
}

export function LandingPage({ onRoleSelect }: LandingPageProps) {
  const { t, lang } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#080E1A] text-slate-100 overflow-x-hidden selection:bg-teal-500/30 selection:text-teal-200 font-sans">
      <CursorGlow />

      {/* Subtle clinical background gradients */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-teal-500/5 blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[600px] h-[450px] rounded-full bg-cyan-500/5 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[700px] h-[450px] rounded-full bg-navy-600/10 blur-[130px]" />
      </div>

      {/* 1. STICKY TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 border-b border-navy-600/70 bg-[#080E1A]/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <PulseBridgeLogo variant="dark" size="md" />
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-300">
              <a href="#patient-workflow" className="hover:text-teal-300 transition-colors text-teal-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-400" />
                <span>{t('nav_patient_workflow')}</span>
              </a>
              <a href="#architecture" className="hover:text-teal-300 transition-colors">
                {lang === 'hi' ? 'वास्तुकला' : 'Architecture'}
              </a>
              <a href="#capabilities" className="hover:text-teal-300 transition-colors">
                {lang === 'hi' ? 'क्लीनिकल क्षमताएं' : 'Capabilities'}
              </a>
              <a href="#workspaces" className="hover:text-teal-300 transition-colors">
                {lang === 'hi' ? 'वर्कस्पेस' : 'Workspaces'}
              </a>
              <a href="#transparency" className="hover:text-teal-300 transition-colors">
                {lang === 'hi' ? 'आभा एवं सुरक्षा' : 'ABHA & Safety'}
              </a>
            </nav>

            {/* Role switchers & Action Buttons */}
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="hidden xl:flex items-center gap-1 bg-navy-800/80 border border-navy-600/80 rounded-xl p-1 text-xs">
                <button
                  onClick={() => onRoleSelect('patient')}
                  className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-navy-700/80 transition-colors font-medium"
                >
                  {t('role_patient')}
                </button>
                <button
                  onClick={() => onRoleSelect('doctor')}
                  className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-navy-700/80 transition-colors font-medium"
                >
                  {t('role_doctor')}
                </button>
                <button
                  onClick={() => onRoleSelect('family')}
                  className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-navy-700/80 transition-colors font-medium"
                >
                  {t('role_family')}
                </button>
                <button
                  onClick={() => onRoleSelect('admin')}
                  className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-navy-700/80 transition-colors font-medium"
                >
                  {t('role_admin')}
                </button>
              </div>

              <DemoBanner variant="dark" />
              <LanguageToggle variant="dark" />

              <button
                onClick={() => onRoleSelect('patient_intake')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold text-xs px-4 py-2 transition-all shadow-md shadow-teal-500/20"
              >
                <span>{t('cta_patient_intake')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <div className="flex sm:hidden items-center gap-2">
              <LanguageToggle variant="dark" />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg bg-navy-800 border border-navy-600 text-slate-300 hover:text-white"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-b border-navy-600 bg-[#0B1424] px-4 py-4 flex flex-col gap-3 animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-navy-700">
              <DemoBanner variant="dark" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                onClick={() => { setMobileMenuOpen(false); setIsWorkflowModalOpen(true); }}
                className="col-span-2 p-2.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/40 text-left font-bold flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 fill-teal-400" />
                  <span>{t('landing_cta_workflow_demo')}</span>
                </span>
                <span className="text-[10px] bg-teal-400/20 px-1.5 py-0.5 rounded font-mono">6 Steps</span>
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); onRoleSelect('patient_intake'); }}
                className="p-2.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 text-left font-bold"
              >
                + {t('cta_patient_intake')}
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); onRoleSelect('doctor'); }}
                className="p-2.5 rounded-lg bg-navy-800 text-slate-200 border border-navy-700 text-left"
              >
                👨‍⚕️ {t('role_doctor')}
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); onRoleSelect('patient'); }}
                className="p-2.5 rounded-lg bg-navy-800 text-slate-200 border border-navy-700 text-left"
              >
                👤 {t('role_patient')}
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); onRoleSelect('family'); }}
                className="p-2.5 rounded-lg bg-navy-800 text-slate-200 border border-navy-700 text-left"
              >
                🤝 {t('role_family')}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16">
        <div className="flex flex-col items-center text-center gap-6 max-w-4xl mx-auto">
          {/* Clinical Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold tracking-wide text-teal-300">
              {t('landing_hero_badge')}
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.15] tracking-tight">
            {t('hero_title')}
          </h1>

          {/* Bilingual Hindi Tagline */}
          <p className="font-devanagari text-xl sm:text-2xl text-teal-300 font-semibold max-w-2xl">
            {t('hero_hindi')}
          </p>

          {/* Subtitle */}
          <p className="text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed max-w-3xl">
            {t('hero_sub')}
          </p>

          {/* CTA Button Group */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 mt-2 w-full sm:w-auto">
            <button
              onClick={() => onRoleSelect('patient_intake')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-teal-400 to-cyan-400 px-7 py-3.5 text-sm sm:text-base font-extrabold text-navy-900 hover:from-teal-400 hover:to-cyan-300 transition-all shadow-lg shadow-teal-500/25 min-h-[48px]"
            >
              <span>{t('cta_patient_intake')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onRoleSelect('doctor')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-teal-500/40 bg-navy-800/80 hover:bg-navy-700 text-teal-300 hover:text-white px-6 py-3.5 text-sm sm:text-base font-semibold transition-all min-h-[48px]"
            >
              <Stethoscope className="w-4 h-4 text-teal-400" />
              <span>{t('landing_cta_doctor')}</span>
            </button>
          </div>

          {/* Quick Demo & Workflow Walkthrough Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-3">
            <button
              onClick={() => setIsWorkflowModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-500/15 border border-teal-500/40 hover:bg-teal-500/25 text-teal-300 hover:text-white px-4 py-2 text-xs sm:text-sm font-bold transition-all shadow-md shadow-teal-500/15 group"
            >
              <Play className="w-3.5 h-3.5 fill-teal-400 text-teal-400 group-hover:scale-110 transition-transform" />
              <span>{t('landing_cta_workflow_demo')}</span>
              <span className="text-[10px] bg-teal-400/20 text-teal-200 px-1.5 py-0.5 rounded font-mono">
                {lang === 'hi' ? '6 चरण' : '6 Steps'}
              </span>
            </button>

            <button
              onClick={() => onRoleSelect('patient')}
              className="text-xs text-slate-400 hover:text-teal-300 transition-colors inline-flex items-center gap-1 underline underline-offset-4"
            >
              <span>{t('landing_cta_demo')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Verified Engineering Capabilities Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mt-8 pt-8 border-t border-navy-700/60 text-left">
            <div className="rounded-xl bg-navy-800/60 border border-navy-600/40 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-teal-400 text-xs font-bold">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Closed-Loop</span>
              </div>
              <span className="text-[11px] text-slate-300 font-medium leading-tight">
                7-Rule State Machine tracking open & resolved gaps
              </span>
            </div>

            <div className="rounded-xl bg-navy-800/60 border border-navy-600/40 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-teal-400 text-xs font-bold">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Safety Guardrails</span>
              </div>
              <span className="text-[11px] text-slate-300 font-medium leading-tight">
                Physician must confirm OCR drafts before regimen activation
              </span>
            </div>

            <div className="rounded-xl bg-navy-800/60 border border-navy-600/40 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-teal-400 text-xs font-bold">
                <Lock className="w-3.5 h-3.5" />
                <span>Family Consent</span>
              </div>
              <span className="text-[11px] text-slate-300 font-medium leading-tight">
                Cryptographic granular permission categories & audit log
              </span>
            </div>

            <div className="rounded-xl bg-navy-800/60 border border-navy-600/40 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-teal-400 text-xs font-bold">
                <CreditCard className="w-3.5 h-3.5" />
                <span>ABHA Support</span>
              </div>
              <span className="text-[11px] text-slate-300 font-medium leading-tight">
                14-digit format validation & truthful unverified status
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2.5. HOW PULSEBRIDGE WORKS FOR PATIENTS (INTERACTIVE WORKFLOW SHOWCASE) */}
      <section id="patient-workflow" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-navy-700/50">
        <div className="flex flex-col items-center text-center gap-3 mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1 text-xs font-bold text-teal-300">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>{lang === 'hi' ? 'मरीज़ वर्कफ़्लो एवं रिकवरी चक्र' : 'Patient Recovery Closed Loop'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            {lang === 'hi'
              ? 'मरीज़ के लिए PulseBridge कैसे काम करता है?'
              : 'How PulseBridge Works for the Patient'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            {lang === 'hi'
              ? 'अस्पताल से डिस्चार्ज होने से लेकर घर पर पूर्ण स्वस्थ होने तक का सरल, सुरक्षित और आवाज़-निर्देशित 6-चरणीय सफर।'
              : 'From hospital discharge to safe home recovery: a gentle, voice-guided 6-step clinical journey.'}
          </p>
        </div>

        {/* 6 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Step 1: Intake & ABHA */}
          <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 flex flex-col justify-between hover:border-teal-500/40 transition-all group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded-full">
                  {lang === 'hi' ? 'चरण 1' : 'Step 1'}
                </span>
                <Phone className="w-4 h-4 text-teal-400" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                {lang === 'hi' ? 'आसान पंजीकरण व ABHA' : 'Smart Intake & ABHA'}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {lang === 'hi'
                  ? 'मरीज़ 10-अंकीय फोन, ABHA आईडी दर्ज करते हैं और लक्षण बोलकर (Voice-to-Text) दर्ज कर सकते हैं।'
                  : 'Patients enter basic details, 14-digit ABHA health number, and can speak symptoms in Hindi/English.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-navy-700/60 flex items-center justify-between text-[11px] text-teal-300">
              <span>{lang === 'hi' ? 'आवाज़ से लक्षण दर्ज' : 'Voice-to-Text Input'}</span>
              <span>✓ {lang === 'hi' ? 'सुलभ' : 'Zero Friction'}</span>
            </div>
          </div>

          {/* Step 2: Prescription Scan */}
          <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 flex flex-col justify-between hover:border-teal-500/40 transition-all group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded-full">
                  {lang === 'hi' ? 'चरण 2' : 'Step 2'}
                </span>
                <FileText className="w-4 h-4 text-teal-400" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                {lang === 'hi' ? 'पर्ची स्कैन व AI ओसीआर' : 'Prescription OCR Scan'}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {lang === 'hi'
                  ? 'पर्चे की फोटो खींचते ही PulseBridge AI दवाइयों के नाम, खुराक व समय स्वतः निकालकर ड्राफ्ट बनाता है।'
                  : 'Snap a photo of the paper prescription; AI extracts medication names, dosage, and schedule drafts.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-navy-700/60 flex items-center justify-between text-[11px] text-teal-300">
              <span>{lang === 'hi' ? 'हस्तलिखित पर्ची पहचान' : 'Handwritten OPD OCR'}</span>
              <span>✓ 96% Match</span>
            </div>
          </div>

          {/* Step 3: Doctor Verification */}
          <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 flex flex-col justify-between hover:border-amber-500/40 transition-all group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  {lang === 'hi' ? 'चरण 3 (सुरक्षा)' : 'Step 3 (Safety)'}
                </span>
                <Stethoscope className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                {lang === 'hi' ? 'डॉक्टर क्लीनिकल पुष्टि' : 'Physician Verification'}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {lang === 'hi'
                  ? 'सख्त क्लीनिकल सुरक्षा: AI की कोई भी दवा तब तक मरीज़ को नहीं दिखती जब तक डॉक्टर उसे कंफर्म न करें।'
                  : 'Human-in-the-loop guarantee: Regimens remain locked until a verified physician signs off.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-navy-700/60 flex items-center justify-between text-[11px] text-amber-300">
              <span>{lang === 'hi' ? '100% डॉक्टर सत्यापित' : 'Doctor Sign-Off'}</span>
              <span>✓ Guardrail Active</span>
            </div>
          </div>

          {/* Step 4: Voice-Guided Reminders */}
          <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 flex flex-col justify-between hover:border-teal-500/40 transition-all group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded-full">
                  {lang === 'hi' ? 'चरण 4' : 'Step 4'}
                </span>
                <Pill className="w-4 h-4 text-teal-400" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                {lang === 'hi' ? 'आवाज़ रिमाइंडर व दवा लेना' : 'Voice Alarms & Doses'}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {lang === 'hi'
                  ? 'दवा के समय हिंदी/अंग्रेजी में बोलकर याद दिलाना। 1-टैप से "दवा ली", 10-मिनट स्नूज़ और 20-मिनट ग्रेस विंडो।'
                  : 'Spoken Hindi/English reminders, single-tap adherence marking, 10-minute snooze, and 20-min grace window.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-navy-700/60 flex items-center justify-between text-[11px] text-teal-300">
              <span>{lang === 'hi' ? 'स्पष्ट हिंदी ऑडियो' : 'Bilingual Voice'}</span>
              <span>✓ 20-Min Grace</span>
            </div>
          </div>

          {/* Step 5: Daily Check-In & Doctor Alert */}
          <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 flex flex-col justify-between hover:border-teal-500/40 transition-all group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded-full">
                  {lang === 'hi' ? 'चरण 5' : 'Step 5'}
                </span>
                <HeartPulse className="w-4 h-4 text-teal-400" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                {lang === 'hi' ? 'स्वास्थ्य जांच व डॉक्टर अलर्ट' : 'Check-In & CareGap Radar'}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {lang === 'hi'
                  ? 'रोजाना सेहत बताएं (Good/OK/Bad)। सीने में दर्द जैसे लक्षण होने पर तुरंत डॉक्टर के पास 82/100 अलर्ट जाता है।'
                  : 'Daily 3-face check-in. Any adverse symptom triggers immediate 82/100 priority triage in doctor radar.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-navy-700/60 flex items-center justify-between text-[11px] text-teal-300">
              <span>{lang === 'hi' ? 'क्लोज़्ड-लूप सेफ्टी' : 'Closed-Loop Care'}</span>
              <span>✓ Zero Drops</span>
            </div>
          </div>

          {/* Step 6: Family Recovery Circle */}
          <div className="rounded-2xl border border-navy-600 bg-navy-800/50 p-5 flex flex-col justify-between hover:border-teal-500/40 transition-all group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded-full">
                  {lang === 'hi' ? 'चरण 6' : 'Step 6'}
                </span>
                <Users className="w-4 h-4 text-teal-400" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
                {lang === 'hi' ? 'परिवार रिकवरी सर्कल' : 'Family Recovery Circle'}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {lang === 'hi'
                  ? 'परिजनों को सुकून भरे अपडेट मिलते हैं (उदा. "2 दवाइयां ली गईं") बिना जटिल मेडिकल भाषा के। मरीज़ कभी भी प्राइवेसी रद्द कर सकता है।'
                  : 'Family members get calming progress updates without jargon. Patient has 100% control to revoke access.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-navy-700/60 flex items-center justify-between text-[11px] text-teal-300">
              <span>{lang === 'hi' ? 'परिवार को मानसिक शांति' : 'Peace of Mind'}</span>
              <span>✓ Privacy Sovereign</span>
            </div>
          </div>
        </div>

        {/* Interactive CTA Banner */}
        <div className="mt-8 rounded-2xl bg-gradient-to-r from-teal-500/15 via-navy-800/90 to-navy-900 border border-teal-500/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 flex-shrink-0">
              <Play className="w-5 h-5 fill-teal-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {lang === 'hi' ? 'लाइव इंटरेक्टिव वर्कफ़्लो डेमो चलाएं' : 'Experience the Full Interactive Patient Tour'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {lang === 'hi'
                  ? 'देखें कैसे आवाज़ में दवा रिमाइंडर बजते हैं, ओसीआर काम करता है, और डॉक्टर को अलर्ट जाता है।'
                  : 'Test voice guidance audio, simulated prescription OCR, and closed-loop triage alerts.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setIsWorkflowModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 font-extrabold text-xs sm:text-sm px-5 py-2.5 shadow-lg shadow-teal-500/25 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{lang === 'hi' ? 'इंटरेक्टिव डेमो खोलें' : 'Launch Interactive Tour'}</span>
            </button>
            <button
              onClick={() => onRoleSelect('patient')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/40 bg-navy-800 hover:bg-navy-700 text-teal-300 hover:text-white font-bold text-xs sm:text-sm px-4 py-2.5 transition-colors"
            >
              <span>{t('landing_cta_demo')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. DUAL-SIDED CLINICAL ARCHITECTURE SHOWCASE */}
      <section id="architecture" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-navy-700/50">
        <div className="flex flex-col items-center text-center gap-3 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
            {lang === 'hi' ? 'दोहरी-पक्षीय क्लीनिकल वास्तुकला' : 'Two-Sided Clinical Intelligence'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {lang === 'hi'
              ? 'अस्पताल और घर के बीच एक सुरक्षित डिजिटल पुल'
              : 'A Continuous Feedback Bridge Between Clinic and Home'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            {lang === 'hi'
              ? 'मरीज द्वारा दर्ज की गई स्वास्थ्य अपडेट तुरंत डॉक्टर के कमांड सेंटर में स्वचालित केयर गैप विश्लेषण को ट्रिगर करती है।'
              : 'Every daily dose, reported symptom, and recovery update synchronizes directly into the physician radar with zero silent drops.'}
          </p>
        </div>

        {/* Live Architecture Grid: Doctor on Left, Patient on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Card: Doctor Command Center Preview */}
          <div className="rounded-2xl border border-navy-600 bg-navy-800/60 p-6 flex flex-col gap-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-white">{t('landing_preview_doctor_title')}</h3>
              </div>
              <span className="text-[11px] font-semibold text-danger-300 bg-danger-500/15 border border-danger-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-danger-400 animate-ping" />
                Priority Triage: 82/100
              </span>
            </div>

            {/* Simulated Live Patient Row */}
            <div className="rounded-xl bg-navy-900/80 border border-navy-600/70 p-4 flex flex-col gap-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-bold text-white">Ravi Sharma</span>
                  <span className="text-xs text-slate-400 block">62 yrs · Male · ID: P1 · Hindi</span>
                </div>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded">
                  Needs Attention
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-navy-800/80 p-2 rounded border border-navy-700">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>Open Care Gap: Reported chest discomfort during morning walking.</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400">Prescription: Metoprolol 25mg</span>
                <span className="text-teal-400 font-semibold">Doctor Verified ✓</span>
              </div>
            </div>

            {/* Capability Indicators */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Automated Triage Scoring</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Emergency Safety Override</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Care Gap Resolution Tracker</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Diagnostic Report Summaries</span>
              </div>
            </div>

            <button
              onClick={() => onRoleSelect('doctor')}
              className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-navy-700 hover:bg-navy-600 text-teal-300 hover:text-white py-2.5 text-xs font-bold transition-colors border border-navy-600"
            >
              <span>{lang === 'hi' ? 'डॉक्टर पोर्टल खोलें' : 'Open Physician Command Center'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Card: Patient Companion & Family Recovery Preview */}
          <div className="rounded-2xl border border-navy-600 bg-navy-800/60 p-6 flex flex-col gap-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-white">{t('landing_preview_patient_title')}</h3>
              </div>
              <span className="text-[11px] font-semibold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Volume2 className="w-3 h-3 text-teal-400" />
                Bilingual Voice Guidance
              </span>
            </div>

            {/* Simulated Live Patient Companion Widget */}
            <div className="rounded-xl bg-navy-900/80 border border-navy-600/70 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-300 uppercase">Today's Regimen</span>
                  <p className="text-xs text-slate-400">Post-Discharge Day 4 · Regimen Active</p>
                </div>
                <span className="text-xs font-mono font-bold text-teal-400">2 of 3 taken</span>
              </div>

              {/* Doses Checkbox simulated */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-2 rounded bg-navy-800/70 border border-navy-700 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-teal-500/20 border border-teal-400 flex items-center justify-center text-[10px] text-teal-300 font-bold">✓</div>
                    <span className="text-white font-medium">Metoprolol 25mg · 08:00 AM</span>
                  </div>
                  <span className="text-[10px] text-teal-400 font-semibold">Taken</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-navy-800/70 border border-amber-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-amber-400 flex items-center justify-center" />
                    <span className="text-white font-medium">Aspirin 75mg · 01:00 PM</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold">Due in 20m</span>
                </div>
              </div>

              {/* Family Circle member preview */}
              <div className="border-t border-navy-700 pt-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Users className="w-3.5 h-3.5 text-teal-400" />
                  <span>Family Circle: Priya Sharma</span>
                </div>
                <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/30">
                  Authorized
                </span>
              </div>
            </div>

            {/* Capability Indicators */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Hindi & English Speech Audio</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>One-Tap Dose Tracking</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Instant Caregiver Revocation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Offline-Resilient Storage</span>
              </div>
            </div>

            <button
              onClick={() => onRoleSelect('patient_intake')}
              className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-900 py-2.5 text-xs font-bold transition-colors"
            >
              <span>{t('cta_patient_intake')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. VERIFIED CORE CAPABILITIES GRID */}
      <section id="capabilities" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-navy-700/50">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
            {lang === 'hi' ? 'सत्यापित विशेषताएं' : 'Verified Capabilities'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
            {t('landing_cap_title')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            {t('landing_cap_subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-navy-600 bg-navy-800/40 p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {lang === 'hi' ? 'पर्ची ओसीआर एवं डॉक्टर पुष्टि' : 'Prescription OCR & Verification'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'hi'
                ? 'कागजी पर्ची से दवाओं का निष्कर्ष डॉक्टर के क्लीनिकल रिव्यू के बाद ही सक्रिय होता है। कोई अंधा विश्वास नहीं।'
                : 'Scanned prescriptions generate structured drafts requiring physician confirmation of dosage and frequency before activating regimens.'}
            </p>
          </div>

          <div className="rounded-2xl border border-navy-600 bg-navy-800/40 p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {lang === 'hi' ? 'क्लोज़्ड-लूप केयर इंजन' : 'Closed-Loop Care Engine'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'hi'
                ? 'लगातार छूटी खुराक, नए लक्षण या अनसुलझे फॉलो-अप पर स्वचालित केयर गैप दर्ज होते हैं और डॉक्टर द्वारा बंद किए जाते हैं।'
                : 'Deterministic 7-rule state machine detects repeated missed doses and adverse symptoms, enforcing resolution outcome documentation.'}
            </p>
          </div>

          <div className="rounded-2xl border border-navy-600 bg-navy-800/40 p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {lang === 'hi' ? 'परिवार रिकवरी सर्कल' : 'Family Recovery Circle'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'hi'
                ? 'मरीज स्वयं तय करता है कि कौन सी जानकारी साझा करनी है। एक क्लिक में किसी भी परिजन की पहुंच रोकी जा सकती है।'
                : 'Patient-controlled granular categories with instant authorization revocation, cryptographic token invitations, and append-only audit trail.'}
            </p>
          </div>

          <div className="rounded-2xl border border-navy-600 bg-navy-800/40 p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {lang === 'hi' ? 'द्विभाषी आवाज मार्गदर्शन' : 'Bilingual Voice Guidance'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'hi'
                ? 'हिंदी और अंग्रेजी में स्पष्ट आवाज निर्देश, ताकि कम साक्षरता वाले मरीज भी सही समय पर अपनी दवाइयां ले सकें।'
                : 'Real-time spoken instructions powered by ElevenLabs neural voice guidance with browser Web Speech API fallback in Hindi and English.'}
            </p>
          </div>
        </div>
      </section>

      {/* 5. ROLE WORKSPACES SELECTION */}
      <section id="workspaces" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-navy-700/50">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
            {t('role_select')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
            {lang === 'hi' ? 'विशिष्ट उपयोगकर्ता कार्यक्षेत्र' : 'Specialized Role Portals'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <RoleCard
            icon={HeartPulse}
            title={t('nav_patient_intake')}
            hindiTitle={t('role_patient_hi')}
            description={t('role_patient_desc')}
            actionLabel={t('cta_patient_intake')}
            onClick={() => onRoleSelect('patient_intake')}
          />
          <RoleCard
            icon={Stethoscope}
            title={t('role_doctor')}
            hindiTitle={t('role_doctor_hi')}
            description={t('role_doctor_desc')}
            actionLabel={t('doctor_review_patient')}
            onClick={() => onRoleSelect('doctor')}
          />
          <RoleCard
            icon={Users}
            title={t('role_family')}
            hindiTitle={t('role_family_hi')}
            description={t('role_family_desc')}
            actionLabel={t('continue')}
            onClick={() => onRoleSelect('family')}
          />
          <RoleCard
            icon={Server}
            title={t('role_admin')}
            hindiTitle={t('role_admin_hi')}
            description={t('role_admin_desc')}
            actionLabel={t('continue')}
            onClick={() => onRoleSelect('admin')}
          />
        </div>
      </section>

      {/* 6. ABHA SUPPORT & TRUTHFUL DIGITAL HEALTH TRANSPARENCY */}
      <section id="transparency" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-navy-700/50">
        <div className="rounded-3xl border border-navy-600 bg-navy-800/50 p-6 sm:p-10 flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-300 w-fit">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Ayushman Bharat Digital Mission (ABDM) Alignment</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {t('landing_transparency_title')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {lang === 'hi'
                ? 'PulseBridge AI मानक 14-अंकीय आभा संख्या (XX-XXXX-XXXX-XXXX) और आभा पते (उदा. user@abdm) के प्रारूप को स्वीकार और मान्य करता है।'
                : 'PulseBridge AI supports standard 14-digit ABHA number normalization (XX-XXXX-XXXX-XXXX) and PHR handles (e.g. user@abdm).'}
            </p>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-amber-300">
                  {lang === 'hi' ? 'आधिकारिक सत्यापन सूचना:' : 'Official Verification Disclosure:'}
                </span>
                <span className="leading-snug">
                  {lang === 'hi'
                    ? 'लाइव सरकारी ABDM सैंडबॉक्स गेटवे इस संस्करण में सक्रिय नहीं है। दर्ज किए गए सभी आभा रिकॉर्ड पारदर्शी रूप से "असत्यापित" के रूप में चिह्नित रहते हैं। हम कभी भी आधार नंबर या ओटीपी नहीं मांगते।'
                    : 'Live government ABDM gateway verification is not configured in this deployment. All self-declared ABHA numbers are truthfully tagged as "Unverified". PulseBridge AI never requests or stores Aadhaar numbers or OTPs.'}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto flex-shrink-0 flex flex-col gap-2 rounded-2xl bg-navy-900/90 border border-navy-700 p-5 min-w-[260px]">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {lang === 'hi' ? 'समर्थित प्रारूप' : 'Supported ABHA Structure'}
            </span>
            <div className="font-mono text-sm text-teal-300 font-bold bg-navy-800 px-3 py-2 rounded-lg border border-navy-700">
              14-8899-7766-5544
            </div>
            <div className="font-mono text-xs text-slate-300 bg-navy-800 px-3 py-2 rounded-lg border border-navy-700">
              patient.name@abdm
            </div>
            <span className="text-[10px] text-slate-400 italic">
              Status: Unverified (Self-declared)
            </span>
          </div>
        </div>
      </section>

      {/* 7. CLINICAL SAFETY DISCLAIMER & FOOTER */}
      <footer className="relative z-10 border-t border-navy-700/60 bg-[#060B14] mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-navy-700/60 pb-8">
            <PulseBridgeLogo variant="dark" size="sm" showTagline={true} />
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
              <button onClick={() => onRoleSelect('patient_intake')} className="hover:text-teal-300">
                {t('nav_patient_intake')}
              </button>
              <button onClick={() => onRoleSelect('doctor')} className="hover:text-teal-300">
                {t('role_doctor')}
              </button>
              <button onClick={() => onRoleSelect('patient')} className="hover:text-teal-300">
                {t('role_patient')}
              </button>
              <button onClick={() => onRoleSelect('family')} className="hover:text-teal-300">
                {t('role_family')}
              </button>
              <button onClick={() => onRoleSelect('admin')} className="hover:text-teal-300">
                {t('role_admin')}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p className="max-w-2xl text-center sm:text-left leading-relaxed">
              {t('landing_disclaimer')}
            </p>
            <div className="flex items-center gap-3">
              <LanguageToggle variant="dark" />
              <span className="text-[11px] text-slate-400">
                PulseBridge AI · {t('footer_tagline')}
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Patient Workflow Demo Modal */}
      <PatientWorkflowDemoModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        onExploreDemoPatient={() => onRoleSelect('patient')}
        onStartIntake={() => onRoleSelect('patient_intake')}
      />
    </div>
  );
}
