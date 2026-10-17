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
