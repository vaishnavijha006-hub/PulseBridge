import { HeartPulse, Stethoscope, Users, ArrowRight, ShieldCheck, Activity, Clock, Server } from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { RoleCard } from '@/components/RoleCard';
import { CursorGlow } from '@/components/CursorGlow';
import { DemoBanner } from '@/components/DemoBanner';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/i18n/LanguageContext';

type Role = 'patient' | 'doctor' | 'family' | 'admin';

interface LandingPageProps {
  onRoleSelect: (role: Role) => void;
}

export function LandingPage({ onRoleSelect }: LandingPageProps) {
  const { t } = useLanguage();

  return (
    <div className="relative min-h-screen bg-navy-800 overflow-hidden dark-surface">
      <CursorGlow />

      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[300px] rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-navy-600/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <PulseBridgeLogo variant="dark" size="md" />
            <nav className="flex items-center gap-2 sm:gap-4">
              <a href="#about" className="text-sm font-medium text-navy-200 hover:text-teal-300 transition-colors hidden sm:block">
                {t('nav_about')}
              </a>
              <a href="#how" className="text-sm font-medium text-navy-200 hover:text-teal-300 transition-colors hidden sm:block">
                {t('nav_how')}
              </a>
              <div className="hidden lg:block">
                <DemoBanner variant="dark" />
              </div>
              <div className="hidden md:flex items-center gap-1 border-l border-r border-navy-600/70 px-2.5 py-1">
                <button
                  onClick={() => onRoleSelect('patient')}
                  className="px-2 py-1 text-xs rounded-md text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 font-semibold transition-colors"
                >
                  {t('role_patient')}
                </button>
                <button
                  onClick={() => onRoleSelect('doctor')}
                  className="px-2 py-1 text-xs rounded-md text-slate-200 hover:text-teal-300 hover:bg-navy-700 font-semibold transition-colors"
                >
                  {t('role_doctor')}
                </button>
                <button
                  onClick={() => onRoleSelect('admin')}
                  className="px-2 py-1 text-xs rounded-md text-slate-200 hover:text-teal-300 hover:bg-navy-700 font-semibold transition-colors"
                >
                  {t('role_admin')}
                </button>
              </div>
              <LanguageToggle variant="dark" />
              <button
                onClick={() => onRoleSelect('patient')}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-teal-400 transition-colors min-h-[44px]"
              >
                {t('cta_start')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12">
        <div className="flex flex-col items-center text-center gap-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5">
            <HeartPulse className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-medium text-teal-300">Doctor-Verified Recovery Platform</span>
          </div>
          <h1 className="max-w-3xl text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
            {t('hero_title')}
          </h1>
          <p className="max-w-2xl text-base sm:text-lg text-navy-200 leading-relaxed">
            {t('hero_sub')}
          </p>
          <p className="font-devanagari text-lg sm:text-xl text-teal-300 font-medium">
            {t('hero_hindi')}
          </p>
          <button
            onClick={() => onRoleSelect('patient')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-400 px-8 py-4 text-base font-bold text-navy-900 hover:from-teal-400 hover:to-cyan-300 transition-all shadow-lg shadow-teal-500/20 hover:shadow-teal-400/30 min-h-[52px]"
          >
            {t('cta_start')}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Role cards */}
      <section id="about" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-center text-xl font-semibold text-navy-100 mb-8">{t('role_select')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          <RoleCard
            icon={HeartPulse}
            title={t('role_patient')}
            hindiTitle={t('role_patient_hi')}
            description={t('role_patient_desc')}
            actionLabel={t('cta_start')}
            onClick={() => onRoleSelect('patient')}
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

      {/* How it works */}
      <section id="how" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-center text-2xl font-bold text-white mb-12">{t('how_title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <HowItWorksStep
            num={1}
            icon={Stethoscope}
            text={t('how_step1')}
          />
          <HowItWorksStep
            num={2}
            icon={Activity}
            text={t('how_step2')}
          />
          <HowItWorksStep
            num={3}
            icon={Clock}
            text={t('how_step3')}
          />
        </div>
        <div className="mt-12 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-navy-200 text-sm">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <span className="max-w-2xl text-center">{t('privacy_note')}</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-navy-600/50 mt-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <PulseBridgeLogo variant="dark" size="sm" showTagline={false} />
          <p className="text-sm text-navy-300 text-center sm:text-right">
            PulseBridge AI — Prescription ke baad patient akela nahi hota. Ghar tak ilaaj ka saath.
          </p>
        </div>
      </footer>
    </div>
  );
}

function HowItWorksStep({ num, icon: Icon, text }: { num: number; icon: typeof HeartPulse; text: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative flex w-16 h-16 items-center justify-center rounded-2xl border border-teal-500/30 bg-navy-700/50">
        <Icon className="w-7 h-7 text-teal-400" />
        <span className="absolute -top-2 -right-2 flex w-6 h-6 items-center justify-center rounded-full bg-teal-500 text-navy-900 text-xs font-bold">
          {num}
        </span>
      </div>
      <p className="text-sm text-navy-100 leading-relaxed max-w-[220px]">{text}</p>
      {num < 3 && (
        <div className="hidden md:block absolute" />
      )}
    </div>
  );
}
