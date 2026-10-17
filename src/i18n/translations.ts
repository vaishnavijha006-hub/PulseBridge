export type Language = 'en' | 'hi';

export type TranslationKey =
  | 'app_name'
  | 'app_tagline'
  | 'hero_title'
  | 'hero_sub'
  | 'hero_hindi'
  | 'cta_start'
  | 'nav_about'
  | 'nav_how'
  | 'role_patient'
  | 'role_patient_hi'
  | 'role_patient_desc'
  | 'role_doctor'
  | 'role_doctor_hi'
  | 'role_doctor_desc'
  | 'role_family'
  | 'role_family_hi'
  | 'role_family_desc'
  | 'role_admin'
  | 'role_admin_hi'
  | 'role_admin_desc'
  | 'admin_title'
  | 'admin_subtitle'
  | 'admin_tab_overview'
  | 'admin_tab_access'
  | 'admin_tab_security'
  | 'admin_tab_settings'
  | 'admin_stat_patients'
  | 'admin_stat_actions'
  | 'admin_stat_gaps'
  | 'admin_stat_reports'
  | 'admin_stat_adherence'
  | 'admin_db_status'
  | 'admin_db_connected'
  | 'admin_realtime_status'
  | 'admin_ai_status'
  | 'admin_storage_status'
  | 'admin_unimplemented_note'
  | 'doctor_nav_overview'
  | 'doctor_nav_patients'
  | 'doctor_nav_radar'
  | 'doctor_nav_actions'
  | 'doctor_nav_reports'
  | 'doctor_emergency_override_alert'
  | 'doctor_actions_count'
  | 'doctor_tab_summary'
  | 'doctor_tab_rx'
  | 'doctor_tab_reports'
  | 'doctor_tab_gaps'
  | 'doctor_tab_actions'
  | 'patient_recovery_status'
  | 'patient_doses_progress'
  | 'patient_feeling_title'
  | 'patient_tab_meds'
  | 'patient_tab_reports'
  | 'patient_reports_summary'
  | 'patient_no_reports'
  | 'patient_grace_notice'
  | 'nav_switch_role'
  | 'nav_doctor_dash'
  | 'nav_patient_dash'
  | 'nav_admin_dash'
  | 'system_operational'
  | 'role_select'
  | 'how_title'
  | 'how_step1'
  | 'how_step2'
  | 'how_step3'
  | 'privacy_note'
  | 'back'
  | 'continue'
  | 'submit'
  | 'cancel'
  | 'save'
  | 'confirm'
  | 'retry'
  | 'loading'
  | 'lang_toggle'
  | 'intake_lang_q'
  | 'intake_lang_hint'
  | 'intake_profile_q'
  | 'intake_name'
  | 'intake_age'
  | 'intake_gender'
  | 'intake_phone'
  | 'intake_symptoms_q'
  | 'intake_symptoms_hint'
  | 'intake_allergies_q'
  | 'intake_allergies_hint'
  | 'intake_meds_q'
  | 'intake_meds_hint'
  | 'intake_upload_q'
  | 'intake_upload_hint'
  | 'intake_voice'
  | 'intake_optional'
  | 'intake_none'
  | 'gender_male'
  | 'gender_female'
  | 'gender_other'
  | 'upload_select'
  | 'upload_capture'
  | 'upload_preview'
  | 'upload_retry_blur'
  | 'upload_invalid_type'
  | 'upload_too_large'
  | 'processing_title'
  | 'processing_step1'
  | 'processing_step2'
  | 'processing_step3'
  | 'processing_wait'
  | 'rx_uncertain'
  | 'rx_check'
  | 'rx_confirmed'
  | 'rx_doctor_confirmed'
  | 'rx_confirm_plan'
  | 'rx_medicine'
  | 'rx_dosage'
  | 'rx_frequency'
  | 'rx_duration'
  | 'rx_instructions'
  | 'dash_namaste'
  | 'dash_today_recovery'
  | 'dash_today_meds'
  | 'dash_how_feel'
  | 'dash_feel_good'
  | 'dash_feel_ok'
  | 'dash_feel_bad'
  | 'dash_symptom_desc'
  | 'dash_symptom_placeholder'
  | 'dash_submit_update'
  | 'dash_followup_q'
  | 'dash_followup_none'
  | 'dose_taken'
  | 'dose_missed'
  | 'dose_pending'
  | 'dose_snoozed'
  | 'dose_taken_confirm'
  | 'dose_take_action'
  | 'dose_missed_action'
  | 'dose_snooze_action'
  | 'dose_cannot'
  | 'dose_scheduled'
  | 'doctor_overview'
  | 'doctor_today'
  | 'doctor_search'
  | 'doctor_filter_all'
  | 'doctor_filter_urgent'
  | 'doctor_filter_attention'
  | 'doctor_filter_ontime'
  | 'doctor_caregaps'
  | 'doctor_pending_rx'
  | 'doctor_review_patient'
  | 'doctor_priority_ontime'
  | 'doctor_priority_attention'
  | 'doctor_priority_urgent'
  | 'doctor_doses_today'
  | 'doctor_adherence'
  | 'doctor_latest_update'
  | 'doctor_open_gaps'
  | 'doctor_last_update'
  | 'doctor_reasons'
  | 'doctor_rx_verify'
  | 'doctor_rx_image'
  | 'doctor_rx_fields'
  | 'doctor_caregap_radar'
  | 'doctor_gap_type'
  | 'doctor_evidence'
  | 'doctor_timestamp'
  | 'doctor_missing'
  | 'doctor_followup_q'
  | 'doctor_review_status'
  | 'doctor_mark_reviewed'
  | 'doctor_plan_followup'
  | 'doctor_detail_plan'
  | 'doctor_detail_meds'
  | 'doctor_detail_adherence'
  | 'doctor_detail_timeline'
  | 'doctor_detail_allergies'
  | 'doctor_detail_gaps'
  | 'doctor_detail_followups'
  | 'doctor_patient_reported'
  | 'doctor_doctor_confirmed'
  | 'family_headline'
  | 'family_doses_today'
  | 'family_next_dose'
  | 'family_health_update'
  | 'family_missed_dose'
  | 'family_call'
  | 'family_call_unavailable'
  | 'family_consent_status'
  | 'family_consent_active'
  | 'family_consent_revoked'
  | 'family_revoke'
  | 'family_authorize'
  | 'family_access_limited'
  | 'patient_tab_family'
  | 'family_circle_title'
  | 'family_circle_subtitle'
  | 'family_invite_btn'
  | 'family_permissions_title'
  | 'family_perm_meds'
  | 'family_perm_meds_desc'
  | 'family_perm_vitals'
  | 'family_perm_vitals_desc'
  | 'family_perm_calls'
  | 'family_perm_calls_desc'
  | 'family_perm_instructions'
  | 'family_perm_instructions_desc'
  | 'family_revoke_confirm'
  | 'family_support_note_placeholder'
  | 'family_send_support_note'
  | 'family_support_notes_title'
  | 'family_invite_modal_title'
  | 'family_member_name'
  | 'family_relationship'
  | 'family_contact_number'
  | 'family_invite_code'
  | 'family_status_pending'
  | 'family_status_accepted'
  | 'family_status_revoked'
  | 'family_status_expired'
  | 'family_revoke_btn'
  | 'family_restore_btn'
  | 'family_access_revoked_notice'
  | 'family_no_members'
  | 'family_care_instructions_title'
  | 'family_view_as_label'
  | 'family_welcome_title'
  | 'family_welcome_sub'
  | 'family_non_monitoring_note'
  | 'family_conn_status_label'
  | 'family_last_update_label'
  | 'family_active_verified'
  | 'family_timeline_title'
  | 'family_timeline_subtitle'
  | 'family_btn_acknowledge'
  | 'family_btn_acknowledged'
  | 'family_source_patient'
  | 'family_source_doctor'
  | 'family_source_meds'
  | 'family_support_actions_title'
  | 'family_support_actions_subtitle'
  | 'family_support_quick_prompt1'
  | 'family_support_quick_prompt2'
  | 'family_support_quick_prompt3'
  | 'family_privacy_center_title'
  | 'family_privacy_center_desc'
  | 'family_perm_active_title'
  | 'family_perm_restricted_title'
  | 'family_restricted_rx_full'
  | 'family_restricted_soap'
  | 'family_restricted_override'
  | 'family_restricted_triage'
  | 'family_empty_connection_title'
  | 'family_empty_connection_desc'
  | 'family_tab_overview'
  | 'family_tab_milestones'
  | 'family_tab_privacy'
  | 'family_shared_appointments_title'
  | 'family_notifications_title'
  | 'family_mark_all_read'
  | 'reminder_dose'
  | 'reminder_missed'
  | 'reminder_followup'
  | 'reminder_review'
  | 'error_generic'
  | 'error_retry'
  | 'success_saved'
  | 'empty_no_data'
  | 'sos_emergency'
  | 'sos_call';

type Dictionary = Record<TranslationKey, { en: string; hi: string }>;

const dict: Dictionary = {
  app_name: { en: 'PulseBridge AI', hi: 'PulseBridge AI' },
  app_tagline: { en: 'घर तक इलाज का साथ', hi: 'घर तक इलाज का साथ' },
  hero_title: { en: "Your Recovery Doesn't End at the Hospital.", hi: 'आपका इलाज अस्पताल पर खत्म नहीं होता।' },
  hero_sub: {
    en: 'PulseBridge connects patients, doctors, and families through a doctor-verified recovery journey—from prescription confirmation to daily follow-up.',
    hi: 'PulseBridge मरीज, डॉक्टर और परिवार को डॉक्टर-सत्यापित रिकवरी यात्रा से जोड़ता है—पर्ची पुष्टि से लेकर रोज़ फॉलो-अप तक।',
  },
  hero_hindi: { en: 'इलाज के बाद भी, हर कदम पर साथ।', hi: 'इलाज के बाद भी, हर कदम पर साथ।' },
  cta_start: { en: 'Start Your Recovery Journey', hi: 'अपनी रिकवरी यात्रा शुरू करें' },
  nav_about: { en: 'About', hi: 'परिचय' },
  nav_how: { en: 'How It Works', hi: 'कैसे काम करता है' },
  role_patient: { en: 'Patient', hi: 'मरीज' },
  role_patient_hi: { en: 'मरीज', hi: 'मरीज' },
  role_patient_desc: { en: 'Track your daily recovery, medicines, and health updates.', hi: 'अपनी रोज़ की रिकवरी, दवाइयां और सेहत अपडेट देखें।' },
  role_doctor: { en: 'Doctor', hi: 'डॉक्टर' },
  role_doctor_hi: { en: 'डॉक्टर', hi: 'डॉक्टर' },
  role_doctor_desc: { en: 'Review patients, verify prescriptions, and close care gaps.', hi: 'मरीज देखें, पर्ची सत्यापित करें, केयर गैप बंद करें।' },
  role_family: { en: 'Family', hi: 'परिवार' },
  role_family_hi: { en: 'परिवार', hi: 'परिवार' },
  role_family_desc: { en: "Support your loved one's recovery with authorized updates.", hi: 'अपने परिवार के स्वास्थ्य को अधिकृत अपडेट के साथ सहयोग दें।' },
  role_select: { en: 'Choose your role', hi: 'अपना रोल चुनें' },
  how_title: { en: 'How It Works', hi: 'कैसे काम करता है' },
  how_step1: { en: 'Doctor confirms your care plan.', hi: 'डॉक्टर आपकी केयर प्लान की पुष्टि करते हैं।' },
  how_step2: { en: 'Patient tracks daily recovery.', hi: 'मरीज रोज़ रिकवरी ट्रैक करता है।' },
  how_step3: { en: 'Doctor reviews changes and follow-up needs.', hi: 'डॉक्टर बदलाव और फॉलो-अप की समीक्षा करते हैं।' },
  privacy_note: {
    en: 'All data is doctor-verified and privacy-protected. Family access is consent-based and can be revoked anytime.',
    hi: 'सभी डेटा डॉक्टर-सत्यापित और गोपनीयता-सुरक्षित है। परिवार की पहुंच सहमति-आधारित है और कभी भी वापस ली जा सकती है।',
  },
  back: { en: 'Back', hi: 'वापस' },
  continue: { en: 'Continue', hi: 'आगे बढ़ें' },
  submit: { en: 'Submit', hi: 'जमा करें' },
  cancel: { en: 'Cancel', hi: 'रद्द करें' },
  save: { en: 'Save', hi: 'सेव करें' },
  confirm: { en: 'Confirm', hi: 'पुष्टि करें' },
  retry: { en: 'Retry', hi: 'दोबारा कोशिश करें' },
  loading: { en: 'Loading...', hi: 'लोड हो रहा है...' },
  lang_toggle: { en: 'हिंदी', hi: 'English' },
  intake_lang_q: { en: 'Which language do you prefer?', hi: 'आपकी पसंद की भाषा कौन सी है?' },
  intake_lang_hint: { en: 'You can change this anytime.', hi: 'आप इसे कभी भी बदल सकते हैं।' },
  intake_profile_q: { en: 'Tell us about yourself', hi: 'अपने बारे में बताएं' },
  intake_name: { en: 'Your name', hi: 'आपका नाम' },
  intake_age: { en: 'Age', hi: 'उम्र' },
  intake_gender: { en: 'Gender', hi: 'लिंग' },
  intake_phone: { en: 'Phone number', hi: 'फ़ोन नंबर' },
  intake_symptoms_q: { en: 'What symptoms are you experiencing?', hi: 'आपको कौन से लक्षण हैं?' },
  intake_symptoms_hint: { en: 'Describe in your own words.', hi: 'अपने शब्दों में बताएं।' },
  intake_allergies_q: { en: 'Do you have any known allergies?', hi: 'क्या आपको कोई एलर्जी है?' },
  intake_allergies_hint: { en: 'List medicines or foods you are allergic to.', hi: 'जिन दवाइयों या खाद्य पदार्थों से एलर्जी है, बताएं।' },
  intake_meds_q: { en: 'Are you taking any medicines currently?', hi: 'क्या आप वर्तमान में कोई दवाई ले रहे हैं?' },
  intake_meds_hint: { en: 'Include all medicines, supplements, or herbal remedies.', hi: 'सभी दवाइयां, सप्लिमेंट या आयुर्वेदिक दवाइयां शामिल करें।' },
  intake_upload_q: { en: 'Upload your prescription photo', hi: 'अपनी पर्ची की फोटो अपलोड करें' },
  intake_upload_hint: { en: 'Take a clear photo in good light.', hi: 'अच्छी रोशनी में साफ फोटो लें।' },
  intake_voice: { en: 'Speak', hi: 'बोलें' },
  intake_optional: { en: 'Optional', hi: 'वैकल्पिक' },
  intake_none: { en: 'None', hi: 'कोई नहीं' },
  gender_male: { en: 'Male', hi: 'पुरुष' },
  gender_female: { en: 'Female', hi: 'महिला' },
  gender_other: { en: 'Other', hi: 'अन्य' },
  upload_select: { en: 'Select Photo', hi: 'फोटो चुनें' },
  upload_capture: { en: 'Take Photo', hi: 'फोटो लें' },
  upload_preview: { en: 'Selected photo preview', hi: 'चुनी गई फोटो प्रीव्यू' },
  upload_retry_blur: { en: 'Photo saaf nahi aayi. Achhi roshni mein dobara lein.', hi: 'फोटो साफ़ नहीं आई। अच्छी रोशनी में दोबारा लें।' },
  upload_invalid_type: { en: 'Please select an image file (JPG, PNG).', hi: 'कृपया एक छवि फ़ाइल चुनें (JPG, PNG)।' },
  upload_too_large: { en: 'Photo size is too large. Please use a smaller image.', hi: 'फोटो का आकार बहुत बड़ा है। कृपया एक छोटी छवि का उपयोग करें।' },
  processing_title: { en: 'Processing Your Prescription', hi: 'आपकी पर्ची प्रोसेस हो रही है' },
  processing_step1: { en: 'Prescription photo received', hi: 'पर्ची की फोटो प्राप्त हुई' },
  processing_step2: { en: 'Reading medicine details', hi: 'दवाई की जानकारी पढ़ी जा रही है' },
  processing_step3: { en: 'Waiting for doctor verification', hi: 'डॉक्टर के सत्यापन की प्रतीक्षा' },
  processing_wait: { en: 'Please wait, this will take a moment...', hi: 'कृपया प्रतीक्षा करें, इसमें कुछ समय लगेगा...' },
  rx_uncertain: { en: 'Check karein', hi: 'Check karein' },
  rx_check: { en: 'Needs Review', hi: 'समीक्षा चाहिए' },
  rx_confirmed: { en: 'Doctor Confirmed', hi: 'डॉक्टर सत्यापित' },
  rx_doctor_confirmed: { en: '✓ Doctor Confirmed', hi: '✓ डॉक्टर सत्यापित' },
  rx_confirm_plan: { en: 'Confirm Care Plan', hi: 'केयर प्लान की पुष्टि करें' },
  rx_medicine: { en: 'Medicine', hi: 'दवाई' },
  rx_dosage: { en: 'Dosage', hi: 'खुराक' },
  rx_frequency: { en: 'Frequency', hi: 'कितनी बार' },
  rx_duration: { en: 'Duration', hi: 'कितने दिन' },
  rx_instructions: { en: 'Instructions', hi: 'निर्देश' },
  dash_namaste: { en: 'Namaste!', hi: 'नमस्ते!' },
  dash_today_recovery: { en: 'Aaj ki recovery', hi: 'आज की रिकवरी' },
  dash_today_meds: { en: 'Aaj ki dawai', hi: 'आज की दवाई' },
  dash_how_feel: { en: 'Aaj kaisa lag raha hai?', hi: 'आज कैसा लग रहा है?' },
  dash_feel_good: { en: 'Achha', hi: 'अच्छा' },
  dash_feel_ok: { en: 'Theek-thaak', hi: 'ठीक-ठाक' },
  dash_feel_bad: { en: 'Achha nahi', hi: 'अच्छा नहीं' },
  dash_symptom_desc: { en: 'Describe your symptoms (optional)', hi: 'अपने लक्षण बताएं (वैकल्पिक)' },
  dash_symptom_placeholder: { en: 'e.g., slight headache since morning', hi: 'जैसे, सुबह से हल्का सिरदर्द' },
  dash_submit_update: { en: 'Submit Update', hi: 'अपडेट जमा करें' },
  dash_followup_q: { en: 'Aapke liye ek sawaal', hi: 'आपके लिए एक सवाल' },
  dash_followup_none: { en: 'No follow-up questions right now.', hi: 'अभी कोई फॉलो-अप सवाल नहीं है।' },
  dose_taken: { en: 'Taken — Dawai li gayi', hi: 'ली गई — दवाई ली गई' },
  dose_missed: { en: 'Missed — Dawai log nahi hui', hi: 'छूटी — दवाई लोग नहीं हुई' },
  dose_pending: { en: 'Pending — Abhi jawab dein', hi: 'बाकी — अभी जवाब दें' },
  dose_snoozed: { en: 'Snoozed — Reminder 10 minute baad', hi: 'टाली — 10 मिनट बाद रिमाइंडर' },
  dose_taken_confirm: { en: 'Dawai li gayi, shabaash!', hi: 'दवाई ली गई, शाबाश!' },
  dose_take_action: { en: 'Dawai li', hi: 'दवाई ली' },
  dose_missed_action: { en: 'Missed', hi: 'छूटी' },
  dose_snooze_action: { en: 'Snooze 10 min', hi: '10 मिनट बाद' },
  dose_cannot: { en: 'Cannot take', hi: 'नहीं ले सकते' },
  dose_scheduled: { en: 'Scheduled time', hi: 'निर्धारित समय' },
  doctor_overview: { en: 'Doctor Overview', hi: 'डॉक्टर ओवरव्यू' },
  doctor_today: { en: 'Today', hi: 'आज' },
  doctor_search: { en: 'Search patients...', hi: 'मरीज खोजें...' },
  doctor_filter_all: { en: 'All', hi: 'सभी' },
  doctor_filter_urgent: { en: 'Urgent Review', hi: 'तुरंत समीक्षा' },
  doctor_filter_attention: { en: 'Needs Attention', hi: 'ध्यान चाहिए' },
  doctor_filter_ontime: { en: 'On Track', hi: 'सही रास्ते पर' },
  doctor_caregaps: { en: 'Open Care Gaps', hi: 'खुले केयर गैप' },
  doctor_pending_rx: { en: 'Pending Verifications', hi: 'सत्यापन बाकी' },
  doctor_review_patient: { en: 'Review Patient', hi: 'मरीज समीक्षा' },
  doctor_priority_ontime: { en: 'On Track', hi: 'सही रास्ते पर' },
  doctor_priority_attention: { en: 'Needs Attention', hi: 'ध्यान चाहिए' },
  doctor_priority_urgent: { en: 'Urgent Review', hi: 'तुरंत समीक्षा' },
  doctor_doses_today: { en: "Today's doses", hi: 'आज की खुराक' },
  doctor_adherence: { en: '7-day adherence', hi: '7-दिन एडहेरेंस' },
  doctor_latest_update: { en: 'Latest update', hi: 'नवीनतम अपडेट' },
  doctor_open_gaps: { en: 'Open care gaps', hi: 'खुले केयर गैप' },
  doctor_last_update: { en: 'Last update', hi: 'अंतिम अपडेट' },
  doctor_reasons: { en: 'Reasons', hi: 'कारण' },
  doctor_rx_verify: { en: 'Prescription Verification', hi: 'पर्ची सत्यापन' },
  doctor_rx_image: { en: 'Uploaded Image', hi: 'अपलोड की गई छवि' },
  doctor_rx_fields: { en: 'Extracted Fields', hi: 'निकाले गए फ़ील्ड' },
  doctor_caregap_radar: { en: 'CareGap Radar', hi: 'CareGap Radar' },
  doctor_gap_type: { en: 'Gap Type', hi: 'गैप प्रकार' },
  doctor_evidence: { en: 'Evidence', hi: 'साक्ष्य' },
  doctor_timestamp: { en: 'Timestamp', hi: 'समय' },
  doctor_missing: { en: 'Missing Info', hi: 'गायब जानकारी' },
  doctor_followup_q: { en: 'Follow-up Question', hi: 'फॉलो-अप सवाल' },
  doctor_review_status: { en: 'Status', hi: 'स्थिति' },
  doctor_mark_reviewed: { en: 'Mark Reviewed', hi: 'समीक्षित चिह्नित करें' },
  doctor_plan_followup: { en: 'Plan Follow-up', hi: 'फॉलो-अप योजना' },
  doctor_detail_plan: { en: 'Confirmed Care Plan', hi: 'पुष्टि की गई केयर प्लान' },
  doctor_detail_meds: { en: 'Current Medicines', hi: 'वर्तमान दवाइयां' },
  doctor_detail_adherence: { en: 'Adherence History', hi: 'एडहेरेंस इतिहास' },
  doctor_detail_timeline: { en: 'Health Update Timeline', hi: 'सेहत अपडेट टाइमलाइन' },
  doctor_detail_allergies: { en: 'Allergy & Safety Flags', hi: 'एलर्जी और सेफ्टी फ्लैग' },
  doctor_detail_gaps: { en: 'Open Care Gaps', hi: 'खुले केयर गैप' },
  doctor_detail_followups: { en: 'Follow-up History', hi: 'फॉलो-अप इतिहास' },
  doctor_patient_reported: { en: 'Patient Reported', hi: 'मरीज ने बताया' },
  doctor_doctor_confirmed: { en: 'Doctor Confirmed', hi: 'डॉक्टर सत्यापित' },
  family_headline: { en: 'Papa ka aaj ka din', hi: 'पापा का आज का दिन' },
  family_doses_today: { en: 'Aaj 3 mein se {count} dawai log hui.', hi: 'आज 3 में से {count} दवाई लोग हुई।' },
  family_next_dose: { en: 'Agli dose: {time}', hi: 'अगली खुराक: {time}' },
  family_health_update: { en: 'Aaj ka health update: {status}', hi: 'आज का सेहत अपडेट: {status}' },
  family_missed_dose: { en: 'A missed dose was recorded.', hi: 'एक खुराक छूटी दर्ज की गई।' },
  family_call: { en: 'Call karein', hi: 'कॉल करें' },
  family_call_unavailable: { en: 'No authorized contact number available.', hi: 'कोई अधिकृत संपर्क नंबर उपलब्ध नहीं है।' },
  family_consent_status: { en: 'Caregiver Access', hi: 'देखभालकर्ता पहुंच' },
  family_consent_active: { en: 'Active — Authorized by patient', hi: 'सक्रिय — मरीज द्वारा अधिकृत' },
  family_consent_revoked: { en: 'Revoked — Access withdrawn', hi: 'वापस लिया गया — पहुंच हटाई गई' },
  family_revoke: { en: 'Revoke Access', hi: 'पहुंच वापस लें' },
  family_authorize: { en: 'Authorize Access', hi: 'पहुंच अधिकृत करें' },
  family_access_limited: {
    en: 'You see only what the patient has authorized. Full prescriptions and doctor notes are not shown.',
    hi: 'आप केवल वही देखते हैं जो मरीज ने अधिकृत किया है। पूरी पर्ची और डॉक्टर नोट नहीं दिखाई जाती।',
  },
  patient_tab_family: { en: 'Family Circle', hi: 'परिवार सर्कल' },
  family_circle_title: { en: 'Consent-Based Family Recovery Circle', hi: 'सहमति-आधारित परिवार रिकवरी सर्कल' },
  family_circle_subtitle: {
    en: 'Manage who can view your recovery updates. You hold full control over permissions.',
    hi: 'प्रबंधित करें कि कौन आपकी रिकवरी अपडेट देख सकता है। अनुमतियों पर आपका पूर्ण नियंत्रण है।',
  },
  family_invite_btn: { en: 'Invite Family Member', hi: 'परिवार के सदस्य को आमंत्रित करें' },
  family_permissions_title: { en: 'Sharing Permissions', hi: 'साझाकरण अनुमतियाँ' },
  family_perm_meds: { en: 'Daily Medication Progress', hi: 'दैनिक दवाई की प्रगति' },
  family_perm_meds_desc: { en: 'Share dose counts and upcoming schedule times', hi: 'दवा खुराक संख्या और आगामी समय साझा करें' },
  family_perm_vitals: { en: 'Daily Health Status', hi: 'दैनिक सेहत स्थिति' },
  family_perm_vitals_desc: { en: 'Share overall daily feeling and recovery check-in', hi: 'सामान्य सेहत और रिकवरी चेक-इन साझा करें' },
  family_perm_calls: { en: 'Direct Calling Access', hi: 'सीधे कॉल करने की सुविधा' },
  family_perm_calls_desc: { en: 'Allow family member to call your phone directly', hi: 'परिवार के सदस्य को सीधे आपके फोन पर कॉल करने दें' },
  family_perm_instructions: { en: 'Discharge & Care Guidelines', hi: 'डिस्चार्ज एवं देखभाल दिशानिर्देश' },
  family_perm_instructions_desc: { en: 'Share diet, hydration, and doctor-approved care tips', hi: 'आहार, पानी और डॉक्टर-स्वीकृत देखभाल सुझाव साझा करें' },
  family_revoke_confirm: {
    en: 'Are you sure you want to revoke this family member’s access? They will immediately lose access to your updates.',
    hi: 'क्या आप वाकई इस सदस्य की पहुंच वापस लेना चाहते हैं? वे तुरंत आपकी अपडेट तक पहुंच खो देंगे।',
  },
  family_support_note_placeholder: { en: 'Write a warm message or encouragement...', hi: 'एक प्यारा संदेश या प्रोत्साहन लिखें...' },
  family_send_support_note: { en: 'Send Note of Encouragement', hi: 'प्रोत्साहन संदेश भेजें' },
  family_support_notes_title: { en: 'Family Support & Warm Wishes', hi: 'परिवार का समर्थन और शुभकामनाएं' },
  family_invite_modal_title: { en: 'Invite a Family Member to Your Recovery Circle', hi: 'अपने रिकवरी सर्कल में परिवार के सदस्य को आमंत्रित करें' },
  family_member_name: { en: 'Family Member Name', hi: 'परिवार के सदस्य का नाम' },
  family_relationship: { en: 'Relationship', hi: 'रिश्ता' },
  family_contact_number: { en: 'Phone Number', hi: 'फोन नंबर' },
  family_invite_code: { en: 'Invite Code', hi: 'इनवाइट कोड' },
  family_status_pending: { en: 'Invitation Pending', hi: 'निमंत्रण लंबित' },
  family_status_accepted: { en: 'Access Active', hi: 'पहुंच सक्रिय' },
  family_status_revoked: { en: 'Access Revoked', hi: 'पहुंच वापस ली गई' },
  family_status_expired: { en: 'Invitation Expired', hi: 'निमंत्रण समाप्त' },
  family_revoke_btn: { en: 'Revoke Access', hi: 'पहुंच वापस लें' },
  family_restore_btn: { en: 'Restore Access', hi: 'पहुंच पुनः बहाल करें' },
  family_access_revoked_notice: {
    en: 'Access to this patient’s recovery updates has been revoked by the patient.',
    hi: 'इस मरीज की रिकवरी अपडेट तक पहुंच मरीज द्वारा वापस ले ली गई है।',
  },
  family_no_members: {
    en: 'No family members invited yet. Invite a loved one to keep them reassured.',
    hi: 'अभी तक कोई सदस्य आमंत्रित नहीं है। अपनों को आश्वस्त रखने के लिए आमंत्रित करें।',
  },
  family_care_instructions_title: { en: 'Doctor-Approved Care Guidelines', hi: 'डॉक्टर-स्वीकृत देखभाल निर्देश' },
  family_view_as_label: { en: 'Viewing as Family Member', hi: 'परिवार के सदस्य के रूप में देख रहे हैं' },
  family_welcome_title: { en: 'Support their recovery, together.', hi: 'साथ मिलकर बनाएं उनकी रिकवरी आसान।' },
  family_welcome_sub: {
    en: 'Stay connected with the updates your loved one has chosen to share.',
    hi: 'अपने प्रियजन द्वारा साझा किए गए अपडेट से जुड़े रहें।',
  },
  family_non_monitoring_note: {
    en: 'Updates reflect patient-reported check-ins and doctor-verified instructions. PulseBridge does not provide 24/7 continuous ICU telemetry or replace emergency hospital care.',
    hi: 'अपडेट्स मरीज द्वारा दर्ज चेक-इन और डॉक्टर-सत्यापित निर्देशों को दर्शाते हैं। PulseBridge 24/7 आईसीयू टेलीमेट्री प्रदान नहीं करता है और आपातकालीन सेवा का विकल्प नहीं है।',
  },
  family_conn_status_label: { en: 'Connection Status', hi: 'कनेक्शन स्थिति' },
  family_last_update_label: { en: 'Last Updated', hi: 'अंतिम अपडेट' },
  family_active_verified: { en: 'Active & Verified', hi: 'सक्रिय एवं सत्यापित' },
  family_timeline_title: { en: 'Shared Recovery Updates', hi: 'साझा किए गए रिकवरी अपडेट' },
  family_timeline_subtitle: {
    en: 'Chronological timeline of explicitly permitted health updates, medication progress, and care milestones.',
    hi: 'अनुमति प्राप्त स्वास्थ्य अपडेट, दवा प्रगति और देखभाल के मील के पत्थरों का कालानुक्रमिक विवरण।',
  },
  family_btn_acknowledge: { en: 'Acknowledge Update', hi: 'अपडेट स्वीकारें' },
  family_btn_acknowledged: { en: 'Acknowledged by Family', hi: 'परिवार द्वारा देखा गया' },
  family_source_patient: { en: 'Patient Daily Check-in', hi: 'मरीज का दैनिक चेक-इन' },
  family_source_doctor: { en: 'Doctor Verified Care Plan', hi: 'डॉक्टर सत्यापित केयर प्लान' },
  family_source_meds: { en: 'Medication Adherence Log', hi: 'दवा लॉग' },
  family_support_actions_title: { en: 'Permitted Family Support Activities', hi: 'अनुमति प्राप्त पारिवारिक सहायता गतिविधियाँ' },
  family_support_actions_subtitle: {
    en: 'Supportive actions designed to keep loved ones encouraged without altering medical decisions.',
    hi: 'प्रियजनों को प्रोत्साहित रखने के लिए बनाई गई गतिविधियाँ, जो चिकित्सीय निर्णयों को प्रभावित नहीं करतीं।',
  },
  family_support_quick_prompt1: { en: 'Proud of your recovery progress today! ❤️', hi: 'आज आपकी रिकवरी प्रगति पर गर्व है! ❤️' },
  family_support_quick_prompt2: { en: 'Remember to drink lukewarm water and rest well.', hi: 'गुनगुना पानी पीना और आराम करना याद रखें।' },
  family_support_quick_prompt3: { en: 'Taking care of everything here. Focus on getting better!', hi: 'यहाँ सब ठीक है, आप केवल ठीक होने पर ध्यान दें!' },
  family_privacy_center_title: { en: 'Family Privacy & Boundaries Center', hi: 'पारिवारिक गोपनीयता एवं सीमा केंद्र' },
  family_privacy_center_desc: {
    en: 'PulseBridge operates under strict patient-first consent. You have transparent visibility into what is shared and what remains protected.',
    hi: 'PulseBridge सख्त मरीज-प्रथम सहमति पर कार्य करता है। आपके पास स्पष्ट जानकारी है कि क्या साझा है और क्या सुरक्षित।',
  },
  family_perm_active_title: { en: 'Permitted Sharing Categories', hi: 'अनुमति प्राप्त साझाकरण श्रेणियां' },
  family_perm_restricted_title: { en: 'Protected Clinical Boundaries (Withheld)', hi: 'संरक्षित क्लीनिकल सीमाएं (रोकी गई)' },
  family_restricted_rx_full: { en: 'Raw clinical prescription monographs & chemical compounds', hi: 'कच्ची पर्ची मोनोग्राफ और रासायनिक यौगिक' },
  family_restricted_soap: { en: 'Doctor internal SOAP clinical notes & physician hypotheses', hi: 'डॉक्टर के आंतरिक SOAP क्लिनिकल नोट्स और विचार' },
  family_restricted_override: { en: 'Emergency safety overrides and hospital internal audit logs', hi: 'आपातकालीन सुरक्षा ओवरराइड और अस्पताल आंतरिक ऑडिट लॉग' },
  family_restricted_triage: { en: 'Automated clinical triage risk scoring models', hi: 'स्वचालित क्लिनिकल ट्राइएज जोखिम स्कोरिंग मॉडल' },
  family_empty_connection_title: { en: 'No Active Patient Connection', hi: 'कोई सक्रिय मरीज कनेक्शन नहीं है' },
  family_empty_connection_desc: {
    en: 'You are not currently linked to any patient recovery circle. Please ask your loved one to send an authorized invitation code from their dashboard.',
    hi: 'आप वर्तमान में किसी मरीज के रिकवरी सर्कल से जुड़े नहीं हैं। कृपया अपने प्रियजन से उनके डैशबोर्ड से इनवाइट कोड भेजने का अनुरोध करें।',
  },
  family_tab_overview: { en: 'Recovery Stream', hi: 'रिकवरी स्ट्रीम' },
  family_tab_milestones: { en: 'Care Milestones', hi: 'केयर माइलस्टोन्स' },
  family_tab_privacy: { en: 'Privacy & Permissions', hi: 'गोपनीयता एवं अनुमतियाँ' },
  family_shared_appointments_title: { en: 'Authorized Follow-up Consultations', hi: 'अधिकृत फॉलो-अप परामर्श' },
  family_notifications_title: { en: 'Recovery Notifications', hi: 'रिकवरी सूचनाएं' },
  family_mark_all_read: { en: 'Mark all as read', hi: 'सभी को पढ़ा हुआ चिह्नित करें' },
  reminder_dose: { en: 'Dose reminder', hi: 'दवाई रिमाइंडर' },
  reminder_missed: { en: 'Missed-dose reminder', hi: 'छूटी खुराक रिमाइंडर' },
  reminder_followup: { en: 'Follow-up reminder', hi: 'फॉलो-अप रिमाइंडर' },
  reminder_review: { en: 'Doctor-review reminder', hi: 'डॉक्टर-समीक्षा रिमाइंडर' },
  error_generic: { en: 'Something went wrong. Please try again.', hi: 'कुछ गलत हुआ। कृपया दोबारा कोशिश करें।' },
  error_retry: { en: 'Could not save. Please check your connection and retry.', hi: 'सेव नहीं हुआ। कनेक्शन जांचें और दोबारा कोशिश करें।' },
  success_saved: { en: 'Saved successfully.', hi: 'सफलतापूर्वक सेव हुआ।' },
  empty_no_data: { en: 'No data available yet.', hi: 'अभी कोई डेटा उपलब्ध नहीं है।' },
  sos_emergency: { en: 'Emergency: Please call 112 immediately.', hi: 'आपातकाल: कृपया तुरंत 112 पर कॉल करें।' },
  sos_call: { en: 'Call 112', hi: '112 पर कॉल करें' },
  role_admin: { en: 'System Admin', hi: 'सिस्टम एडमिन' },
  role_admin_hi: { en: 'सिस्टम एडमिन', hi: 'सिस्टम एडमिन' },
  role_admin_desc: { en: 'System operations, real-time telemetry, role directory, and security compliance.', hi: 'सिस्टम संचालन, रीयल-टाइम टेलीमेट्री, रोल डायरेक्टरी और सुरक्षा अनुपालन।' },
  admin_title: { en: 'System Operations Center', hi: 'सिस्टम ऑपरेशन्स केंद्र' },
  admin_subtitle: { en: 'Real-time infrastructure, tenant directory, and clinical security compliance', hi: 'रीयल-टाइम इन्फ्रास्ट्रक्चर, टेनेंट डायरेक्टरी और क्लीनिकल सुरक्षा ऑडिट' },
  admin_tab_overview: { en: 'System Health & Telemetry', hi: 'सिस्टम स्वास्थ्य एवं टेलीमेट्री' },
  admin_tab_access: { en: 'Role & Access Directory', hi: 'भूमिका एवं एक्सेस निर्देशिका' },
  admin_tab_security: { en: 'Security & Compliance', hi: 'सुरक्षा एवं अनुपालन' },
  admin_tab_settings: { en: 'Platform & Storage', hi: 'प्लेटफॉर्म एवं स्टोरेज' },
  admin_stat_patients: { en: 'Registered Patients', hi: 'पंजीकृत मरीज' },
  admin_stat_actions: { en: 'Active Care Actions', hi: 'सक्रिय केयर एक्शन्स' },
  admin_stat_gaps: { en: 'Detected Care Gaps', hi: 'पहचाने गए केयर गैप्स' },
  admin_stat_reports: { en: 'Diagnostic Reports', hi: 'डायग्नोस्टिक रिपोर्ट्स' },
  admin_stat_adherence: { en: 'System Adherence', hi: 'सिस्टम एडहेरेंस' },
  admin_db_status: { en: 'Database Status', hi: 'डेटाबेस स्थिति' },
  admin_db_connected: { en: 'Connected & Active', hi: 'सक्रिय एवं कनेक्टेड' },
  admin_realtime_status: { en: 'Realtime Channel', hi: 'रीयल-टाइम चैनल' },
  admin_ai_status: { en: 'AI Edge Summarizer', hi: 'एआई एज समराइज़र' },
  admin_storage_status: { en: 'Medical Doc Storage', hi: 'मेडिकल दस्तावेज़ स्टोरेज' },
  admin_unimplemented_note: { en: 'Enterprise IAM / Single Sign-On (SSO): Roadmap v2.0 (Unconfigured in this tier)', hi: 'एंटरप्राइज IAM / SSO: आगामी रोडमैप v2.0 (वर्तमान टीयर में अनकॉन्फिगर्ड)' },
  doctor_nav_overview: { en: 'Clinical Overview', hi: 'क्लीनिकल अवलोकन' },
  doctor_nav_patients: { en: 'Patient Directory', hi: 'मरीज निर्देशिका' },
  doctor_nav_radar: { en: 'CareGap Radar', hi: 'केयर गैप रडार' },
  doctor_nav_actions: { en: 'Closed-Loop Care', hi: 'क्लोज्ड-लूप केयर' },
  doctor_nav_reports: { en: 'Diagnostic Lab Reports', hi: 'डायग्नोस्टिक लैब रिपोर्ट्स' },
  doctor_emergency_override_alert: { en: 'Critical Safety Override Active', hi: 'क्रिटिकल सेफ्टी ओवरराइड सक्रिय' },
  doctor_actions_count: { en: 'Care Actions', hi: 'केयर एक्शन्स' },
  doctor_tab_summary: { en: 'Clinical Summary', hi: 'क्लीनिकल सारांश' },
  doctor_tab_rx: { en: 'Prescription Verification', hi: 'पर्ची सत्यापन' },
  doctor_tab_reports: { en: 'Diagnostic Reports & AI', hi: 'डायग्नोस्टिक रिपोर्ट्स एवं एआई' },
  doctor_tab_gaps: { en: 'Care Gaps', hi: 'केयर गैप्स' },
  doctor_tab_actions: { en: 'Action Tracking', hi: 'एक्शन ट्रैकिंग' },
  patient_recovery_status: { en: 'Recovery Journey', hi: 'रिकवरी यात्रा' },
  patient_doses_progress: { en: "Today's Medication Progress", hi: 'आज की दवाइयों की प्रगति' },
  patient_feeling_title: { en: 'How are you feeling right now?', hi: 'आप अभी कैसा महसूस कर रहे हैं?' },
  patient_tab_meds: { en: "Today's Medicines", hi: 'आज की दवाइयां' },
  patient_tab_reports: { en: 'My Medical Reports', hi: 'मेरी मेडिकल रिपोर्ट्स' },
  patient_reports_summary: { en: 'Doctor-verified summaries of your medical tests and discharge plans', hi: 'आपके मेडिकल टेस्ट और डिस्चार्ज प्लान के डॉक्टर-सत्यापित सारांश' },
  patient_no_reports: { en: 'No medical reports have been recorded for your account yet.', hi: 'आपके खाते के लिए अभी कोई मेडिकल रिपोर्ट दर्ज नहीं है।' },
  patient_grace_notice: { en: '20-minute gentle grace window active for scheduled doses', hi: 'दवाइयों के लिए 20 मिनट की ग्रेस विंडो सक्रिय है' },
  nav_switch_role: { en: 'Switch Dashboard', hi: 'डैशबोर्ड बदलें' },
  nav_doctor_dash: { en: 'Doctor Command Center', hi: 'डॉक्टर कमांड सेंटर' },
  nav_patient_dash: { en: 'Patient Health Companion', hi: 'मरीज हेल्थ साथी' },
  nav_admin_dash: { en: 'Admin Operations Center', hi: 'एडमिन ऑपरेशन्स सेंटर' },
  system_operational: { en: 'System Operational', hi: 'प्रणाली सामान्य रूप से सक्रिय' },
};

export function translate(key: TranslationKey, lang: Language, params?: Record<string, string | number>): string {
  const entry = dict[key];
  if (!entry) return key;
  let text = entry[lang] ?? entry.en;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
