import { useState } from 'react';
import { Phone, PhoneOff, ShieldCheck, ShieldX, Heart, Clock, Activity, ChevronLeft, AlertTriangle, Info } from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { StatusBadge } from '@/components/StatusBadge';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import type { FamilyView } from '@/types';

interface FamilyRecoveryCircleProps {
  view: FamilyView;
  onBack: () => void;
  onToggleAccess: (authorized: boolean) => void;
}

export function FamilyRecoveryCircle({ view, onBack, onToggleAccess }: FamilyRecoveryCircleProps) {
  const { t } = useLanguage();
  const { patientName, dosesToday, nextDoseTime, healthUpdateStatus, missedDose, caregiverAccess } = view;
  const [accessRevoked, setAccessRevoked] = useState(!caregiverAccess.authorized);

  const handleToggle = () => {
    const newState = !accessRevoked;
    setAccessRevoked(newState);
    onToggleAccess(!newState);
  };

  const canCall = caregiverAccess.authorized && caregiverAccess.contactNumber;

  return (
    <div className="min-h-screen bg-surface-light flex flex-col">
      {/* Header */}
      <header className="border-b border-surface-border bg-white sticky top-0 z-20">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-navy-500 hover:text-navy-700 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <PulseBridgeLogo variant="light" size="sm" showTagline={false} />
          <LanguageToggle variant="light" />
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-md w-full px-4 py-6 flex flex-col gap-5">
        {/* Headline */}
        <div className="text-center animate-fade-in">
          <h1 className="text-2xl font-bold text-navy-800">
            {t('family_headline')}
          </h1>
          <p className="text-sm text-navy-500 mt-1">{patientName}</p>
        </div>

        {/* Consent status banner */}
        <div className={cn(
          'rounded-2xl border p-4 flex items-start gap-3',
          accessRevoked ? 'border-danger-200 bg-danger-50' : 'border-success-200 bg-success-50',
        )}>
          {accessRevoked ? <ShieldX className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" /> : <ShieldCheck className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />}
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-sm font-semibold text-navy-700">{t('family_consent_status')}</span>
            <span className={cn('text-sm font-medium', accessRevoked ? 'text-danger-600' : 'text-success-600')}>
              {accessRevoked ? t('family_consent_revoked') : t('family_consent_active')}
            </span>
          </div>
          <button
            onClick={handleToggle}
            className={cn(
              'text-xs font-semibold px-3 py-2 rounded-lg transition-colors min-h-[36px]',
              accessRevoked
                ? 'bg-teal-500 text-white hover:bg-teal-600'
                : 'border border-danger-200 text-danger-600 hover:bg-danger-100',
            )}
          >
            {accessRevoked ? t('family_authorize') : t('family_revoke')}
          </button>
        </div>

        {accessRevoked ? (
          <div className="rounded-2xl border border-surface-border bg-white p-8 text-center flex flex-col gap-3 items-center">
            <ShieldX className="w-10 h-10 text-danger-400" />
            <p className="text-sm text-navy-500">
              {t('family_consent_revoked')}
            </p>
            <p className="text-xs text-navy-400">
              {t('family_access_limited')}
            </p>
          </div>
        ) : (
          <>
            {/* Dose status */}
            <div className="rounded-2xl border border-surface-border bg-white p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-teal-500" />
                <span className="text-sm font-semibold text-navy-700">Today's Medicines</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-navy-500">{t('family_doses_today', { count: dosesToday.taken })}</span>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: dosesToday.total }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-3 h-3 rounded-full',
                        i < dosesToday.taken ? 'bg-success-500' : 'bg-surface-border',
                      )}
                    />
                  ))}
                </div>
              </div>
              {nextDoseTime && (
                <div className="flex items-center gap-2 text-sm text-navy-500 pt-1 border-t border-surface-border">
                  <Clock className="w-4 h-4 text-teal-400" />
                  {t('family_next_dose', { time: nextDoseTime })}
                </div>
              )}
            </div>

            {/* Health update status */}
            <div className="rounded-2xl border border-surface-border bg-white p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-500" />
                <span className="text-sm font-semibold text-navy-700">Health Update</span>
              </div>
              <p className="text-sm text-navy-500">{t('family_health_update', { status: healthUpdateStatus })}</p>
            </div>

            {/* Missed dose alert */}
            {missedDose && (
              <div className="rounded-2xl border border-danger-200 bg-danger-50 p-5 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-danger-700">{t('family_missed_dose')}</span>
                    <span className="text-xs text-danger-600">Please check in with the patient.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Call button */}
            <div className="rounded-2xl border border-surface-border bg-white p-5 flex flex-col gap-3">
              {canCall ? (
                <a
                  href={`tel:${caregiverAccess.contactNumber}`}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-success-500 text-white py-4 text-lg font-bold hover:bg-success-600 transition-colors min-h-[56px] shadow-sm"
                >
                  <Phone className="w-6 h-6" />
                  {t('family_call')}
                </a>
              ) : (
                <div className="flex flex-col items-center gap-2 py-3">
                  <PhoneOff className="w-8 h-8 text-navy-300" />
                  <p className="text-sm text-navy-400 text-center">{t('family_call_unavailable')}</p>
                </div>
              )}
            </div>

            {/* Privacy notice */}
            <div className="rounded-xl bg-surface-muted border border-surface-border p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-navy-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-navy-500 leading-relaxed">{t('family_access_limited')}</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
