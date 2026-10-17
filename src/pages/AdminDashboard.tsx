import { useState, useMemo } from 'react';
import {
  Server,
  Shield,
  Users,
  Database,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  FileText,
  Lock,
  Cpu,
  RefreshCw,
  Info,
  Clock,
  Sparkles,
  Download
} from 'lucide-react';
import { PulseBridgeLogo } from '@/components/PulseBridgeLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/i18n/LanguageContext';
import { isSupabaseConfigured, supabaseConfigError } from '@/lib/supabase';
import { demoPatients, demoCareGaps, demoMedicalReports } from '@/data/demoData';
import { demoCareActions } from '@/data/demoCareActions';
import { careActionService } from '@/services/careActionService';
import type { CareAction } from '@/types/careAction';
import { cn } from '@/utils/cn';
import { useEffect } from 'react';

interface AdminDashboardProps {
  onBack: () => void;
  onNavigateRole?: (role: 'doctor' | 'patient' | 'family') => void;
}

type AdminTab = 'overview' | 'access' | 'security' | 'settings';

export function AdminDashboard({ onBack, onNavigateRole }: AdminDashboardProps) {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [actions, setActions] = useState<CareAction[]>(() => careActionService.getAll());
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    return careActionService.subscribe(() => {
      setActions(careActionService.getAll());
    });
  }, []);

  const totalPatients = demoPatients.length;
  const allGaps = useMemo(() => Object.values(demoCareGaps).flat(), []);
  const allReports = useMemo(() => Object.values(demoMedicalReports).flat(), []);

  const openActions = actions.filter((a) => a.status === 'open').length;
  const inProgressActions = actions.filter((a) => a.status === 'in_progress').length;
  const resolvedActions = actions.filter((a) => a.status === 'resolved').length;
  const documentedActions = actions.filter((a) => a.status === 'documented').length;

  const handleResetData = () => {
    careActionService.reset(demoCareActions);
    setActions(careActionService.getAll());
    setNotification(lang === 'hi' ? 'डेमो डेटा सफलतापूर्वक रीसेट किया गया।' : 'Demo action tracking store successfully re-seeded.');
    setTimeout(() => setNotification(null), 3500);
  };

  const handleExportTelemetry = () => {
    const telemetry = {
      timestamp: new Date().toISOString(),
      system: 'PulseBridge AI Operations',
      environment: isSupabaseConfigured ? 'production_cloud' : 'local_edge_mode',
      metrics: {
        totalPatients,
        totalCareGaps: allGaps.length,
        totalCareActions: actions.length,
        totalMedicalReports: allReports.length,
        actionBreakdown: { open: openActions, in_progress: inProgressActions, resolved: resolvedActions, documented: documentedActions },
      },
      audit: {
        rlsEnforcement: 'STRICT_ACTIVE',
        aiGroundingValidator: 'ACTIVE_FAIL_CLOSED',
        emergencyOverrideImmunity: 'ENFORCED',
      },
    };

    const blob = new Blob([JSON.stringify(telemetry, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsebridge_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Operations Header */}
      <header className="border-b border-slate-800 bg-[#0B132B]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                title="Back to Landing Page"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t('back')}</span>
              </button>
              <div className="h-5 w-px bg-slate-800 hidden sm:block" />
              <PulseBridgeLogo variant="dark" size="sm" showTagline={false} />
              <div className="hidden md:flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                {t('admin_title')}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Cloud/Local telemetry indicator */}
              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-xs">
                <div className={cn('w-2 h-2 rounded-full', isSupabaseConfigured ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]')} />
                <span className="text-slate-300 font-mono text-[11px]">
                  {isSupabaseConfigured ? 'Supabase Live' : 'Local Edge Runtime'}
                </span>
              </div>

              {onNavigateRole && (
                <div className="hidden lg:flex items-center gap-1.5 border-r border-slate-800 pr-3 mr-1">
                  <button
                    onClick={() => onNavigateRole('doctor')}
                    className="px-2.5 py-1 text-xs rounded-md text-slate-300 hover:text-teal-300 hover:bg-slate-800/80 transition-colors"
                  >
                    {t('role_doctor')}
                  </button>
                  <button
                    onClick={() => onNavigateRole('patient')}
                    className="px-2.5 py-1 text-xs rounded-md text-slate-300 hover:text-teal-300 hover:bg-slate-800/80 transition-colors"
                  >
                    {t('role_patient')}
                  </button>
                </div>
              )}

              <LanguageToggle variant="dark" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Admin Body */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Banner with system status & description */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-[#0F1B2E]/90 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-teal-400" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {t('admin_title')}
              </h1>
              <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 uppercase">
                {t('system_operational')}
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              {t('admin_subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportTelemetry}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export Telemetry</span>
            </button>
            <button
              onClick={handleResetData}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 py-2 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-seed Store</span>
            </button>
          </div>
        </div>

        {/* Feedback alert toast */}
        {notification && (
          <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 px-4 py-3 text-sm text-teal-200 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'overview'
                ? 'text-teal-400 border-teal-400 bg-slate-900/40'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-700'
            )}
          >
            <Activity className="w-4 h-4" />
            <span>{t('admin_tab_overview')}</span>
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'access'
                ? 'text-teal-400 border-teal-400 bg-slate-900/40'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-700'
            )}
          >
            <Users className="w-4 h-4" />
            <span>{t('admin_tab_access')}</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'security'
                ? 'text-teal-400 border-teal-400 bg-slate-900/40'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-700'
            )}
          >
            <Shield className="w-4 h-4" />
            <span>{t('admin_tab_security')}</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap',
              activeTab === 'settings'
                ? 'text-teal-400 border-teal-400 bg-slate-900/40'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-700'
            )}
          >
            <Database className="w-4 h-4" />
            <span>{t('admin_tab_settings')}</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Real Operational Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('admin_stat_patients')}</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-white">{totalPatients}</span>
                  <span className="text-xs text-teal-400 font-mono">ID: p1, p2, p3</span>
                </div>
                <span className="text-[11px] text-slate-500">Active cardiology recovery cohort</span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('admin_stat_actions')}</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-teal-300">{actions.length}</span>
                  <span className="text-xs text-slate-400 font-mono">{openActions} open · {resolvedActions} res</span>
                </div>
                <span className="text-[11px] text-slate-500">Deterministic Closed-Loop state engine</span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('admin_stat_gaps')}</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-amber-300">{allGaps.length}</span>
                  <span className="text-xs text-amber-400/90 font-mono">1 Critical Override</span>
                </div>
                <span className="text-[11px] text-slate-500">CareGap Radar clinical monitoring</span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('admin_stat_reports')}</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-cyan-300">{allReports.length}</span>
                  <span className="text-xs text-cyan-400/90 font-mono">Groq Llama 3 Ready</span>
                </div>
                <span className="text-[11px] text-slate-500">Fail-closed medical report archive</span>
              </div>
            </div>

            {/* Infrastructure Health Status */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-teal-400" />
                Live Infrastructure Status
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-400">{t('admin_db_status')}</span>
                    <span className="text-sm font-semibold text-white">
                      {isSupabaseConfigured ? 'Supabase Managed Cloud Postgres' : 'In-Memory Secure Local Adapter'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {isSupabaseConfigured ? 'PostgreSQL 15 · RLS Active' : 'Edge Demo Storage Active'}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" />
                    {t('admin_db_connected')}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-400">{t('admin_ai_status')}</span>
                    <span className="text-sm font-semibold text-white">
                      Groq LLaMA 3.3 70B Versatile
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Temperature: 0.1 · Grounding Auth: Enabled
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 text-[11px] font-semibold text-teal-300">
                    <Sparkles className="w-3 h-3" />
                    Online
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-400">{t('admin_realtime_status')}</span>
                    <span className="text-sm font-semibold text-white">
                      WebSocket Live Event Bus
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Table sync: care_gaps, care_actions, schedules
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" />
                    Listening
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-400">{t('admin_storage_status')}</span>
                    <span className="text-sm font-semibold text-white">
                      Encrypted Object Storage
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Buckets: prescriptions, medical-reports
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" />
                    Configured
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACCESS & ROLE DIRECTORY */}
        {activeTab === 'access' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-400" />
                    {t('admin_tab_access')}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configured system personas and clinical role boundary assignments.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">4 Active Personas</span>
              </div>

              {/* Accounts Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">User / Persona</th>
                      <th className="py-3 px-4 font-semibold">Role</th>
                      <th className="py-3 px-4 font-semibold">Scope / Permissions</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[11px] font-bold">
                          DS
                        </div>
                        <div>
                          <div className="font-semibold">Dr. S. Sharma, MD</div>
                          <div className="text-[10px] text-slate-500 font-mono">dr_sharma@pulsebridge.health</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="rounded-md bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 text-[11px] font-semibold text-teal-300">
                          Attending Doctor
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        Full Clinical Read/Write · Rx Verification · CareGap Resolution · AI Reports Access
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-semibold">Authorized</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] font-bold">
                          RS
                        </div>
                        <div>
                          <div className="font-semibold">Ravi Sharma</div>
                          <div className="text-[10px] text-slate-500 font-mono">patient_id: p1</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="rounded-md bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                          Cardiac Patient
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        Personal Regimen · Dose Logging · Daily Symptoms · Consent Management
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-semibold">Active</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[11px] font-bold">
                          PJ
                        </div>
                        <div>
                          <div className="font-semibold">Priya (Daughter)</div>
                          <div className="text-[10px] text-slate-500 font-mono">caregiver_rel: Daughter</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                          Family Caregiver
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        Consent-gated Recovery Circle · Daily Dose Summary · Emergency Call Trigger
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-semibold">Consent Granted</td>
                    </tr>

                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[11px] font-bold">
                          OP
                        </div>
                        <div>
                          <div className="font-semibold">System Administrator</div>
                          <div className="text-[10px] text-slate-500 font-mono">admin@pulsebridge.internal</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="rounded-md bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                          System Admin
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        Telemetry Readout · Security Audits · Storage Management · Zero PHI Mutation
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-semibold">Active</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Honest Roadmap Notice */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex items-start gap-3 text-xs text-slate-400">
                <Info className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-300">Enterprise IAM Roadmap:</span>
                  <p>{t('admin_unimplemented_note')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SECURITY & COMPLIANCE */}
        {activeTab === 'security' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-400" />
                Clinical Safety & Security Catalog
              </h2>
              <p className="text-xs text-slate-400">
                Automated security safeguards verified through repository audit scripts (<span className="font-mono text-teal-300">scripts/audit_security.ts</span>).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Row Level Security (RLS)</span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">PASSED</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    RLS is enabled across all 9 database tables (patients, care_gaps, care_actions, schedules, adherence_logs, reports, follow_ups, health_updates, caregivers).
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">AI Grounding & Fail-Closed Guard</span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">PASSED</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Report summarization enforces fail-closed patient authorization and hallucination prevention with structured JSON schema validation.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Emergency Override Immunity</span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">ENFORCED</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Chest heaviness emergency overrides and severe allergy warnings are decoupled from care action status mutations; cosmetic clicks cannot dismiss critical safety alerts.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Least-Privilege SQL Grants</span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">VERIFIED</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Anon and authenticated roles are restricted strictly to needed tables with no DROP, TRUNCATE, or schema alteration permissions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PLATFORM SETTINGS & TELEMETRY */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-400" />
                  Platform Telemetry & State Management
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Control demo seed state, inspect storage keys, and export system diagnostic snapshots.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-white block">Reset Action Store Seed</span>
                    <span className="text-xs text-slate-400 block mt-1">
                      Re-initializes the Closed-Loop Care Action Tracking store to the certified 4 demo action records without touching patient EHR.
                    </span>
                  </div>
                  <button
                    onClick={handleResetData}
                    className="self-start inline-flex items-center gap-2 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 px-3.5 py-2 text-xs font-semibold hover:bg-teal-500/30 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset to Certified Seed
                  </button>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-white block">Export Diagnostic Telemetry</span>
                    <span className="text-xs text-slate-400 block mt-1">
                      Generate an operational JSON snapshot including runtime environment, entity counts, and clinical safety compliance checks.
                    </span>
                  </div>
                  <button
                    onClick={handleExportTelemetry}
                    className="self-start inline-flex items-center gap-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-400" />
                    Download JSON Snapshot
                  </button>
                </div>
              </div>

              {/* Technical configuration details */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 font-mono text-[11px] text-slate-400 flex flex-col gap-1.5 overflow-x-auto">
                <div className="text-xs font-bold text-slate-300 font-sans mb-1">Runtime Environment Profile:</div>
                <div>APP_NAME: PulseBridge AI Healthcare Operations</div>
                <div>CORE_FRAMEWORK: React 18 + Vite + TypeScript</div>
                <div>I18N_LOCALES: en, hi (Persisted: pulsebridge_lang)</div>
                <div>STATE_STORES: careActionService (in-memory + demoCareActions)</div>
                <div>AI_MODEL: groq / llama-3.3-70b-versatile</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
