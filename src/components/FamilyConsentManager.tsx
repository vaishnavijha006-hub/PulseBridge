import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
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
  AlertCircle
} from 'lucide-react';
import { familyConsentService } from '@/services/familyConsentService';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/utils/cn';
import type {
  FamilyCircleMember,
  FamilySupportNote,
  GranularConsentPermissions,
} from '@/types/familyConsent';

interface FamilyConsentManagerProps {
  patientId: string;
}

export function FamilyConsentManager({ patientId }: FamilyConsentManagerProps) {
  const { t, lang } = useLanguage();
  const [members, setMembers] = useState<FamilyCircleMember[]>([]);
  const [supportNotes, setSupportNotes] = useState<FamilySupportNote[]>([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Invite Form state
  const [inviteName, setInviteName] = useState('');
  const [inviteRelationship, setInviteRelationship] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermissions, setInvitePermissions] = useState<GranularConsentPermissions>({
    shareMedicationStatus: true,
    shareDailyVitals: true,
    allowDirectCalling: true,
    shareCareInstructions: true,
  });

  const loadData = () => {
    setMembers(familyConsentService.listMembers(patientId));
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

  const handleTogglePermission = (memberId: string, key: keyof GranularConsentPermissions, currentValue: boolean) => {
    try {
      familyConsentService.updatePermissions({
        patientId,
        memberId,
        permissions: { [key]: !currentValue },
      });
      showToast(lang === 'hi' ? 'अनुमतियां सफलतापूर्वक अपडेट की गईं' : 'Permissions updated successfully');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevoke = (memberId: string, memberName: string) => {
    if (window.confirm(`${t('family_revoke_confirm')} (${memberName})`)) {
      familyConsentService.revokeConsent(memberId, patientId);
      showToast(lang === 'hi' ? `${memberName} की पहुंच वापस ली गई` : `Access revoked for ${memberName}`);
    }
  };

  const handleRestore = (memberId: string, memberName: string) => {
    familyConsentService.restoreConsent(memberId, patientId);
    showToast(lang === 'hi' ? `${memberName} की पहुंच बहाल की गई` : `Access restored for ${memberName}`);
  };

  const handleRemove = (memberId: string, memberName: string) => {
    if (window.confirm(lang === 'hi' ? `क्या आप ${memberName} को हटाना चाहते हैं?` : `Remove ${memberName} from circle?`)) {
      familyConsentService.removeMember(memberId, patientId);
      showToast(lang === 'hi' ? `${memberName} को सर्कल से हटाया गया` : `${memberName} removed from circle`);
    }
  };

  const handleCreateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteRelationship.trim()) return;

    const newMember = familyConsentService.inviteMember({
      patientId,
      caregiverName: inviteName,
      relationship: inviteRelationship,
      contactNumber: invitePhone || undefined,
      email: inviteEmail || undefined,
      permissions: invitePermissions,
    });

    setIsInviteOpen(false);
    setInviteName('');
    setInviteRelationship('');
    setInvitePhone('');
    setInviteEmail('');
    showToast(lang === 'hi' ? `${newMember.caregiverName} को आमंत्रित किया गया (कोड: ${newMember.inviteCode})` : `Invited ${newMember.caregiverName} (Code: ${newMember.inviteCode})`);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-5 py-3 text-sm font-medium shadow-xl flex items-center gap-2 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Circle Header Card */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/60 via-white to-sky-50/40 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-teal-600/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-bold text-slate-900">
                  {t('family_circle_title')}
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100/80 text-teal-800">
                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                  {lang === 'hi' ? 'गोपनीयता सुरक्षित' : 'Patient-Controlled'}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {t('family_circle_subtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-sm transition-all flex-shrink-0 hover:shadow-teal-600/25"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('family_invite_btn')}</span>
          </button>
        </div>
      </div>

      {/* Circle Members List */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>{lang === 'hi' ? 'अधिकृत परिवार के सदस्य' : 'Authorized Circle Members'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {members.length}
            </span>
          </h3>
        </div>

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
                    'rounded-2xl border bg-white p-5 transition-all shadow-sm',
                    isRevoked ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  {/* Member Top Bar */}
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
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          {member.contactNumber && <span>{member.contactNumber}</span>}
                          {member.inviteCode && (
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                              {t('family_invite_code')}: {member.inviteCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Revoke / Restore / Delete buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isRevoked ? (
                        <button
                          onClick={() => handleRestore(member.id, member.caregiverName)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 transition-colors"
                        >
                          {t('family_restore_btn')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRevoke(member.id, member.caregiverName)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
                        >
                          {t('family_revoke_btn')}
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(member.id, member.caregiverName)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Granular Permission Toggles */}
                  <div className="pt-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
                      {t('family_permissions_title')}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Meds toggle */}
                      <label
                        className={cn(
                          'flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none',
                          member.permissions.shareMedicationStatus
                            ? 'bg-teal-50/40 border-teal-200/80 text-teal-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500 opacity-75'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 rounded text-teal-600 focus:ring-teal-500"
                          checked={member.permissions.shareMedicationStatus}
                          disabled={isRevoked}
                          onChange={() =>
                            handleTogglePermission(
                              member.id,
                              'shareMedicationStatus',
                              member.permissions.shareMedicationStatus
                            )
                          }
                        />
                        <div className="text-xs">
                          <span className="font-semibold block flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-teal-600" />
                            {t('family_perm_meds')}
                          </span>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            {t('family_perm_meds_desc')}
                          </span>
                        </div>
                      </label>

                      {/* Vitals toggle */}
                      <label
                        className={cn(
                          'flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none',
                          member.permissions.shareDailyVitals
                            ? 'bg-teal-50/40 border-teal-200/80 text-teal-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500 opacity-75'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 rounded text-teal-600 focus:ring-teal-500"
                          checked={member.permissions.shareDailyVitals}
                          disabled={isRevoked}
                          onChange={() =>
                            handleTogglePermission(
                              member.id,
                              'shareDailyVitals',
                              member.permissions.shareDailyVitals
                            )
                          }
                        />
                        <div className="text-xs">
                          <span className="font-semibold block flex items-center gap-1.5">
                            <Heart className="w-3.5 h-3.5 text-teal-600" />
                            {t('family_perm_vitals')}
                          </span>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            {t('family_perm_vitals_desc')}
                          </span>
                        </div>
                      </label>

                      {/* Direct calling toggle */}
                      <label
                        className={cn(
                          'flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none',
                          member.permissions.allowDirectCalling
                            ? 'bg-teal-50/40 border-teal-200/80 text-teal-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500 opacity-75'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 rounded text-teal-600 focus:ring-teal-500"
                          checked={member.permissions.allowDirectCalling}
                          disabled={isRevoked}
                          onChange={() =>
                            handleTogglePermission(
                              member.id,
                              'allowDirectCalling',
                              member.permissions.allowDirectCalling
                            )
                          }
                        />
                        <div className="text-xs">
                          <span className="font-semibold block flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-teal-600" />
                            {t('family_perm_calls')}
                          </span>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            {t('family_perm_calls_desc')}
                          </span>
                        </div>
                      </label>

                      {/* Care instructions toggle */}
                      <label
                        className={cn(
                          'flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none',
                          member.permissions.shareCareInstructions
                            ? 'bg-teal-50/40 border-teal-200/80 text-teal-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500 opacity-75'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 rounded text-teal-600 focus:ring-teal-500"
                          checked={member.permissions.shareCareInstructions}
                          disabled={isRevoked}
                          onChange={() =>
                            handleTogglePermission(
                              member.id,
                              'shareCareInstructions',
                              member.permissions.shareCareInstructions
                            )
                          }
                        />
                        <div className="text-xs">
                          <span className="font-semibold block flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5 text-teal-600" />
                            {t('family_perm_instructions')}
                          </span>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            {t('family_perm_instructions_desc')}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Support Notes Section */}
      <section className="flex flex-col gap-3 pt-2">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <MessageSquareHeart className="w-4 h-4 text-rose-500" />
          <span>{t('family_support_notes_title')}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
            {supportNotes.length}
          </span>
        </h3>

        {supportNotes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            {lang === 'hi' ? 'परिवार से कोई नया संदेश नहीं है।' : 'No encouragement notes from family yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {supportNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/40 via-white to-pink-50/20 p-4 shadow-sm"
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

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                {t('family_invite_modal_title')}
              </h3>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="flex flex-col gap-4 mt-4">
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {t('family_contact_number')}
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  {t('family_permissions_title')}
                </span>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-teal-600 focus:ring-teal-500"
                      checked={invitePermissions.shareMedicationStatus}
                      onChange={(e) =>
                        setInvitePermissions((prev) => ({
                          ...prev,
                          shareMedicationStatus: e.target.checked,
                        }))
                      }
                    />
                    <span>{t('family_perm_meds')}</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-teal-600 focus:ring-teal-500"
                      checked={invitePermissions.shareDailyVitals}
                      onChange={(e) =>
                        setInvitePermissions((prev) => ({
                          ...prev,
                          shareDailyVitals: e.target.checked,
                        }))
                      }
                    />
                    <span>{t('family_perm_vitals')}</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-teal-600 focus:ring-teal-500"
                      checked={invitePermissions.allowDirectCalling}
                      onChange={(e) =>
                        setInvitePermissions((prev) => ({
                          ...prev,
                          allowDirectCalling: e.target.checked,
                        }))
                      }
                    />
                    <span>{t('family_perm_calls')}</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-teal-600 focus:ring-teal-500"
                      checked={invitePermissions.shareCareInstructions}
                      onChange={(e) =>
                        setInvitePermissions((prev) => ({
                          ...prev,
                          shareCareInstructions: e.target.checked,
                        }))
                      }
                    />
                    <span>{t('family_perm_instructions')}</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-sm transition-all"
                >
                  {t('family_invite_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
