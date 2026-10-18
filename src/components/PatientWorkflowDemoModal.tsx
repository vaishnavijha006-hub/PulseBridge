import { useState, useCallback, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Volume2,
  VolumeX,
  FileText,
  Stethoscope,
  HeartPulse,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Phone,
  Pill,
} from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { voiceGuidanceService } from '@/services/voiceGuidanceService';
import { cn } from '@/utils/cn';

interface PatientWorkflowDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExploreDemoPatient: () => void;
  onStartIntake?: () => void;
}

export function PatientWorkflowDemoModal({
  isOpen,
  onClose,
  onExploreDemoPatient,
  onStartIntake,
}: PatientWorkflowDemoModalProps) {
  const { lang } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState<'good' | 'ok' | 'bad'>('bad');
  const [familyConsentActive, setFamilyConsentActive] = useState(true);

  // Stop audio when closing modal or switching steps
  useEffect(() => {
    if (!isOpen) {
      voiceGuidanceService.stop();
      setIsPlayingAudio(false);
    }
  }, [isOpen]);

  const handleStepChange = (newStep: number) => {
    voiceGuidanceService.stop();
    setIsPlayingAudio(false);
    setCurrentStep(newStep);
  };

  const handlePlayVoice = useCallback(() => {
    if (isPlayingAudio) {
      voiceGuidanceService.stop();
      setIsPlayingAudio(false);
      return;
    }

    const textToSpeak =
      lang === 'hi'
        ? 'नमस्ते रवि जी! आपकी दोपहर की दवा मेटफॉर्मिन 500 मिलीग्राम लेने का समय हो गया है। कृपया खाना खाने के बाद इसे एक गिलास पानी के साथ लें।'
        : 'Hello Ravi ji! It is time to take your afternoon dose of Metformin 500 milligrams. Please take it with a glass of water after your meal.';

    setIsPlayingAudio(true);
    voiceGuidanceService.speak(textToSpeak, lang, {
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false),
    });
  }, [isPlayingAudio, lang]);

  if (!isOpen) return null;

  const steps = [
    {
      id: 'intake',
      badge: lang === 'hi' ? 'चरण 1: स्मार्ट पंजीकरण' : 'Step 1: Smart Intake',
      title:
        lang === 'hi'
          ? 'आसान पंजीकरण, ABHA आईडी व बोलकर लक्षण दर्ज'
          : 'Multilingual Intake, ABHA Link & Voice Symptoms',
      desc:
        lang === 'hi'
          ? 'मरीज़ या उनके परिजन नाम, आयु, 10-अंकीय फोन नंबर और अपनी 14-अंकीय ABHA हेल्थ आईडी दर्ज करते हैं। बुजुर्ग मरीज़ टाइप करने के बजाय हिंदी या अंग्रेजी में बोलकर अपने लक्षण बता सकते हैं।'
          : 'Patients or family members enter basic profile details with strict 10-digit phone verification and 14-digit ABHA ID integration. Patients can speak their symptoms in Hindi or English using voice-to-text.',
      tagline: lang === 'hi' ? 'शून्य जटिलता · बुजुर्गों के लिए सुलभ' : 'Zero Friction · Accessible for Seniors',
      icon: Phone,
    },
    {
      id: 'upload',
      badge: lang === 'hi' ? 'चरण 2: पर्ची स्कैन' : 'Step 2: Prescription Scan',
      title:
        lang === 'hi'
          ? 'कागजी पर्ची की फोटो खींचें, AI निकालेगा दवाइयां'
          : 'Camera Scan & Automated AI OCR Extraction',
      desc:
        lang === 'hi'
          ? 'अस्पताल से मिली पर्ची की बस एक फोटो अपलोड करें। PulseBridge AI हस्तलिखित पर्चियों से दवा का नाम (उदा. Aspirin, Metformin), खुराक और समय स्वतः निकालकर ड्राफ्ट तैयार करता है।'
          : 'Simply upload or snap a photo of the paper prescription. PulseBridge AI extracts medicine names, dosages, frequencies, and durations into a structured draft in seconds.',
      tagline: lang === 'hi' ? 'हस्तलिखित पर्ची पहचान · 96% सटीकता' : 'Handwritten OPD OCR · High Accuracy',
      icon: FileText,
    },
    {
      id: 'doctor',
      badge: lang === 'hi' ? 'चरण 3: डॉक्टर पुष्टि' : 'Step 3: Doctor Verification',
      title:
        lang === 'hi'
          ? 'क्लीनिकल सुरक्षा: डॉक्टर की अनुमति के बिना दवा सक्रिय नहीं'
          : 'Physician Human-in-the-Loop Safety Guardrail',
      desc:
        lang === 'hi'
          ? 'मरीज़ की सुरक्षा सर्वोपरि है। AI द्वारा निकाली गई दवाइयों को डॉक्टर अपने कमांड सेंटर में जांचते हैं और पुष्टि (Confirm) करते हैं। इसके बाद ही मरीज़ के फोन पर दवा का समय सक्रिय होता है।'
          : 'Critical safety guarantee: No AI-extracted prescription ever reaches a patient blindly. A verified doctor reviews, edits, and confirms the regimen before any reminder is scheduled.',
      tagline: lang === 'hi' ? '100% डॉक्टर सत्यापित · शून्य अंधविश्वास' : '100% Doctor Confirmed · Zero Hallucinations',
      icon: Stethoscope,
    },
    {
      id: 'reminders',
      badge: lang === 'hi' ? 'चरण 4: दवा रिमाइंडर' : 'Step 4: Smart Reminders',
      title:
        lang === 'hi'
          ? 'आवाज़ में दवा रिमाइंडर और 20-मिनट ग्रेस विंडो'
          : 'Voice-Guided Daily Doses & 20-Minute Grace Window',
      desc:
        lang === 'hi'
          ? 'दवा के समय मरीज़ को स्पष्ट हिंदी/अंग्रेजी आवाज़ में अलर्ट मिलता है। मरीज़ एक क्लिक में "दवा ली (Taken)", "10 मिनट बाद (Snooze)", या "नहीं ले सकता" चुन सकते हैं। 20 मिनट की नैदानिक ग्रेस विंडो दी जाती है।'
          : 'Patients hear personalized, friendly voice reminders in their chosen language. Single-tap confirmation ("Taken", "Snooze 10m", or "Cannot Take") feeds transparent adherence scoring.',
      tagline: lang === 'hi' ? 'हिंदी आवाज़ निर्देश · 1-टैप कन्फर्मेशन' : 'Bilingual Spoken Audio · 1-Tap Adherence',
      icon: Pill,
    },
    {
      id: 'checkin',
      badge: lang === 'hi' ? 'चरण 5: स्वास्थ्य जांच' : 'Step 5: Daily Check-In',
      title:
        lang === 'hi'
          ? 'दैनिक स्थिति (Good/OK/Bad) और तुरंत डॉक्टर अलर्ट'
          : 'Daily Check-In & Closed-Loop CareGap Radar',
      desc:
        lang === 'hi'
          ? 'रोजाना मरीज़ अपनी सेहत (अच्छा, ठीक, खराब) चुनते हैं। यदि मरीज़ को सीने में दर्द या चक्कर आते हैं, तो AI तुरंत डॉक्टर के रडार में 82/100 प्राथमिकता का केयर गैप अलार्म भेजता है ताकि अस्पताल दोबारा भर्ती न होना पड़े।'
          : 'A simple 3-face daily check-in (Good, OK, Bad). If an adverse symptom like chest discomfort is logged, CareGap Radar instantly prioritizes the patient in the physician dashboard.',
      tagline: lang === 'hi' ? 'सतत निगरानी · अस्पताल दोबारा जाने से बचाव' : 'Zero Silent Drops · Hospital-to-Home Closed Loop',
      icon: HeartPulse,
    },
    {
      id: 'family',
      badge: lang === 'hi' ? 'चरण 6: परिवार सुरक्षा' : 'Step 6: Family Circle',
      title:
        lang === 'hi'
          ? 'परिवार का सुरक्षा घेरा: सुकून भरे अपडेट, मरीज़ की प्राइवेसी'
          : 'Family Recovery Circle & Patient-Controlled Privacy',
      desc:
        lang === 'hi'
          ? 'मरीज़ के परिजन (जैसे बेटी प्रिया) देख सकते हैं कि आज कितनी दवाइयां ली गईं और सेहत कैसी है—बिना डरावने मेडिकल जार्गन के। मरीज़ कभी भी एक क्लिक में परिवार की अनुमति रद्द कर सकता है।'
          : 'Family members get calming, peace-of-mind recovery updates without alarming clinical jargon. The patient retains complete cryptographic sovereignty to revoke access at any time.',
      tagline: lang === 'hi' ? 'परिजनों को मानसिक शांति · पूर्ण गोपनीयता' : 'Peace of Mind for Caregivers · Privacy Sovereign',
      icon: Users,
    },
  ];

  const current = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0C1527] border border-teal-500/30 shadow-2xl shadow-teal-950/60 overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700/80 bg-navy-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                {lang === 'hi' ? 'मरीज़ वर्कफ़्लो: वेबसाइट कैसे काम करती है?' : 'Patient Workflow: How PulseBridge Works'}
              </h2>
              <p className="text-[11px] text-teal-300 font-medium">
                {lang === 'hi' ? 'चरण-दर-चरण इंटरेक्टिव डेमो' : 'Step-by-Step Interactive Walkthrough'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-slate-400 bg-navy-800 px-2.5 py-1 rounded-full border border-navy-700">
              {currentStep + 1} / {steps.length}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Tabs Navigation Strip */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2.5 bg-navy-950/70 border-b border-navy-800/80 overflow-x-auto no-scrollbar">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <button
                key={s.id}
                onClick={() => handleStepChange(idx)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border',
                  isActive
                    ? 'bg-teal-500/20 text-teal-200 border-teal-500/50 shadow-sm shadow-teal-500/20'
                    : isCompleted
                    ? 'bg-navy-800/70 text-slate-300 border-navy-700 hover:border-slate-600'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
                )}
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold',
                    isActive
                      ? 'bg-teal-400 text-navy-950'
                      : isCompleted
                      ? 'bg-teal-500/30 text-teal-300'
                      : 'bg-navy-700 text-slate-400'
                  )}
                >
                  {isCompleted ? '✓' : idx + 1}
                </span>
                <span>{s.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Main Step Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* Step Header & Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold w-fit">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>{current.badge}</span>
            </div>
            <span className="text-xs text-slate-400 font-medium italic">
              {current.tagline}
            </span>
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
              {current.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-1.5 max-w-3xl">
              {current.desc}
            </p>
          </div>

          {/* Interactive Visual Simulation Card for the Active Step */}
          <div className="rounded-2xl bg-gradient-to-br from-navy-900/90 to-navy-950/90 border border-navy-700/80 p-4 sm:p-6 shadow-inner">
            {/* STEP 1 SIMULATION: INTAKE */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-navy-700 pb-3">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {lang === 'hi' ? 'मरीज़ पंजीकरण फॉर्म दृश्य' : 'Patient Intake Form Preview'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded-full border border-teal-500/30">
                    Step 2 of 3 · Demographics & ABHA
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-navy-800/80 p-3 border border-navy-700">
                    <span className="text-slate-400 text-[11px] block">{lang === 'hi' ? 'मरीज़ का नाम *' : 'Patient Name *'}</span>
                    <span className="text-white font-bold text-sm">Ravi Sharma</span>
                  </div>
                  <div className="rounded-xl bg-navy-800/80 p-3 border border-navy-700 flex justify-between items-center">
                    <div>
                      <span className="text-slate-400 text-[11px] block">{lang === 'hi' ? 'आयु व लिंग *' : 'Age & Gender *'}</span>
                      <span className="text-white font-bold text-sm">62 yrs · Male</span>
                    </div>
                    <span className="text-[10px] text-teal-400 font-semibold bg-teal-500/10 px-2 py-0.5 rounded">
                      Age Verified
                    </span>
                  </div>
                  <div className="rounded-xl bg-navy-800/80 p-3 border border-navy-700">
                    <span className="text-slate-400 text-[11px] block">{lang === 'hi' ? 'मोबाइल नंबर (10 अंक अनिवार्य) *' : 'Phone (Strict 10 Digits) *'}</span>
                    <span className="text-teal-300 font-mono font-bold text-sm">+91 98765 43210</span>
                  </div>
                  <div className="rounded-xl bg-navy-800/80 p-3 border border-teal-500/30">
                    <span className="text-slate-400 text-[11px] block">{lang === 'hi' ? 'ABHA स्वास्थ्य खाता (14 अंक)' : 'ABHA Health Number (14 Digits)'}</span>
                    <span className="text-teal-300 font-mono font-bold text-sm">14-8899-7766-5544</span>
                  </div>
                </div>

                <div className="rounded-xl bg-navy-800/60 p-3.5 border border-navy-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
                      🎙️
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {lang === 'hi' ? 'बोलकर लक्षण दर्ज करें (Voice-to-Text)' : 'Voice-to-Text Clinical Intake'}
                      </span>
                      <span className="text-[11px] text-slate-300 italic">
                        "{lang === 'hi' ? 'सुबह से सीने में हल्का भारीपन महसूस हो रहा है...' : 'Feeling slight heaviness in chest since morning...'}"
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/30 font-semibold flex-shrink-0">
                    Hindi Audio Captured
                  </span>
                </div>
              </div>
            )}

            {/* STEP 2 SIMULATION: OCR */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-navy-700 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {lang === 'hi' ? 'पर्ची ओसीआर एवं दवा विश्लेषण' : 'Prescription OCR Extractor'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                    AI Draft · Awaiting Doctor Sign-Off
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-navy-800/90 border border-navy-700 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">Medicine 1</span>
                        <span className="text-[10px] text-teal-400 font-bold">98% Match</span>
                      </div>
                      <span className="text-sm font-bold text-white block">Aspirin (Ecosprin)</span>
                      <span className="text-xs text-teal-300 font-mono">75 mg · Once Daily</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 block border-t border-navy-700/60 pt-1.5">
                      Instructions: After Breakfast
                    </span>
                  </div>

                  <div className="rounded-xl bg-navy-800/90 border border-navy-700 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">Medicine 2</span>
                        <span className="text-[10px] text-teal-400 font-bold">95% Match</span>
                      </div>
                      <span className="text-sm font-bold text-white block">Metformin HCl</span>
                      <span className="text-xs text-teal-300 font-mono">500 mg · Twice Daily</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 block border-t border-navy-700/60 pt-1.5">
                      Instructions: After Lunch & Dinner
                    </span>
                  </div>

                  <div className="rounded-xl bg-navy-800/90 border border-navy-700 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">Medicine 3</span>
                        <span className="text-[10px] text-teal-400 font-bold">97% Match</span>
                      </div>
                      <span className="text-sm font-bold text-white block">Atorvastatin</span>
                      <span className="text-xs text-teal-300 font-mono">10 mg · Night</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 block border-t border-navy-700/60 pt-1.5">
                      Instructions: At Bedtime
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-navy-800/60 border border-teal-500/20 p-3 text-xs text-slate-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    <span>
                      {lang === 'hi'
                        ? 'दवाइयां ड्राफ्ट के रूप में सुरक्षित हैं। डॉक्टर द्वारा पुष्टि के बाद ही अलार्म शुरू होंगे।'
                        : 'OCR draft held in secure pending state until clinical physician confirmation.'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 SIMULATION: DOCTOR REVIEW */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-navy-700 pb-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {lang === 'hi' ? 'डॉक्टर क्लीनिकल कमांड सेंटर' : 'Physician Command Center Gate'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-teal-300 bg-teal-500/20 px-2 py-0.5 rounded-full border border-teal-500/40">
                    Human-in-the-Loop Verified
                  </span>
                </div>

                <div className="rounded-xl bg-navy-800/80 p-4 border border-navy-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Dr. Aditi Rao (Cardiology, AIIMS)
                    </span>
                    <span className="text-xs text-slate-400">
                      License: MCI-2018-84729 · Status: Verified Active Clinician
                    </span>
                    <p className="text-xs text-teal-300 mt-1">
                      ✓ Regimen reviewed: Metformin 500mg, Aspirin 75mg, Atorvastatin 10mg confirmed.
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-teal-500/20 border border-teal-400/40 text-teal-300 text-xs font-bold flex items-center gap-1.5 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Regimen Activated</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-slate-300">
                  <div className="p-2.5 rounded-lg bg-navy-800/50 border border-navy-700/60 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Dose conflicts checked</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-navy-800/50 border border-navy-700/60 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Allergy cross-checked</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-navy-800/50 border border-navy-700/60 flex items-center gap-2 col-span-2 sm:col-span-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Daily schedule generated</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 SIMULATION: MEDICATION SCHEDULE */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-navy-700 pb-3">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {lang === 'hi' ? 'आज की दवाइयां व आवाज़ रिमाइंडर' : 'Today’s Medication Regimen'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePlayVoice}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border',
                        isPlayingAudio
                          ? 'bg-amber-500 text-navy-950 border-amber-400 shadow-lg shadow-amber-500/30'
                          : 'bg-teal-500/20 text-teal-300 border-teal-500/40 hover:bg-teal-500/30'
                      )}
                    >
                      {isPlayingAudio ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5" />
                          <span>{lang === 'hi' ? 'आवाज़ रोकें' : 'Stop Audio'}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-teal-400 animate-bounce" />
                          <span>{lang === 'hi' ? 'आवाज़ में सुनें (Play Voice)' : 'Play Voice Audio'}</span>
                        </>
                      )}
                    </button>
                    <span className="text-xs font-mono font-bold text-teal-400">
                      2 of 3 taken
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {/* Dose 1: Taken */}
                  <div className="p-3 rounded-xl bg-navy-800/80 border border-navy-700 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400 flex items-center justify-center font-bold text-xs">
                        ✓
                      </div>
                      <div>
                        <span className="text-white font-bold block">Aspirin 75mg · 08:00 AM</span>
                        <span className="text-[11px] text-slate-400">Taken with breakfast</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/30">
                      Taken at 08:12 AM
                    </span>
                  </div>

                  {/* Dose 2: Active / Due */}
                  <div className="p-3.5 rounded-xl bg-navy-800/90 border-2 border-teal-500/50 shadow-md shadow-teal-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400 flex items-center justify-center font-bold text-xs">
                        ⏰
                      </div>
                      <div>
                        <span className="text-white font-bold block text-sm">Metformin 500mg · 01:00 PM</span>
                        <span className="text-[11px] text-teal-300 font-medium">
                          {lang === 'hi' ? 'दोपहर खाने के बाद · 20 मिनट ग्रेस विंडो सक्रिय' : 'After Lunch · 20-min grace window active'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-navy-950 font-bold transition-colors">
                        ✓ {lang === 'hi' ? 'दवा ले ली' : 'Mark Taken'}
                      </button>
                      <button className="px-2.5 py-1.5 rounded-lg bg-navy-700 hover:bg-navy-600 text-slate-300 font-medium border border-navy-600">
                        {lang === 'hi' ? '10 मिनट बाद' : 'Snooze 10m'}
                      </button>
                    </div>
                  </div>

                  {/* Dose 3: Evening Pending */}
                  <div className="p-3 rounded-xl bg-navy-800/50 border border-navy-700/60 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="text-slate-300 font-semibold block">Atorvastatin 10mg · 10:00 PM</span>
                        <span className="text-[11px]">Bedtime dose</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-navy-700 px-2 py-0.5 rounded text-slate-300">
                      Scheduled
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5 SIMULATION: DAILY CHECK-IN & DOCTOR ALERT */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-navy-700 pb-3">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {lang === 'hi' ? 'दैनिक स्वास्थ्य चेक-इन व अलर्ट' : 'Daily Check-In & Closed Loop'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-danger-300 bg-danger-500/15 px-2 py-0.5 rounded-full border border-danger-500/30">
                    Closed-Loop Active
                  </span>
                </div>

                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-300 block">
                    {lang === 'hi' ? 'आज आप कैसा महसूस कर रहे हैं?' : 'How are you feeling today?'}
                  </span>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <button
                      onClick={() => setSelectedFeeling('good')}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all text-xs font-bold flex flex-col items-center gap-1',
                        selectedFeeling === 'good'
                          ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                          : 'bg-navy-800/60 border-navy-700 text-slate-400 hover:text-white'
                      )}
                    >
                      <span className="text-xl">😊</span>
                      <span>{lang === 'hi' ? 'अच्छा (Good)' : 'Good'}</span>
                    </button>

                    <button
                      onClick={() => setSelectedFeeling('ok')}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all text-xs font-bold flex flex-col items-center gap-1',
                        selectedFeeling === 'ok'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-navy-800/60 border-navy-700 text-slate-400 hover:text-white'
                      )}
                    >
                      <span className="text-xl">😐</span>
                      <span>{lang === 'hi' ? 'ठीक (OK)' : 'OK'}</span>
                    </button>

                    <button
                      onClick={() => setSelectedFeeling('bad')}
                      className={cn(
                        'p-2.5 rounded-xl border text-center transition-all text-xs font-bold flex flex-col items-center gap-1',
                        selectedFeeling === 'bad'
                          ? 'bg-danger-500/20 border-danger-400 text-danger-300 shadow-md shadow-danger-500/20'
                          : 'bg-navy-800/60 border-navy-700 text-slate-400 hover:text-white'
                      )}
                    >
                      <span className="text-xl">😟</span>
                      <span>{lang === 'hi' ? 'खराब (Bad)' : 'Bad / Discomfort'}</span>
                    </button>
                  </div>

                  {selectedFeeling === 'bad' && (
                    <div className="p-3.5 rounded-xl bg-danger-500/10 border border-danger-500/30 text-xs space-y-2 animate-fadeIn">
                      <div className="flex items-center gap-2 text-danger-300 font-bold">
                        <AlertTriangle className="w-4 h-4 text-danger-400 flex-shrink-0" />
                        <span>
                          {lang === 'hi'
                            ? 'डॉक्टर अलर्ट ट्रिगर हुआ: प्राथमिकता स्कोर 82/100'
                            : 'Immediate Physician CareGap Triggered: Triage Priority 82/100'}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {lang === 'hi'
                          ? 'लक्षण: "सीने में भारीपन"। डॉक्टर के रडार में तुरंत सूचना भेजी गई है ताकि समय पर फॉलो-अप कॉल या ईसीजी की सलाह दी जा सके।'
                          : 'Reported: "Chest Heaviness". Pushed to Dr. Aditi Rao\'s active triage radar. Closed-loop follow-up dispatched automatically.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 6 SIMULATION: FAMILY RECOVERY CIRCLE */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-navy-700 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {lang === 'hi' ? 'परिवार रिकवरी सर्कल' : 'Family Recovery Circle'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded-full border border-teal-500/30">
                    Patient-Controlled Privacy
                  </span>
                </div>

                <div className="rounded-xl bg-navy-800/80 p-4 border border-navy-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-white block">
                        Priya Sharma (Daughter / Caregiver)
                      </span>
                      <span className="text-xs text-slate-400">
                        +91 98765 43210 · Authorized Family Observer
                      </span>
                    </div>

                    <button
                      onClick={() => setFamilyConsentActive(!familyConsentActive)}
                      className={cn(
                        'text-xs font-bold px-3 py-1.5 rounded-lg border transition-all',
                        familyConsentActive
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 hover:bg-danger-500/20 hover:text-danger-300 hover:border-danger-500/40'
                          : 'bg-navy-700 text-slate-400 border-navy-600 hover:bg-teal-500/20 hover:text-teal-300'
                      )}
                    >
                      {familyConsentActive
                        ? lang === 'hi'
                          ? 'अनुमति प्राप्त ✓ (रद्द करने के लिए टैप करें)'
                          : 'Access Granted ✓ (Tap to Revoke)'
                        : lang === 'hi'
                        ? 'अनुमति रद्द ✕ (पुनः सक्रिय करें)'
                        : 'Access Revoked ✕ (Tap to Enable)'}
                    </button>
                  </div>

                  {familyConsentActive ? (
                    <div className="p-3 rounded-lg bg-navy-900/90 border border-teal-500/20 text-xs text-slate-300 space-y-1">
                      <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block">
                        {lang === 'hi' ? 'परिवार को दिखने वाला सरल संदेश:' : 'Peace-of-Mind Caregiver View:'}
                      </span>
                      <p className="text-slate-200">
                        {lang === 'hi'
                          ? '"रवि जी ने आज की 3 में से 2 दवाइयां समय पर ले ली हैं और वे आराम कर रहे हैं। रिकवरी अच्छी चल रही है।"'
                          : '"Ravi ji has taken 2 of 3 doses on time today and is resting comfortably. Recovery is progressing normally."'}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-navy-900/90 border border-navy-700 text-xs text-slate-400 italic">
                      {lang === 'hi'
                        ? 'मरीज़ द्वारा परिवार का एक्सेस बंद कर दिया गया है। कोई जानकारी साझा नहीं हो रही है।'
                        : 'Family access has been revoked by patient. All records strictly redacted.'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-navy-800 bg-navy-900/90">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleStepChange(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors',
                currentStep === 0
                  ? 'border-navy-700 text-slate-600 cursor-not-allowed'
                  : 'border-navy-600 text-slate-300 hover:text-white hover:bg-navy-800'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{lang === 'hi' ? 'पिछला' : 'Previous'}</span>
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => handleStepChange(currentStep + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-700 hover:bg-navy-600 text-teal-300 hover:text-white text-xs font-bold border border-navy-600 transition-colors"
              >
                <span>{lang === 'hi' ? 'अगला चरण' : 'Next Step'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleStepChange(0)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'फिर से देखें' : 'Restart Tour'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {onStartIntake && (
              <button
                onClick={() => {
                  onClose();
                  onStartIntake();
                }}
                className="px-3.5 py-2 rounded-xl border border-teal-500/30 text-teal-300 hover:text-white text-xs font-semibold hover:bg-teal-500/10 transition-colors"
              >
                {lang === 'hi' ? 'नया मरीज़ पंजीकरण' : 'Start Intake'}
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onExploreDemoPatient();
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 via-teal-400 to-cyan-400 hover:from-teal-400 hover:to-cyan-300 text-navy-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-teal-500/20 transition-all"
            >
              <span>{lang === 'hi' ? 'लाइव डेमो मरीज़ (रवि शर्मा) खोलें' : 'Open Live Demo Patient (Ravi Sharma)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
