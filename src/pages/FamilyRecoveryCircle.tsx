import { useState, useEffect, useMemo } from 'react';
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
  Bell,
  Calendar,
  Lock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  UserCheck,
  Hourglass,
  AlertCircle,
  ListTodo
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
  onNavigateRole?: (role: 'doctor' | 'patient' | 'admin') => void;
}

type FamilyTab = 'overview' | 'milestones' | 'privacy';

type MockStateMode = 'standard' | 'pending' | 'expired' | 'error';

export function FamilyRecoveryCircle({ onBack, onNavigateRole }: FamilyRecoveryCircleProps) {
  const { t, lang } = useLanguage();
  const patientId = 'p1';

  // Members list & active selection
  const [members, setMembers] = useState<FamilyCircleMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('fcm_1');
  const [activeTab, setActiveTab] = useState<FamilyTab>('overview');

  // Test harness mode to test states: standard, pending, expired, error
  const [demoStateMode, setDemoStateMode] = useState<MockStateMode>('standard');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Encouragement note form & toasts
  const [supportMessage, setSupportMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Notifications dropdown
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState<
    { id: string; title: string; time: string; read: boolean }[]
  >([
    { id: 'notif_1', title: 'Morning medicine doses taken on schedule', time: '08:15 AM', read: false },
    { id: 'notif_2', title: 'New doctor-approved hydration guideline shared', time: '11:00 AM', read: false },
  ]);

  // Load current member & granular view
  const [liveView, setLiveView] = useState<GranularFamilyView>(() =>
    familyConsentService.getGranularFamilyView(patientId, 'fcm_1')
  );

  const refreshData = () => {
    const allMembers = familyConsentService.listMembers(patientId);
    setMembers(allMembers);
    const updatedView = familyConsentService.getGranularFamilyView(patientId, selectedMemberId);
    setLiveView(updatedView);
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = familyConsentService.subscribe(refreshData);
    return () => unsubscribe();
  }, [patientId, selectedMemberId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      refreshData();
      setIsRefreshing(false);
      showToast(lang === 'hi' ? 'रिकवरी डेटा रिफ्रेश किया गया' : 'Recovery data refreshed');
    }, 400);
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

  const handleQuickPrompt = (prompt: string) => {
    setSupportMessage(prompt);
  };

  const handleAcknowledge = (updateId: string) => {
    familyConsentService.acknowledgeUpdate(updateId, liveView.caregiverMemberId);
    refreshData();
    showToast(lang === 'hi' ? 'अपडेट परिवार द्वारा देखा गया' : 'Update acknowledged by family');
  };

  const handleMarkAllRead = () => {
    setUnreadNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setShowNotifications(false);
    showToast(lang === 'hi' ? 'सभी सूचनाएं पढ़ी गईं' : 'All notifications marked as read');
  };

  // Determine effective authorization status
  const isAuthorized =
    demoStateMode === 'standard' && liveView.authorized && liveView.status === 'accepted';
  const perms = liveView.permissions;

  // Unread count
  const unreadCount = unreadNotifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-teal-500/20 selection:text-teal-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-5 py-3 text-sm font-medium shadow-2xl flex items-center gap-2.5 animate-slide-up border border-slate-700"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <header className="border-b border-slate-200/90 bg-white sticky top-0 z-30 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
          {/* Brand & Circle Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Back to Portal"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'hi' ? 'वापस' : 'Portal'}</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <PulseBridgeLogo variant="light" size="sm" showTagline={false} />

            <div className="hidden md:flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Family Recovery Circle</span>
            </div>
          </div>

          {/* Center Patient & Persona Indicator */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/80 border border-slate-200/80 px-3 py-1.5 text-xs text-slate-700">
              <UserCheck className="w-4 h-4 text-teal-600" />
              <span className="font-semibold text-slate-900">{liveView.patientName}</span>
              <span className="text-slate-400">&bull;</span>
              <span>{liveView.caregiverName} ({liveView.relationship})</span>
            </div>
          </div>

          {/* Right Utility Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Manual Refresh */}
            <button
              onClick={handleManualRefresh}
              aria-label="Refresh updates"
              title="Refresh recovery updates"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-teal-600')} />
            </button>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="View notifications"
                className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 z-50 animate-scale-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 px-1">
                    <span className="text-xs font-bold text-slate-800">
                      {t('family_notifications_title')}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                      >
                        {t('family_mark_all_read')}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {unreadNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          'p-2 rounded-xl text-xs flex flex-col gap-0.5 transition-colors',
                          n.read ? 'bg-slate-50 text-slate-500' : 'bg-teal-50/60 text-slate-800 font-medium'
                        )}
                      >
                        <span>{n.title}</span>
                        <span className="text-[10px] text-slate-400">{n.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DemoBadge variant="light" />
            <LanguageToggle variant="light" />

            {/* Role switch / logout */}
            {onNavigateRole && (
              <button
                onClick={() => onNavigateRole('patient')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="Switch to Patient Dashboard"
              >
                <span>{lang === 'hi' ? 'मरीज डैशबोर्ड' : 'Patient View'}</span>
              </button>
            )}

            <button
              onClick={onBack}
              aria-label="Back to Portal"
              title="Return to main portal"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* SUB-BAR / PERSONA & STATE SWITCHER (FOR TESTING & DEMO TRANSPARENCY) */}
      <div className="bg-slate-100/90 border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-2">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
            <span className="font-semibold text-slate-700">{t('family_view_as_label')}:</span>
            <select
              value={selectedMemberId}
              aria-label={t('family_view_as_label')}
              onChange={(e) => {
                setSelectedMemberId(e.target.value);
                setDemoStateMode('standard');
              }}
              className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.caregiverName} ({m.relationship}) &bull; {m.authorized ? t('family_consent_active') : t('family_status_revoked')}
                </option>
              ))}
            </select>
          </div>

          {/* Test Harness Mode Switcher */}
          <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label={t('family_state_simulator_label')}>
            <span className="text-[11px] text-slate-500 font-medium">{t('family_state_simulator_label')}:</span>
            <button
              onClick={() => setDemoStateMode('standard')}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500',
                demoStateMode === 'standard' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              )}
            >
              {t('family_state_normal')}
            </button>
            <button
              onClick={() => setDemoStateMode('pending')}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500',
                demoStateMode === 'pending' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              )}
            >
              {t('family_state_pending')}
            </button>
            <button
              onClick={() => setDemoStateMode('expired')}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500',
                demoStateMode === 'expired' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              )}
            >
              {t('family_state_expired')}
            </button>
            <button
              onClick={() => setDemoStateMode('error')}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500',
                demoStateMode === 'error' ? 'bg-rose-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              )}
            >
              {t('family_state_error')}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex flex-col gap-6">
        {/* WELCOME HERO SECTION */}
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-slate-900 via-navy-900 to-sky-950 text-white p-6 md:p-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-3xl flex flex-col gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-300 bg-teal-950/80 border border-teal-700/60 px-3 py-1 rounded-full w-fit">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
              <span>{t('family_active_verified')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              {t('family_welcome_title')}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              {t('family_welcome_sub')}
            </p>

            {/* Non-alarming, honest monitoring disclaimer */}
            <div className="mt-3 flex items-start gap-2.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-3 text-xs text-slate-200 max-w-2xl">
              <Info className="w-4 h-4 text-teal-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">
                {t('family_non_monitoring_note')}
              </p>
            </div>
          </div>
        </div>

        {/* SIMULATED NON-STANDARD STATES */}
        {demoStateMode === 'error' && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/90 p-8 text-center flex flex-col items-center gap-3 shadow-xs">
            <AlertCircle className="w-12 h-12 text-rose-600" aria-hidden="true" />
            <h2 className="text-lg font-bold text-rose-950">{t('family_error_connection_title')}</h2>
            <p className="text-sm text-rose-800 max-w-md">
              {t('family_error_connection_desc')}
            </p>
            <button
              onClick={() => setDemoStateMode('standard')}
              className="mt-2 px-4 py-2 bg-rose-600 text-white font-semibold text-xs rounded-xl hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-colors shadow-sm"
            >
              {t('family_error_retry_btn')}
            </button>
          </div>
        )}

        {demoStateMode === 'pending' && (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50/90 p-8 text-center flex flex-col items-center gap-3 shadow-xs">
            <Hourglass className="w-12 h-12 text-amber-600 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
            <h2 className="text-lg font-bold text-amber-950">{t('family_status_pending')}</h2>
            <p className="text-sm text-amber-800 max-w-md">
              {lang === 'hi'
                ? `${liveView.patientName} के रिकवरी सर्कल में शामिल होने का आपका निमंत्रण मरीज की पुष्टि की प्रतीक्षा कर रहा है।`
                : `Your invitation to join ${liveView.patientName}’s recovery circle is pending patient confirmation.`}
            </p>
            <div className="bg-white/80 border border-amber-200 rounded-xl px-4 py-2 font-mono text-xs text-amber-900 mt-1">
              {t('family_invite_code_label')}: {liveView.caregiverMemberId ? 'PB-REC-9942' : 'PB-REC-PENDING'}
            </div>
          </div>
        )}

        {demoStateMode === 'expired' && (
          <div role="status" className="rounded-2xl border border-slate-300 bg-slate-100 p-8 text-center flex flex-col items-center gap-3 shadow-xs">
            <Clock className="w-12 h-12 text-slate-400" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900">{t('family_status_expired')}</h2>
            <p className="text-sm text-slate-600 max-w-md">
              {lang === 'hi'
                ? `सुरक्षा कारणों से यह निमंत्रण समाप्त हो गया है। कृपया ${liveView.patientName} से नया कोड भेजने का अनुरोध करें।`
                : `This family circle invitation link has expired for security reasons. Please ask ${liveView.patientName} to send a new invite code from their dashboard.`}
            </p>
          </div>
        )}

        {/* STANDARD STATE WORKFLOW */}
        {demoStateMode === 'standard' && (
          <>
            {/* If Revoked / Fail-closed State */}
            {!isAuthorized ? (
              <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center flex flex-col gap-4 items-center shadow-xs animate-fade-in max-w-2xl mx-auto w-full">
                <div className="w-16 h-16 rounded-2xl bg-rose-100/80 text-rose-600 flex items-center justify-center shadow-inner">
                  <ShieldX className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    {t('family_status_revoked')}
                  </h2>
                  <p className="text-sm text-slate-600 max-w-md mt-1.5 leading-relaxed">
                    {t('family_access_revoked_notice')}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-500 text-left max-w-md space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-700">
                    <Lock className="w-4 h-4 text-rose-500" />
                    <span>Patient-Controlled Privacy Enforcement</span>
                  </div>
                  <p>
                    All clinical records, medication dose logs, and personal updates have been strictly redacted.
                    For patient privacy, family members cannot self-authorize or override access restrictions.
                  </p>
                </div>
              </div>
            ) : (
              /* Authorized Dashboard Grid */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT COLUMN: PATIENT CONNECTION CARD & QUICK SUPPORT ACTIONS (lg:col-span-4) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  {/* Patient Connection Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs flex flex-col gap-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {t('family_conn_status_label')}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        {t('family_consent_active')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-teal-100/80 text-teal-800 font-bold text-lg flex items-center justify-center flex-shrink-0">
                        {liveView.patientName.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900 leading-snug">
                          {liveView.patientName}
                        </h2>
                        <span className="text-xs text-slate-500 block">
                          {liveView.relationship} &bull; ID: {liveView.patientId}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex flex-col gap-0.5">
                        <span className="text-[11px] text-slate-400">{t('family_last_update_label')}</span>
                        <span className="font-semibold text-slate-800">
                          {liveView.lastUpdateTimestamp
                            ? new Date(liveView.lastUpdateTimestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Today'}
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex flex-col gap-0.5">
                        <span className="text-[11px] text-slate-400">Consent Type</span>
                        <span className="font-semibold text-teal-800">Patient-Granted</span>
                      </div>
                    </div>

                    {/* Direct Calling Action */}
                    {perms.allowDirectCalling && (
                      <div className="pt-2">
                        {liveView.contactNumber ? (
                          <a
                            href={`tel:${liveView.contactNumber}`}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-sm font-bold transition-all shadow-sm shadow-emerald-600/20 active:scale-[0.99]"
                          >
                            <Phone className="w-4 h-4" />
                            <span>{t('family_call')} ({liveView.contactNumber})</span>
                          </a>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                            <PhoneOff className="w-4 h-4" />
                            <span>{t('family_call_unavailable')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Encouragement Note & Support Messaging */}
                  <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/40 via-white to-pink-50/20 p-5 md:p-6 shadow-xs flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                        <MessageSquareHeart className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {t('family_send_support_note')}
                        </h3>
                        <span className="text-[11px] text-slate-500">
                          Send reassurance to {liveView.patientName}
                        </span>
                      </div>
                    </div>

                    {/* Quick suggestion pills */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Quick Encouragements:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickPrompt(t('family_support_quick_prompt1'))}
                        className="text-left text-xs bg-white border border-rose-200/80 hover:border-rose-300 p-2 rounded-xl text-slate-700 hover:bg-rose-50/50 transition-colors"
                      >
                        {t('family_support_quick_prompt1')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickPrompt(t('family_support_quick_prompt2'))}
                        className="text-left text-xs bg-white border border-rose-200/80 hover:border-rose-300 p-2 rounded-xl text-slate-700 hover:bg-rose-50/50 transition-colors"
                      >
                        {t('family_support_quick_prompt2')}
                      </button>
                    </div>

                    <form onSubmit={handleSendNote} className="flex flex-col gap-2 pt-1">
                      <textarea
                        rows={3}
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        placeholder={t('family_support_note_placeholder')}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white resize-none"
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
                  </div>

                  {/* Clinical Safety Disclaimer */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-100/80 p-4 text-xs text-slate-600 leading-relaxed space-y-1.5">
                    <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      Family Support Safety Boundary
                    </span>
                    <p>
                      Family members can provide emotional reassurance, acknowledge updates, and view approved care instructions.
                      Prescriptions, medication schedules, and clinical treatment decisions are governed exclusively by the physician and patient.
                    </p>
                  </div>
                </div>

                {/* RIGHT COLUMN: RECOVERY TIMELINE & TABS (lg:col-span-8) */}
                <div className="lg:col-span-8 flex flex-col gap-5">
                  {/* Tab Selector */}
                  <div className="flex items-center gap-2 border-b border-slate-200/80 pb-px overflow-x-auto">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
                        activeTab === 'overview'
                          ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
                          : 'text-slate-500 border-transparent hover:text-slate-800'
                      )}
                    >
                      <Activity className="w-4 h-4 text-teal-600" />
                      <span>{t('family_tab_overview')}</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('milestones')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
                        activeTab === 'milestones'
                          ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
                          : 'text-slate-500 border-transparent hover:text-slate-800'
                      )}
                    >
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <span>{t('family_tab_milestones')}</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('privacy')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
                        activeTab === 'privacy'
                          ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
                          : 'text-slate-500 border-transparent hover:text-slate-800'
                      )}
                    >
                      <ShieldCheck className="w-4 h-4 text-teal-600" />
                      <span>{t('family_tab_privacy')}</span>
                    </button>
                  </div>

                  {/* TAB 1: SHARED RECOVERY UPDATES (TIMELINE) */}
                  {activeTab === 'overview' && (
                    <div className="flex flex-col gap-5 animate-fade-in">
                      {/* Section Heading */}
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          {t('family_timeline_title')}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t('family_timeline_subtitle')}
                        </p>
                      </div>

                      {/* Missed Dose Alert (if applicable and permitted) */}
                      {perms.shareMedicationStatus && liveView.missedDose && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 flex items-start gap-3 shadow-xs">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-1 flex-1">
                            <span className="text-sm font-bold text-amber-900">
                              {t('family_missed_dose')}
                            </span>
                            <span className="text-xs text-amber-800">
                              {lang === 'hi'
                                ? 'कृपया मरीज से प्यार से संपर्क करें और यदि सहायता की आवश्यकता हो तो पूछें।'
                                : 'A scheduled dose was not taken. Please check in gently with your loved one.'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* TIMELINE ITEMS STREAM */}
                      <div className="space-y-4">
                        {/* 1. Medication Progress Update Card */}
                        {perms.shareMedicationStatus && liveView.dosesToday ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                                  <Heart className="w-4 h-4" />
                                </span>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900">
                                    {t('family_perm_meds')}
                                  </h3>
                                  <span className="text-[11px] text-slate-400">
                                    {t('family_source_meds')} &bull; Today
                                  </span>
                                </div>
                              </div>

                              {/* Acknowledge Button */}
                              {liveView.acknowledgedUpdates.includes('meds_today') ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {t('family_btn_acknowledged')}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAcknowledge('meds_today')}
                                  className="text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-full transition-colors"
                                >
                                  {t('family_btn_acknowledge')}
                                </button>
                              )}
                            </div>

                            <div className="flex items-center justify-between py-1 bg-slate-50/70 rounded-xl px-4">
                              <span className="text-sm font-medium text-slate-700">
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
                              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 pt-1 border-t border-slate-100">
                                <Clock className="w-3.5 h-3.5 text-teal-600" />
                                <span>{t('family_next_dose', { time: liveView.nextDoseTime })}</span>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {/* 2. Daily Wellness / Vitals Check-in Card */}
                        {perms.shareDailyVitals && liveView.healthUpdateStatus ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                                  <Activity className="w-4 h-4" />
                                </span>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900">
                                    {t('family_perm_vitals')}
                                  </h3>
                                  <span className="text-[11px] text-slate-400">
                                    {t('family_source_patient')} &bull; Today
                                  </span>
                                </div>
                              </div>

                              {liveView.acknowledgedUpdates.includes('vitals_today') ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {t('family_btn_acknowledged')}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAcknowledge('vitals_today')}
                                  className="text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-full transition-colors"
                                >
                                  {t('family_btn_acknowledge')}
                                </button>
                              )}
                            </div>

                            <p className="text-sm text-slate-800 bg-slate-50 border border-slate-100 rounded-xl p-3 font-medium">
                              {t('family_health_update', { status: liveView.healthUpdateStatus })}
                            </p>
                          </div>
                        ) : null}

                        {/* 3. Doctor-Approved Care Guidelines Card */}
                        {perms.shareCareInstructions && liveView.careInstructions ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                                  <FileCheck className="w-4 h-4" />
                                </span>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900">
                                    {t('family_care_instructions_title')}
                                  </h3>
                                  <span className="text-[11px] text-slate-400">
                                    {t('family_source_doctor')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <ul className="space-y-2 pt-1">
                              {liveView.careInstructions.map((instruction, idx) => (
                                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0" />
                                  <span>{instruction}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {/* 4. Closed-Loop Care & Recovery Actions Card */}
                        {perms.shareCareActions && (
                          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                                  <ListTodo className="w-4 h-4" />
                                </span>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900">
                                    {t('family_care_actions_title')}
                                  </h3>
                                  <span className="text-[11px] text-slate-400">
                                    {t('family_care_actions_subtitle')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {liveView.sharedCareActions && liveView.sharedCareActions.length > 0 ? (
                              <div className="space-y-3">
                                {liveView.sharedCareActions.map((action) => (
                                  <div
                                    key={action.id}
                                    className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 flex flex-col gap-2 hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                          <h4 className="text-xs font-bold text-slate-900">
                                            {action.title}
                                          </h4>
                                          <span
                                            className={cn(
                                              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                              action.status === 'resolved'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : action.status === 'in_progress'
                                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                                : action.status === 'documented'
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                            )}
                                          >
                                            {action.statusLabel}
                                          </span>
                                          {action.priority === 'urgent' && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                                              Urgent
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                          {action.explanation}
                                        </p>
                                      </div>

                                      {/* Acknowledge Button */}
                                      <div className="flex-shrink-0">
                                        {action.familyAcknowledged ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            {t('family_care_action_acked_badge')}
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => handleAcknowledge(action.id)}
                                            className="text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-full transition-colors active:scale-95"
                                          >
                                            {t('family_care_action_ack_btn')}
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/50 flex-wrap gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-600">
                                          {action.sourceRole}
                                          {action.responsibleName ? ` • ${action.responsibleName}` : ''}
                                        </span>
                                      </div>
                                      {action.dueDate && (
                                        <span className="flex items-center gap-1 text-slate-500 font-medium">
                                          <Clock className="w-3 h-3 text-slate-400" />
                                          {t('family_care_action_due_label')}: {new Date(action.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-400">
                                {t('family_care_actions_empty')}
                              </div>
                            )}

                            {/* Safety Decoupling Disclaimer */}
                            <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center gap-2">
                              <Info className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                              <span>{t('family_care_action_decoupled_disclaimer')}</span>
                            </div>
                          </div>
                        )}

                        {/* 5. Recent Encouragement Notes Thread */}
                        {liveView.supportNotes.length > 0 && (
                          <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-xs flex flex-col gap-3">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <MessageSquareHeart className="w-4 h-4 text-rose-500" />
                              <span>{t('family_support_notes_title')}</span>
                            </h3>

                            <div className="space-y-2">
                              {liveView.supportNotes.map((note) => (
                                <div
                                  key={note.id}
                                  className="rounded-xl bg-rose-50/40 border border-rose-100 p-3 text-xs"
                                >
                                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                                    <span className="font-bold text-slate-800">
                                      {note.caregiverName} ({note.relationship})
                                    </span>
                                    <span>
                                      {new Date(note.sentAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-slate-700 italic">"{note.message}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: CARE MILESTONES & APPOINTMENTS */}
                  {activeTab === 'milestones' && (
                    <div className="flex flex-col gap-6 animate-fade-in">
                      {/* Authorized Consultations */}
                      <div className="flex flex-col gap-3">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-teal-600" />
                          <span>{t('family_shared_appointments_title')}</span>
                        </h3>

                        {liveView.sharedAppointments && liveView.sharedAppointments.length > 0 ? (
                          <div className="grid grid-cols-1 gap-3">
                            {liveView.sharedAppointments.map((apt) => (
                              <div
                                key={apt.id}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div>
                                  <h4 className="text-sm font-bold text-slate-900">{apt.doctorName}</h4>
                                  <span className="text-xs text-slate-500">{apt.department}</span>
                                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 mt-2">
                                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                                    <span>{apt.date} at {apt.time}</span>
                                  </div>
                                </div>
                                <span className="inline-flex items-center self-start sm:self-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  {apt.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                            No upcoming scheduled consultations have been shared.
                          </div>
                        )}
                      </div>

                      {/* Recovery Milestones */}
                      <div className="flex flex-col gap-3 pt-2">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-teal-600" />
                          <span>Recovery Milestones</span>
                        </h3>

                        {liveView.recoveryMilestones && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {liveView.recoveryMilestones.map((ms) => (
                              <div
                                key={ms.id}
                                className={cn(
                                  'rounded-2xl border p-4 shadow-xs flex flex-col justify-between gap-2',
                                  ms.achieved
                                    ? 'bg-teal-50/50 border-teal-200/80 text-teal-950'
                                    : 'bg-white border-slate-200 text-slate-600'
                                )}
                              >
                                <div>
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="font-bold text-xs">{ms.title}</span>
                                    {ms.achieved && (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500">{ms.subtitle}</p>
                                </div>
                                {ms.date && (
                                  <span className="text-[10px] font-semibold text-teal-700 bg-teal-100/60 px-2 py-0.5 rounded-full w-fit">
                                    {ms.date}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PRIVACY & PERMISSIONS MATRIX */}
                  {activeTab === 'privacy' && (
                    <div className="flex flex-col gap-6 animate-fade-in">
                      {/* Privacy Center Hero */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col gap-2">
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-teal-600" />
                          <span>{t('family_privacy_center_title')}</span>
                        </h2>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {t('family_privacy_center_desc')}
                        </p>
                      </div>

                      {/* Active Permissions vs Protected Boundaries */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Permitted Categories */}
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 flex flex-col gap-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            {t('family_perm_active_title')}
                          </span>

                          <ul className="space-y-2 text-xs">
                            <li className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-emerald-100">
                              <span className="font-medium text-slate-800">{t('family_perm_meds')}</span>
                              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded', perms.shareMedicationStatus ? 'text-emerald-700 bg-emerald-100' : 'text-slate-400 bg-slate-100')}>
                                {perms.shareMedicationStatus ? 'Active' : 'Disabled'}
                              </span>
                            </li>
                            <li className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-emerald-100">
                              <span className="font-medium text-slate-800">{t('family_perm_vitals')}</span>
                              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded', perms.shareDailyVitals ? 'text-emerald-700 bg-emerald-100' : 'text-slate-400 bg-slate-100')}>
                                {perms.shareDailyVitals ? 'Active' : 'Disabled'}
                              </span>
                            </li>
                            <li className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-emerald-100">
                              <span className="font-medium text-slate-800">{t('family_perm_calls')}</span>
                              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded', perms.allowDirectCalling ? 'text-emerald-700 bg-emerald-100' : 'text-slate-400 bg-slate-100')}>
                                {perms.allowDirectCalling ? 'Active' : 'Disabled'}
                              </span>
                            </li>
                            <li className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-emerald-100">
                              <span className="font-medium text-slate-800">{t('family_perm_instructions')}</span>
                              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded', perms.shareCareInstructions ? 'text-emerald-700 bg-emerald-100' : 'text-slate-400 bg-slate-100')}>
                                {perms.shareCareInstructions ? 'Active' : 'Disabled'}
                              </span>
                            </li>
                          </ul>
                        </div>

                        {/* Strictly Protected Categories */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 flex flex-col gap-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Lock className="w-4 h-4 text-slate-500" />
                            {t('family_perm_restricted_title')}
                          </span>

                          <ul className="space-y-2 text-xs">
                            <li className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-start gap-2">
                              <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-600">{t('family_restricted_rx_full')}</span>
                            </li>
                            <li className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-start gap-2">
                              <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-600">{t('family_restricted_soap')}</span>
                            </li>
                            <li className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-start gap-2">
                              <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-600">{t('family_restricted_override')}</span>
                            </li>
                            <li className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-start gap-2">
                              <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-600">{t('family_restricted_triage')}</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
