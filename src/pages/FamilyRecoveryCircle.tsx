import { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  ShieldCheck,
  ShieldX,
  Heart,
  Clock,
  Activity,
  ChevronLeft,
  AlertTriangle,
  Info,
  Send,
  MessageSquareHeart,
  FileCheck,
  CheckCircle2,
  Users,
  ChevronDown
} from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { DemoBadge } from '@/components/DemoBanner';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import { familyConsentService } from '@/services/familyConsentService';
import type { GranularFamilyView, FamilyCircleMember } from '@/types/familyConsent';
import type { FamilyView } from '@/types';

interface FamilyRecoveryCircleProps {
  view?: GranularFamilyView | FamilyView;
  onBack: () => void;
  onToggleAccess?: (authorized: boolean) => void;
}

export function FamilyRecoveryCircle({ view: initialView, onBack }: FamilyRecoveryCircleProps) {
  const { t, lang } = useLanguage();
  const patientId = 'p1';

  // Members list for persona switcher demo
  const [members, setMembers] = useState<FamilyCircleMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('fcm_1');
  const [liveView, setLiveView] = useState<GranularFamilyView>(() =>
    familyConsentService.getGranularFamilyView(patientId, 'fcm_1')
  );

  // Encouragement note form
  const [supportMessage, setSupportMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const refreshState = () => {
    const allMembers = familyConsentService.listMembers(patientId);
    setMembers(allMembers);
    const updatedView = familyConsentService.getGranularFamilyView(patientId, selectedMemberId);
    setLiveView(updatedView);
  };

  useEffect(() => {
    refreshState();
    const unsubscribe = familyConsentService.subscribe(refreshState);
    return () => unsubscribe();
  }, [patientId, selectedMemberId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSendNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;

    familyConsentService.sendSupportNote({
      patientId,
      caregiverId: liveView.caregiverMemberId,
      caregiverName: liveView.caregiverName,
      relationship: liveView.relationship,
      message: supportMessage.trim(),
    });

    setSupportMessage('');
    showToast(lang === 'hi' ? 'प्रोत्साहन संदेश भेजा गया!' : 'Encouragement note sent to patient!');
  };

  const isAuthorized = liveView.authorized && liveView.status === 'accepted';
  const perms = liveView.permissions;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-5 py-3 text-sm font-medium shadow-xl flex items-center gap-2 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">{lang === 'hi' ? 'वापस' : 'Back'}</span>
          </button>
          <PulseBridgeLogo variant="light" size="sm" showTagline={false} />
          <div className="flex items-center gap-2">
            <DemoBadge variant="light" />
            <LanguageToggle variant="light" />
          </div>
        </div>
      </header>

      {/* Main Family Companion Surface */}
      <main className="flex-1 mx-auto max-w-lg w-full px-4 py-6 flex flex-col gap-5">
        {/* Viewing As / Member Switcher */}
        {members.length > 1 && (
          <div className="rounded-xl bg-white border border-slate-200/80 p-3 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Users className="w-4 h-4 text-teal-600" />
              <span className="font-medium">{t('family_view_as_label')}:</span>
            </div>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.caregiverName} ({m.relationship}) — {m.authorized ? 'Active' : 'Revoked'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Headline */}
        <div className="text-center animate-fade-in pt-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200/60 px-3 py-1 rounded-full mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>{t('family_consent_status')}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {t('family_headline')}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {liveView.patientName} &bull; {liveView.caregiverName} ({liveView.relationship})
          </p>
        </div>

        {/* Consent Status Card */}
        <div
          className={cn(
            'rounded-2xl border p-4 flex items-start gap-3.5 transition-all shadow-xs',
            !isAuthorized
              ? 'border-rose-200 bg-rose-50/80'
              : 'border-emerald-200 bg-emerald-50/70'
          )}
        >
          {!isAuthorized ? (
            <ShieldX className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t('family_consent_status')}
              </span>
              <span
                className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  !isAuthorized
                    ? 'bg-rose-200/80 text-rose-900'
                    : 'bg-emerald-200/80 text-emerald-900'
                )}
              >
                {!isAuthorized ? t('family_status_revoked') : t('family_consent_active')}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
              {!isAuthorized
                ? t('family_access_revoked_notice')
                : lang === 'hi'
                ? 'मरीज ने आपके साथ रिकवरी अपडेट साझा करने की अनुमति दी है।'
                : 'The patient has granted you access to their recovery updates.'}
            </p>
          </div>
        </div>

        {/* FAIL-CLOSED ACCESS REVOKED STATE */}
        {!isAuthorized ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center flex flex-col gap-3 items-center shadow-xs animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-100/70 text-rose-600 flex items-center justify-center">
              <ShieldX className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              {t('family_status_revoked')}
            </h3>
            <p className="text-sm text-slate-600 max-w-sm leading-relaxed">
              {t('family_access_revoked_notice')}
            </p>
            <div className="mt-2 text-xs text-slate-400 bg-slate-50 border border-slate-200/80 rounded-xl p-3 max-w-sm">
              <p>
                {lang === 'hi'
                  ? 'सुरक्षा कारणों से, केवल मरीज ही अपने डैशबोर्ड से पहुंच को पुनः बहाल कर सकते हैं।'
                  : 'For patient privacy and clinical security, access can only be restored directly by the patient.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* CATEGORY 1: TODAY'S MEDICINES (CONDITIONAL) */}
            {perms.shareMedicationStatus && liveView.dosesToday ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3.5 shadow-xs animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-teal-600" />
                    <span className="text-sm font-bold text-slate-900">
                      {t('family_perm_meds')}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    {liveView.dosesToday.taken} / {liveView.dosesToday.total} {lang === 'hi' ? 'खुराक' : 'Doses'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-600">
                    {t('family_doses_today', { count: liveView.dosesToday.taken })}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: liveView.dosesToday.total }, (_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-3.5 h-3.5 rounded-full transition-all',
                          i < liveView.dosesToday!.taken
                            ? 'bg-emerald-500 ring-2 ring-emerald-100'
                            : 'bg-slate-200'
                        )}
                      />
                    ))}
                  </div>
                </div>

                {liveView.nextDoseTime && (
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 pt-2 border-t border-slate-100">
                    <Clock className="w-4 h-4 text-teal-600" />
                    <span>{t('family_next_dose', { time: liveView.nextDoseTime })}</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* CATEGORY 2: HEALTH STATUS (CONDITIONAL) */}
            {perms.shareDailyVitals && liveView.healthUpdateStatus ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-2.5 shadow-xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-600" />
                  <span className="text-sm font-bold text-slate-900">
                    {t('family_perm_vitals')}
                  </span>
                </div>
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3 font-medium">
                  {t('family_health_update', { status: liveView.healthUpdateStatus })}
                </p>
              </div>
            ) : null}

            {/* MISSED DOSE ALERT (IF PERMITTED) */}
            {perms.shareMedicationStatus && liveView.missedDose && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex flex-col gap-2 shadow-xs">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-amber-900">
                      {t('family_missed_dose')}
                    </span>
                    <span className="text-xs text-amber-800">
                      {lang === 'hi' ? 'कृपया मरीज से प्यार से संपर्क करें।' : 'Please check in gently with the patient.'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CATEGORY 3: CARE INSTRUCTIONS & RECOVERY GUIDELINES (CONDITIONAL) */}
            {perms.shareCareInstructions && liveView.careInstructions && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3 shadow-xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-teal-600" />
                  <span className="text-sm font-bold text-slate-900">
                    {t('family_care_instructions_title')}
                  </span>
                </div>
                <ul className="space-y-2">
                  {liveView.careInstructions.map((instruction, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CATEGORY 4: DIRECT CALLING (CONDITIONAL) */}
            {perms.allowDirectCalling && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3 shadow-xs animate-fade-in">
                {liveView.contactNumber ? (
                  <a
                    href={`tel:${liveView.contactNumber}`}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white py-3.5 text-base font-bold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/20 active:scale-[0.99]"
                  >
                    <Phone className="w-5 h-5" />
                    <span>{t('family_call')} ({liveView.contactNumber})</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <PhoneOff className="w-6 h-6 text-slate-300" />
                    <p className="text-xs text-slate-400 text-center">{t('family_call_unavailable')}</p>
                  </div>
                )}
              </div>
            )}

            {/* CATEGORY 5: RECOVERY COORDINATION & ENCOURAGEMENT NOTES */}
            <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/50 via-white to-pink-50/20 p-5 flex flex-col gap-3.5 shadow-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <MessageSquareHeart className="w-5 h-5 text-rose-500" />
                <span className="text-sm font-bold text-slate-900">
                  {lang === 'hi' ? 'मरीज को प्रोत्साहन संदेश भेजें' : 'Send Note of Encouragement'}
                </span>
              </div>

              <form onSubmit={handleSendNote} className="flex flex-col gap-2.5">
                <textarea
                  rows={2}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder={t('family_support_note_placeholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white resize-none"
                />
                <button
                  type="submit"
                  disabled={!supportMessage.trim()}
                  className="self-end inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('family_send_support_note')}</span>
                </button>
              </form>

              {/* Display recent messages */}
              {liveView.supportNotes.length > 0 && (
                <div className="pt-2 border-t border-rose-100/80 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    {lang === 'hi' ? 'हालिया संदेश' : 'Recent Family Messages'}
                  </span>
                  {liveView.supportNotes.slice(0, 3).map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl bg-white/80 border border-rose-100/60 p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-semibold text-slate-800">
                          {note.caregiverName} ({note.relationship})
                        </span>
                        <span>{new Date(note.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-700 italic">"{note.message}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Privacy Notice Banner */}
            <div className="rounded-xl bg-slate-100/80 border border-slate-200 p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                {t('family_access_limited')}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
