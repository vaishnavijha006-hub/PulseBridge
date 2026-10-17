import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldX,
  Phone,
  Pill,
  Heart,
  FileCheck,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquareHeart,
  X,
  AlertCircle,
  Calendar,
  Lock,
  History,
  Mail,
  Send,
  AlertTriangle,
  Info,
  ChevronRight,
  FileText
} from 'lucide-react';
import { familyConsentService } from '@/services/familyConsentService';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import { validatePhoneNumber, normalizePhoneNumber } from '@/utils/phone';
import type {
  FamilyCircleMember,
  FamilySupportNote,
  FamilyInvitation,
  ConsentAuditLogEntry,
  GranularConsentPermissions,
} from '@/types/familyConsent';

interface FamilyConsentManagerProps {
  patientId: string;
}

type ConsentManagerTab = 'members' | 'invitations' | 'audit' | 'notes';

export function FamilyConsentManager({ patientId }: FamilyConsentManagerProps) {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<ConsentManagerTab>('members');
  const [members, setMembers] = useState<FamilyCircleMember[]>([]);
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<ConsentAuditLogEntry[]>([]);
  const [supportNotes, setSupportNotes] = useState<FamilySupportNote[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Invite Wizard State (Step 1 -> Step 2 -> Step 3 Review)
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteStep, setInviteStep] = useState<1 | 2 | 3>(1);
  const [inviteName, setInviteName] = useState('');
  const [inviteRelationship, setInviteRelationship] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePhoneError, setInvitePhoneError] = useState<string | null>(null);
  const [explicitReviewConfirmed, setExplicitReviewConfirmed] = useState(false);

  // Default permissions: sensitive ones (vitals, direct calling) default to false for safety!
  const [invitePermissions, setInvitePermissions] = useState<GranularConsentPermissions>({
    shareProfile: true,
    shareMedicationStatus: true,
    shareDailyVitals: false, // Privacy by default
    shareAppointments: true,
    shareCareInstructions: true,
    shareCareActions: false, // Privacy by default
    allowDirectCalling: false, // Privacy by default
  });

  // Category Confirmation Modal
  const [pendingCategoryChange, setPendingCategoryChange] = useState<{
    memberId: string;
    memberName: string;
    category: keyof GranularConsentPermissions;
    currentValue: boolean;
  } | null>(null);

  // Dedicated Accessible Confirmation Modals
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string; relationship: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [cancelInviteTarget, setCancelInviteTarget] = useState<{ id: string; email: string } | null>(null);

  const loadData = () => {
    setMembers(familyConsentService.listMembers(patientId));
    setInvitations(familyConsentService.listInvitations(patientId));
    setAuditLogs(familyConsentService.listAuditLogs(patientId));
    setSupportNotes(familyConsentService.listSupportNotes(patientId));
  };

  useEffect(() => {
    loadData();
    const unsubscribe = familyConsentService.subscribe(loadData);
    return () => unsubscribe();
  }, [patientId]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Immediate Revocation
  const handleRevokeClick = (memberId: string, memberName: string, relationship: string) => {
    setRevokeTarget({ id: memberId, name: memberName, relationship });
  };

  const handleRevokeConfirm = () => {
    if (!revokeTarget) return;
    familyConsentService.revokeConsent(revokeTarget.id, patientId);
    showToast(lang === 'hi' ? `${revokeTarget.name} की पहुंच तुरंत वापस ली गई` : `Access immediately revoked for ${revokeTarget.name}`);
    setRevokeTarget(null);
  };

  // Restore Access
  const handleRestore = (memberId: string, memberName: string) => {
    familyConsentService.restoreConsent(memberId, patientId);
    showToast(lang === 'hi' ? `${memberName} की पहुंच बहाल की गई` : `Access restored for ${memberName}`);
  };

  // Remove Member
  const handleRemoveClick = (memberId: string, memberName: string) => {
    setRemoveTarget({ id: memberId, name: memberName });
  };

  const handleRemoveConfirm = () => {
    if (!removeTarget) return;
    familyConsentService.removeMember(removeTarget.id, patientId);
    showToast(lang === 'hi' ? `${removeTarget.name} को हटाया गया` : `${removeTarget.name} removed from circle`);
    setRemoveTarget(null);
  };

  // Cancel Pending Invitation
  const handleCancelInviteClick = (invitationId: string, email: string) => {
    setCancelInviteTarget({ id: invitationId, email });
  };

  const handleCancelInviteConfirm = () => {
    if (!cancelInviteTarget) return;
    familyConsentService.cancelInvitation(cancelInviteTarget.id, patientId);
    showToast(lang === 'hi' ? 'निमंत्रण रद्द किया गया' : 'Invitation cancelled');
    setCancelInviteTarget(null);
  };

  // Prompt Confirmation before changing category permissions
  const handleRequestCategoryChange = (
    memberId: string,
    memberName: string,
    category: keyof GranularConsentPermissions,
    currentValue: boolean
  ) => {
    setPendingCategoryChange({ memberId, memberName, category, currentValue });
  };

  const handleConfirmCategoryChange = () => {
    if (!pendingCategoryChange) return;
    const { memberId, category, currentValue } = pendingCategoryChange;
    familyConsentService.updatePermissions({
      patientId,
      memberId,
      permissions: { [category]: !currentValue },
    });
    setPendingCategoryChange(null);
    showToast(lang === 'hi' ? 'अनुमति अपडेट की गई' : 'Permission updated');
  };

  // Submit Multi-Step Invite Wizard after Consent Review
  const handleCompleteInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteRelationship.trim() || !inviteEmail.trim() || !explicitReviewConfirmed) {
      return;
    }

    if (invitePhone.trim() && !validatePhoneNumber(invitePhone).valid) {
      return;
    }

    const newMember = familyConsentService.inviteMember({
      patientId,
      caregiverName: inviteName,
      relationship: inviteRelationship,
      email: inviteEmail,
      contactNumber: invitePhone.trim() ? normalizePhoneNumber(invitePhone) : undefined,
      permissions: invitePermissions,
    });

    setIsInviteOpen(false);
    setInviteStep(1);
    setActiveTab('members');
    setInviteName('');
    setInviteRelationship('');
    setInviteEmail('');
    setInvitePhone('');
    setInvitePhoneError(null);
    setExplicitReviewConfirmed(false);

    showToast(
      lang === 'hi'
        ? `${newMember.caregiverName} (${inviteEmail}) को निमंत्रण भेजा गया!`
        : `Invitation sent to ${newMember.caregiverName} (${inviteEmail})!`
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-5 py-3 text-sm font-medium shadow-2xl flex items-center gap-2.5 animate-slide-up border border-slate-700"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/70 via-white to-sky-50/40 p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-teal-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-extrabold text-slate-900">
                  {t('family_circle_title')}
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100/80 text-teal-800">
                  <Lock className="w-3 h-3 text-teal-600" />
                  {lang === 'hi' ? 'पूर्ण नियंत्रण' : 'Patient-Controlled'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {t('family_circle_subtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setIsInviteOpen(true);
              setInviteStep(1);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-sm transition-all flex-shrink-0 hover:shadow-teal-600/25"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('family_invite_btn')}</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Circle Members | Invitations | Audit Trail | Support Notes */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-px overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 transition-all border-b-2 -mb-px whitespace-nowrap',
            activeTab === 'members'
              ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          )}
        >
          <Users className="w-4 h-4 text-teal-600" />
          <span>{t('family_tab_consent_members')}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600 font-bold">
            {members.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 transition-all border-b-2 -mb-px whitespace-nowrap',
            activeTab === 'invitations'
              ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          )}
        >
          <Mail className="w-4 h-4 text-teal-600" />
          <span>{t('family_tab_consent_invitations')}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600 font-bold">
            {invitations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 transition-all border-b-2 -mb-px whitespace-nowrap',
            activeTab === 'audit'
              ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          )}
        >
          <History className="w-4 h-4 text-teal-600" />
          <span>{t('family_tab_consent_audit')}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600 font-bold">
            {auditLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 transition-all border-b-2 -mb-px whitespace-nowrap',
            activeTab === 'notes'
              ? 'text-teal-700 border-teal-600 bg-white rounded-t-xl'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          )}
        >
          <MessageSquareHeart className="w-4 h-4 text-rose-500" />
          <span>{t('family_support_notes_title')}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600 font-bold">
            {supportNotes.length}
          </span>
        </button>
      </div>

      {/* TAB 1: CIRCLE MEMBERS */}
      {activeTab === 'members' && (
        <section className="flex flex-col gap-4 animate-fade-in">
          {members.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center flex flex-col items-center gap-3">
              <Users className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500 max-w-md">{t('family_no_members')}</p>
              <button
                onClick={() => setIsInviteOpen(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700"
              >
                <UserPlus className="w-4 h-4" />
                <span>{t('family_invite_btn')}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {members.map((member) => {
                const isRevoked = !member.authorized || member.status === 'revoked';
                return (
                  <div
                    key={member.id}
                    className={cn(
                      'rounded-2xl border bg-white p-5 transition-all shadow-xs flex flex-col gap-4',
                      isRevoked ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {/* Member Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm',
                            isRevoked ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-800'
                          )}
                        >
                          {member.caregiverName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-base">{member.caregiverName}</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {member.relationship}
                            </span>
                            <span
                              className={cn(
                                'text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                                isRevoked
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              )}
                            >
                              {isRevoked ? (
                                <>
                                  <ShieldX className="w-3 h-3 text-rose-600" />
                                  {t('family_status_revoked')}
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  {t('family_status_accepted')}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                            {member.email && <span>{member.email}</span>}
                            {member.contactNumber && <span>{member.contactNumber}</span>}
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              {t('family_invite_code')}: {member.inviteCode}
                            </span>
                          </div>
                        </div>
                      </div>

                        {/* Immediate Revocation / Restore Buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {isRevoked ? (
                            <button
                              onClick={() => handleRestore(member.id, member.caregiverName)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                            >
                              {t('family_restore_btn')}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRevokeClick(member.id, member.caregiverName, member.relationship)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
                            >
                              {t('family_revoke_btn')}
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveClick(member.id, member.caregiverName)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
                            title="Remove member"
                            aria-label={`Remove ${member.caregiverName} from recovery circle`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                    </div>

                    {/* Granular Permission Categories */}
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
                        {t('family_permissions_title')}
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {/* Profile */}
                        <div
                          className={cn(
                            'p-3 rounded-xl border transition-all flex flex-col justify-between gap-2',
                            isRevoked
                              ? 'bg-rose-50/20 border-rose-200/60 text-slate-500 opacity-60'
                              : member.permissions.shareProfile
                              ? 'bg-teal-50/40 border-teal-200/80 text-teal-950'
                              : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                              <Users className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" aria-hidden="true" />
                              {t('family_perm_profile')}
                            </span>
                            <div className="flex items-center gap-2">
                              {isRevoked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <ShieldX className="w-3 h-3 text-rose-700" aria-hidden="true" />
                                  <span>{t('family_status_revoked')}</span>
                                </span>
                              ) : member.permissions.shareProfile ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                                  <span>{t('family_granted')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                                  <Lock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                                  <span>{t('family_restricted')}</span>
                                </span>
                              )}
                              <input
                                type="checkbox"
                                aria-label={`${t('family_perm_profile')} - ${isRevoked ? t('family_status_revoked') : member.permissions.shareProfile ? t('family_granted') : t('family_restricted')}`}
                                checked={member.permissions.shareProfile}
                                disabled={isRevoked}
                                onChange={() =>
                                  handleRequestCategoryChange(
                                    member.id,
                                    member.caregiverName,
                                    'shareProfile',
                                    member.permissions.shareProfile
                                  )
                                }
                                className="rounded text-teal-600 focus:ring-2 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            {t('family_perm_profile_desc')}
                          </span>
                        </div>

                        {/* Meds */}
                        <div
                          className={cn(
                            'p-3 rounded-xl border transition-all flex flex-col justify-between gap-2',
                            isRevoked
                              ? 'bg-rose-50/20 border-rose-200/60 text-slate-500 opacity-60'
                              : member.permissions.shareMedicationStatus
                              ? 'bg-teal-50/40 border-teal-200/80 text-teal-950'
                              : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                              <Pill className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" aria-hidden="true" />
                              {t('family_perm_meds')}
                            </span>
                            <div className="flex items-center gap-2">
                              {isRevoked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <ShieldX className="w-3 h-3 text-rose-700" aria-hidden="true" />
                                  <span>{t('family_status_revoked')}</span>
                                </span>
                              ) : member.permissions.shareMedicationStatus ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                                  <span>{t('family_granted')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                                  <Lock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                                  <span>{t('family_restricted')}</span>
                                </span>
                              )}
                              <input
                                type="checkbox"
                                aria-label={`${t('family_perm_meds')} - ${isRevoked ? t('family_status_revoked') : member.permissions.shareMedicationStatus ? t('family_granted') : t('family_restricted')}`}
                                checked={member.permissions.shareMedicationStatus}
                                disabled={isRevoked}
                                onChange={() =>
                                  handleRequestCategoryChange(
                                    member.id,
                                    member.caregiverName,
                                    'shareMedicationStatus',
                                    member.permissions.shareMedicationStatus
                                  )
                                }
                                className="rounded text-teal-600 focus:ring-2 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            {t('family_perm_meds_desc')}
                          </span>
                        </div>

                        {/* Vitals */}
                        <div
                          className={cn(
                            'p-3 rounded-xl border transition-all flex flex-col justify-between gap-2',
                            isRevoked
                              ? 'bg-rose-50/20 border-rose-200/60 text-slate-500 opacity-60'
                              : member.permissions.shareDailyVitals
                              ? 'bg-teal-50/40 border-teal-200/80 text-teal-950'
                              : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                              <Heart className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" aria-hidden="true" />
                              {t('family_perm_vitals')}
                            </span>
                            <div className="flex items-center gap-2">
                              {isRevoked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <ShieldX className="w-3 h-3 text-rose-700" aria-hidden="true" />
                                  <span>{t('family_status_revoked')}</span>
                                </span>
                              ) : member.permissions.shareDailyVitals ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                                  <span>{t('family_granted')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                                  <Lock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                                  <span>{t('family_restricted')}</span>
                                </span>
                              )}
                              <input
                                type="checkbox"
                                aria-label={`${t('family_perm_vitals')} - ${isRevoked ? t('family_status_revoked') : member.permissions.shareDailyVitals ? t('family_granted') : t('family_restricted')}`}
                                checked={member.permissions.shareDailyVitals}
                                disabled={isRevoked}
                                onChange={() =>
                                  handleRequestCategoryChange(
                                    member.id,
                                    member.caregiverName,
                                    'shareDailyVitals',
                                    member.permissions.shareDailyVitals
                                  )
                                }
                                className="rounded text-teal-600 focus:ring-2 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            {t('family_perm_vitals_desc')}
                          </span>
                        </div>

                        {/* Appointments */}
                        <div
                          className={cn(
                            'p-3 rounded-xl border transition-all flex flex-col justify-between gap-2',
                            isRevoked
                              ? 'bg-rose-50/20 border-rose-200/60 text-slate-500 opacity-60'
                              : member.permissions.shareAppointments
                              ? 'bg-teal-50/40 border-teal-200/80 text-teal-950'
                              : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                              <Calendar className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" aria-hidden="true" />
                              {t('family_perm_appointments')}
                            </span>
                            <div className="flex items-center gap-2">
                              {isRevoked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <ShieldX className="w-3 h-3 text-rose-700" aria-hidden="true" />
                                  <span>{t('family_status_revoked')}</span>
                                </span>
                              ) : member.permissions.shareAppointments ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                                  <span>{t('family_granted')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                                  <Lock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                                  <span>{t('family_restricted')}</span>
                                </span>
                              )}
                              <input
                                type="checkbox"
                                aria-label={`${t('family_perm_appointments')} - ${isRevoked ? t('family_status_revoked') : member.permissions.shareAppointments ? t('family_granted') : t('family_restricted')}`}
                                checked={member.permissions.shareAppointments}
                                disabled={isRevoked}
                                onChange={() =>
                                  handleRequestCategoryChange(
                                    member.id,
                                    member.caregiverName,
                                    'shareAppointments',
                                    member.permissions.shareAppointments
                                  )
                                }
                                className="rounded text-teal-600 focus:ring-2 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            {t('family_perm_appointments_desc')}
                          </span>
                        </div>

                        {/* Care Instructions */}
                        <div
                          className={cn(
                            'p-3 rounded-xl border transition-all flex flex-col justify-between gap-2',
                            isRevoked
                              ? 'bg-rose-50/20 border-rose-200/60 text-slate-500 opacity-60'
                              : member.permissions.shareCareInstructions
                              ? 'bg-teal-50/40 border-teal-200/80 text-teal-950'
                              : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                              <FileCheck className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" aria-hidden="true" />
                              {t('family_perm_instructions')}
                            </span>
                            <div className="flex items-center gap-2">
                              {isRevoked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <ShieldX className="w-3 h-3 text-rose-700" aria-hidden="true" />
                                  <span>{t('family_status_revoked')}</span>
                                </span>
                              ) : member.permissions.shareCareInstructions ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                                  <span>{t('family_granted')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                                  <Lock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                                  <span>{t('family_restricted')}</span>
                                </span>
                              )}
                              <input
                                type="checkbox"
                                aria-label={`${t('family_perm_instructions')} - ${isRevoked ? t('family_status_revoked') : member.permissions.shareCareInstructions ? t('family_granted') : t('family_restricted')}`}
                                checked={member.permissions.shareCareInstructions}
                                disabled={isRevoked}
                                onChange={() =>
                                  handleRequestCategoryChange(
                                    member.id,
                                    member.caregiverName,
                                    'shareCareInstructions',
                                    member.permissions.shareCareInstructions
                                  )
                                }
                                className="rounded text-teal-600 focus:ring-2 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            {t('family_perm_instructions_desc')}
                          </span>
                        </div>

                        {/* Care Milestones & Closed-Loop Care Actions */}
                        <div
                          className={cn(
                            'p-3 rounded-xl border transition-all flex flex-col justify-between gap-2',
                            isRevoked
                              ? 'bg-rose-50/20 border-rose-200/60 text-slate-500 opacity-60'
                              : member.permissions.shareCareActions
                              ? 'bg-teal-50/40 border-teal-200/80 text-teal-950'
                              : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                              <Sparkles className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" aria-hidden="true" />
                              {t('family_perm_care_actions')}
                            </span>
                            <div className="flex items-center gap-2">
                              {isRevoked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <ShieldX className="w-3 h-3 text-rose-700" aria-hidden="true" />
                                  <span>{t('family_status_revoked')}</span>
                                </span>
                              ) : member.permissions.shareCareActions ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                                  <span>{t('family_granted')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                                  <Lock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                                  <span>{t('family_restricted')}</span>
                                </span>
                              )}
                              <input
                                type="checkbox"
                                aria-label={`${t('family_perm_care_actions')} - ${isRevoked ? t('family_status_revoked') : member.permissions.shareCareActions ? t('family_granted') : t('family_restricted')}`}
                                checked={member.permissions.shareCareActions}
                                disabled={isRevoked}
                                onChange={() =>
                                  handleRequestCategoryChange(
                                    member.id,
                                    member.caregiverName,
                                    'shareCareActions',
                                    member.permissions.shareCareActions
                                  )
                                }
                                className="rounded text-teal-600 focus:ring-2 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            {t('family_perm_care_actions_desc')}
                          </span>
                        </div>

                        {/* Direct Calling */}
                        <div
                          className={cn(
                            'p-3 rounded-xl border transition-all flex flex-col justify-between gap-2',
                            isRevoked
                              ? 'bg-rose-50/20 border-rose-200/60 text-slate-500 opacity-60'
                              : member.permissions.allowDirectCalling
                              ? 'bg-teal-50/40 border-teal-200/80 text-teal-950'
                              : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                              <Phone className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" aria-hidden="true" />
                              {t('family_perm_calls')}
                            </span>
                            <div className="flex items-center gap-2">
                              {isRevoked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <ShieldX className="w-3 h-3 text-rose-700" aria-hidden="true" />
                                  <span>{t('family_status_revoked')}</span>
                                </span>
                              ) : member.permissions.allowDirectCalling ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                                  <span>{t('family_granted')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                                  <Lock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                                  <span>{t('family_restricted')}</span>
                                </span>
                              )}
                              <input
                                type="checkbox"
                                aria-label={`${t('family_perm_calls')} - ${isRevoked ? t('family_status_revoked') : member.permissions.allowDirectCalling ? t('family_granted') : t('family_restricted')}`}
                                checked={member.permissions.allowDirectCalling}
                                disabled={isRevoked}
                                onChange={() =>
                                  handleRequestCategoryChange(
                                    member.id,
                                    member.caregiverName,
                                    'allowDirectCalling',
                                    member.permissions.allowDirectCalling
                                  )
                                }
                                className="rounded text-teal-600 focus:ring-2 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 leading-snug">
                            {t('family_perm_calls_desc')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: INVITATIONS TRACKER */}
      {activeTab === 'invitations' && (
        <section className="flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-600" />
              <span>Email-Bound Cryptographic Invitations</span>
            </h3>
            <span className="text-xs text-slate-500">
              Valid for 7 days &bull; Bound to recipient email
            </span>
          </div>

          {invitations.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
              No pending or historical invitations recorded.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{inv.caregiverName}</span>
                      <span className="text-slate-500">({inv.relationship})</span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold',
                          inv.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {inv.status.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-slate-600">{inv.recipientEmail}</span>
                    <span className="text-[11px] text-slate-400">
                      Created: {new Date(inv.createdAt).toLocaleDateString()} &bull; Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>

                  {inv.status === 'pending' && (
                    <button
                      onClick={() => handleCancelInviteClick(inv.id, inv.recipientEmail)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors self-start sm:self-center"
                    >
                      {lang === 'hi' ? 'निमंत्रण रद्द करें' : 'Cancel Invitation'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: IMMUTABLE CONSENT AUDIT LOG */}
      {activeTab === 'audit' && (
        <section className="flex flex-col gap-4 animate-fade-in">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-teal-600" />
              <span>{t('family_audit_title')}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('family_audit_subtitle')}
            </p>
          </div>

          {auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
              {t('family_audit_no_logs')}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold',
                              log.action.includes('revoked')
                                ? 'bg-rose-100 text-rose-800'
                                : log.action.includes('granted') || log.action.includes('accepted')
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {log.action.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap font-medium text-slate-700">
                          {log.actorRole.toUpperCase()}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 max-w-md">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 4: SUPPORT NOTES */}
      {activeTab === 'notes' && (
        <section className="flex flex-col gap-3 animate-fade-in">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageSquareHeart className="w-4 h-4 text-rose-500" />
            <span>{t('family_support_notes_title')}</span>
          </h3>

          {supportNotes.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
              No support messages recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {supportNotes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/40 via-white to-pink-50/20 p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-bold text-slate-800">
                      {note.caregiverName} ({note.relationship})
                    </span>
                    <span>{new Date(note.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-slate-700 italic">"{note.message}"</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* CATEGORY CHANGE CONFIRMATION MODAL */}
      {pendingCategoryChange && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-change-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 motion-reduce:transition-none"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-scale-in motion-reduce:animate-none flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="category-change-title" className="text-base font-bold text-slate-900">
                  {t('family_category_change_title')}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {lang === 'hi' ? (
                    <>
                      क्या आप वाकई <strong>{pendingCategoryChange.memberName}</strong> के लिए <strong>"{pendingCategoryChange.category}"</strong> की अनुमति{' '}
                      <strong className={pendingCategoryChange.currentValue ? 'text-rose-600' : 'text-emerald-600'}>
                        {pendingCategoryChange.currentValue ? 'रद्द' : 'स्वीकृत'}
                      </strong>{' '}
                      करना चाहते हैं?
                    </>
                  ) : (
                    <>
                      Are you sure you want to{' '}
                      <strong className={pendingCategoryChange.currentValue ? 'text-rose-600' : 'text-emerald-600'}>
                        {pendingCategoryChange.currentValue ? 'REVOKE' : 'GRANT'}
                      </strong>{' '}
                      access to <strong>"{pendingCategoryChange.category}"</strong> for{' '}
                      <strong>{pendingCategoryChange.memberName}</strong>?
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
              {pendingCategoryChange.currentValue
                ? (lang === 'hi'
                    ? 'इस श्रेणी को निरस्त करने पर परिवार के डैशबोर्ड में यह जानकारी तुरंत बंद हो जाएगी।'
                    : 'Revoking this category immediately denies subsequent queries for this information.')
                : (lang === 'hi'
                    ? 'अनुमति स्वीकृत करने पर परिवार के सदस्य इसे अपने रिकवरी डैशबोर्ड में देख सकेंगे।'
                    : 'Granting access permits the family member to view this category in their recovery dashboard.')}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingCategoryChange(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-xl transition-colors"
              >
                {t('family_btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmCategoryChange}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                {t('family_btn_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED IMMEDIATE REVOCATION CONFIRMATION MODAL */}
      {revokeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 motion-reduce:transition-none"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-rose-100 animate-scale-in motion-reduce:animate-none flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
                <ShieldX className="w-5 h-5 text-rose-600" aria-hidden="true" />
              </div>
              <div>
                <h3 id="revoke-modal-title" className="text-base font-bold text-slate-900">
                  {t('family_revoke_modal_title')}
                </h3>
                <span className="text-xs font-semibold text-rose-700 block mt-0.5">
                  {revokeTarget.name} ({revokeTarget.relationship})
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-rose-50/50 border border-rose-200/60 rounded-xl p-3.5">
              <p className="font-medium text-rose-950">
                {t('family_revoke_modal_desc')}
              </p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-rose-100">
                {t('family_past_data_disclosure')}
              </p>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" aria-hidden="true" />
              <span>{t('family_revoke_modal_reauth_note')}</span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-xl transition-colors"
              >
                {t('family_btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleRevokeConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                {t('family_revoke_modal_confirm_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED REMOVE MEMBER MODAL */}
      {removeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 motion-reduce:transition-none"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-scale-in motion-reduce:animate-none flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-slate-600" aria-hidden="true" />
              </div>
              <div>
                <h3 id="remove-modal-title" className="text-base font-bold text-slate-900">
                  {t('family_remove_modal_title')}
                </h3>
                <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                  {removeTarget.name}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
              {t('family_remove_modal_desc')}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-xl transition-colors"
              >
                {t('family_btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleRemoveConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                {t('family_btn_remove')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED CANCEL INVITATION MODAL */}
      {cancelInviteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-invite-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 motion-reduce:transition-none"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-scale-in motion-reduce:animate-none flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden="true" />
              </div>
              <div>
                <h3 id="cancel-invite-title" className="text-base font-bold text-slate-900">
                  {t('family_cancel_invite_modal_title')}
                </h3>
                <span className="text-xs text-slate-600 block mt-0.5">
                  {cancelInviteTarget.email}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
              {t('family_cancel_invite_modal_desc')}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelInviteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-xl transition-colors"
              >
                {t('family_btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleCancelInviteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                {lang === 'hi' ? 'रद्द करें' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-STEP INVITATION & CONSENT REVIEW WIZARD MODAL */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-scale-in flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {inviteStep === 1 && 'Invite Family Member (Step 1 of 3)'}
                  {inviteStep === 2 && 'Select Granular Categories (Step 2 of 3)'}
                  {inviteStep === 3 && t('family_review_title')}
                </h3>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: RECIPIENT DETAILS & EMAIL */}
            {inviteStep === 1 && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {t('family_member_name')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      {t('family_relationship')} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Daughter, Son, Spouse"
                      value={inviteRelationship}
                      onChange={(e) => setInviteRelationship(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Recipient Email (Bound) *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. priya@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {t('family_contact_number')} (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 98765 43210"
                    value={invitePhone}
                    onChange={(e) => {
                      setInvitePhone(e.target.value);
                      if (invitePhoneError) setInvitePhoneError(null);
                    }}
                    onBlur={() => {
                      if (invitePhone.trim()) {
                        const val = validatePhoneNumber(invitePhone);
                        if (!val.valid) {
                          setInvitePhoneError(val.error || t('phone_format_error'));
                        } else {
                          setInvitePhoneError(null);
                        }
                      }
                    }}
                    className={cn(
                      "w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2",
                      invitePhoneError
                        ? "border-rose-400 focus:ring-rose-400"
                        : "border-slate-200 focus:ring-teal-500"
                    )}
                    maxLength={16}
                  />
                  {invitePhoneError ? (
                    <p className="text-[11px] text-rose-500 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span>{invitePhoneError}</span>
                    </p>
                  ) : (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {t('intake_phone_hint')}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!inviteName.trim() || !inviteRelationship.trim() || !inviteEmail.trim() || Boolean(invitePhone.trim() && invitePhoneError)}
                    onClick={() => {
                      if (invitePhone.trim()) {
                        const val = validatePhoneNumber(invitePhone);
                        if (!val.valid) {
                          setInvitePhoneError(val.error || t('phone_format_error'));
                          return;
                        }
                      }
                      setInvitePhoneError(null);
                      setInviteStep(2);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all"
                  >
                    <span>Next: Granular Consent</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: GRANULAR CATEGORY SELECTION */}
            {inviteStep === 2 && (
              <div className="flex flex-col gap-4">
                <span className="text-xs text-slate-500">
                  Select explicitly permitted information categories. Sensitive permissions are turned off by default for privacy.
                </span>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {/* Profile */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invitePermissions.shareProfile}
                      onChange={(e) => setInvitePermissions((p) => ({ ...p, shareProfile: e.target.checked }))}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold block">{t('family_perm_profile')}</span>
                      <span className="text-[11px] text-slate-500">{t('family_perm_profile_desc')}</span>
                    </div>
                  </label>

                  {/* Meds */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invitePermissions.shareMedicationStatus}
                      onChange={(e) => setInvitePermissions((p) => ({ ...p, shareMedicationStatus: e.target.checked }))}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold block">{t('family_perm_meds')}</span>
                      <span className="text-[11px] text-slate-500">{t('family_perm_meds_desc')}</span>
                    </div>
                  </label>

                  {/* Vitals (Defaults false) */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invitePermissions.shareDailyVitals}
                      onChange={(e) => setInvitePermissions((p) => ({ ...p, shareDailyVitals: e.target.checked }))}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold block">{t('family_perm_vitals')}</span>
                      <span className="text-[11px] text-slate-500">{t('family_perm_vitals_desc')}</span>
                    </div>
                  </label>

                  {/* Appointments */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invitePermissions.shareAppointments}
                      onChange={(e) => setInvitePermissions((p) => ({ ...p, shareAppointments: e.target.checked }))}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold block">{t('family_perm_appointments')}</span>
                      <span className="text-[11px] text-slate-500">{t('family_perm_appointments_desc')}</span>
                    </div>
                  </label>

                  {/* Care Instructions */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invitePermissions.shareCareInstructions}
                      onChange={(e) => setInvitePermissions((p) => ({ ...p, shareCareInstructions: e.target.checked }))}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold block">{t('family_perm_instructions')}</span>
                      <span className="text-[11px] text-slate-500">{t('family_perm_instructions_desc')}</span>
                    </div>
                  </label>

                  {/* Care Actions & Milestones (Defaults false for privacy) */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invitePermissions.shareCareActions}
                      onChange={(e) => setInvitePermissions((p) => ({ ...p, shareCareActions: e.target.checked }))}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold block">{t('family_perm_care_actions')}</span>
                      <span className="text-[11px] text-slate-500">{t('family_perm_care_actions_desc')}</span>
                    </div>
                  </label>

                  {/* Direct Calling (Defaults false) */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invitePermissions.allowDirectCalling}
                      onChange={(e) => setInvitePermissions((p) => ({ ...p, allowDirectCalling: e.target.checked }))}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold block">{t('family_perm_calls')}</span>
                      <span className="text-[11px] text-slate-500">{t('family_perm_calls_desc')}</span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setInviteStep(1)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteStep(3)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all"
                  >
                    <span>Next: Consent Review</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CONSENT REVIEW & PRIVACY DISCLOSURE */}
            {inviteStep === 3 && (
              <form onSubmit={handleCompleteInvitation} className="flex flex-col gap-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t('family_review_recipient')}:</span>
                    <strong className="text-slate-900">{inviteName} ({inviteRelationship}) &bull; {inviteEmail}</strong>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="font-bold text-slate-700 block mb-1">{t('family_review_categories')}:</span>
                    <ul className="space-y-1">
                      {invitePermissions.shareProfile && <li className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Patient Display Profile</li>}
                      {invitePermissions.shareMedicationStatus && <li className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Daily Medication Adherence Progress</li>}
                      {invitePermissions.shareDailyVitals && <li className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Daily Health Check-in Status</li>}
                      {invitePermissions.shareAppointments && <li className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Doctor Consultations & Appointments</li>}
                      {invitePermissions.shareCareInstructions && <li className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Discharge Care & Dietary Guidelines</li>}
                      {invitePermissions.shareCareActions && <li className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Recovery Milestones & Support Actions</li>}
                      {invitePermissions.allowDirectCalling && <li className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Direct Calling Access</li>}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="font-bold text-slate-700 block mb-1">{t('family_review_restricted')}:</span>
                    <ul className="space-y-1 text-slate-500">
                      <li className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-slate-400" /> Full clinical prescription monographs</li>
                      <li className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-slate-400" /> Physician internal SOAP clinical notes</li>
                      <li className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-slate-400" /> Emergency override audit logs</li>
                    </ul>
                  </div>
                </div>

                {/* Important disclosures */}
                <div className="space-y-2 text-xs text-slate-600 bg-teal-50/50 border border-teal-200/60 rounded-xl p-3">
                  <p className="flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span>{t('family_review_acceptance_notice')}</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span>{t('family_review_revocation_notice')}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 italic pt-1 border-t border-teal-100">
                    {t('family_past_data_disclosure')}
                  </p>
                </div>

                {/* Explicit confirmation checkbox */}
                <label className="flex items-start gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={explicitReviewConfirmed}
                    onChange={(e) => setExplicitReviewConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>I have reviewed the information categories and explicitly authorize this invitation.</span>
                </label>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setInviteStep(2)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!explicitReviewConfirmed}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{t('family_review_confirm_btn')}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
