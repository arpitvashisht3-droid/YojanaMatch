import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  MapPin,
  Briefcase,
  TrendingUp,
  User,
  Mic,
  MicOff,
  Navigation,
  ExternalLink,
  ShieldCheck,
  Edit2,
  Volume2,
  VolumeX,
  Trophy,
  Tags,
  UsersRound,
  HeartHandshake,
  Accessibility,
  Scissors,
  Milk,
  Store,
  UtensilsCrossed,
  ShoppingBag,
  Palette,
  Factory,
  Wallet
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import { INDIAN_STATES_AND_UTS, userRecordToProfile } from '../lib/userProfileHelper';
import { startSpeechRecognition, isSpeechRecognitionSupported, speakText, stopSpeaking } from '../lib/speechService';
import { KaraokeExplanation } from './KaraokeExplanation';
import { matchSchemes } from '../lib/matchingEngine';
import schemesData from '../data/schemes.json';
import { CasteCategory, DistrictType, BusinessType, Gender, UserRecord, MatchedSchemeResult } from '../types';

export const OnboardingScreen: React.FC = () => {
  const { language, user, updateUserProfile, navigateTo } = useAppStore();
  const t = translations[language];

  // Current step 1 to 7 (resume from saved user step if available)
  const [step, setStep] = useState<number>(user?.onboarding_step || 1);

  // Form states initialized from existing user record
  const [name, setName] = useState(user?.name || '');
  const [ageRange, setAgeRange] = useState<string>(user?.age_range || '');
  const [gender, setGender] = useState<Gender | undefined>(user?.gender);
  const [categories, setCategories] = useState<string[]>(user?.categories || []);
  const [stateName, setStateName] = useState<string>(user?.state || '');
  const [districtType, setDistrictType] = useState<DistrictType | undefined>(user?.district_type);
  const [bizSituation, setBizSituation] = useState<'existing' | 'new'>(user?.business_situation || 'new');
  const [bizType, setBizType] = useState<BusinessType | undefined>(user?.business_type);
  const [customBizType, setCustomBizType] = useState<string>(user?.business_type_custom || '');
  const [bizAge, setBizAge] = useState<'0-1' | '1-3' | '3+' | undefined>(user?.business_age);
  const [incomeRange, setIncomeRange] = useState<string>(user?.income_range || '');

  // Voice recording state
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [stopVoiceFn, setStopVoiceFn] = useState<(() => void) | null>(null);

  // Step read-aloud (TTS) state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [highlightMode, setHighlightMode] = useState<'word' | 'paragraph'>('word');

  // GPS state
  const [isLocating, setIsLocating] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  // State search filter in dropdown
  const [stateSearch, setStateSearch] = useState('');

  // Keep state synced if user changes
  useEffect(() => {
    if (user) {
      if (user.onboarding_step && user.onboarding_step > 1 && step === 1) {
        setStep(user.onboarding_step);
      }
      if (!name && user.name) setName(user.name);
      if (!stateName && user.state) setStateName(user.state);
      if (!ageRange && user.age_range) setAgeRange(user.age_range);
      if (!gender && user.gender) setGender(user.gender);
      if ((!categories || categories.length === 0) && user.categories) setCategories(user.categories);
      if (!districtType && user.district_type) setDistrictType(user.district_type);
      if (!bizType && user.business_type) setBizType(user.business_type);
      if (!incomeRange && user.income_range) setIncomeRange(user.income_range);
    }
  }, [user]);

  // Clean up voice recording on unmount
  useEffect(() => {
    return () => {
      if (stopVoiceFn) stopVoiceFn();
    };
  }, [stopVoiceFn]);

  // Save current step data partially to backend
  const persistStep = async (nextStep: number, additionalUpdates: Partial<UserRecord> = {}) => {
    const updates: Partial<UserRecord> = {
      onboarding_step: nextStep,
      name: name.trim() || user?.name,
      age_range: ageRange || undefined,
      gender,
      categories,
      state: stateName || null,
      district_type: districtType,
      business_situation: bizSituation,
      business_type: bizType,
      business_type_custom: customBizType || undefined,
      business_age: bizAge,
      income_range: incomeRange || undefined,
      ...additionalUpdates,
    };
    await updateUserProfile(updates);
    setStep(nextStep);
  };

  // Toggle category multi-select
  const handleToggleCategory = (cat: string) => {
    if (cat === 'Prefer not to say') {
      setCategories(['Prefer not to say']);
      return;
    }
    const filtered = categories.filter((c) => c !== 'Prefer not to say');
    if (filtered.includes(cat)) {
      setCategories(filtered.filter((c) => c !== cat));
    } else {
      setCategories([...filtered, cat]);
    }
  };

  // Voice Input Toggle
  const toggleVoiceInput = (targetField: 'name' | 'biz' | 'state') => {
    if (isVoiceActive) {
      if (stopVoiceFn) stopVoiceFn();
      setIsVoiceActive(false);
      setStopVoiceFn(null);
      return;
    }

    if (!isSpeechRecognitionSupported()) return;

    setIsVoiceActive(true);
    const stop = startSpeechRecognition(
      language,
      (transcript) => {
        if (targetField === 'name') {
          setName(transcript);
        } else if (targetField === 'biz') {
          setCustomBizType(transcript);
        } else if (targetField === 'state') {
          const matchedState = INDIAN_STATES_AND_UTS.find((s) =>
            s.toLowerCase().includes(transcript.toLowerCase()) ||
            transcript.toLowerCase().includes(s.toLowerCase())
          );
          if (matchedState) {
            setStateName(matchedState);
          }
        }
      },
      () => setIsVoiceActive(false),
      () => setIsVoiceActive(false)
    );
    setStopVoiceFn(() => stop);
  };

  // GPS Geolocation Handler
  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage(t.gps_failed);
      return;
    }

    setIsLocating(true);
    setGpsMessage(t.gps_locating);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        try {
          // Reverse geocode via free open API
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
          );
          if (res.ok) {
            const data = await res.json();
            const detectedState = data.address?.state;
            if (detectedState) {
              const matched = INDIAN_STATES_AND_UTS.find((s) =>
                s.toLowerCase().includes(detectedState.toLowerCase()) ||
                detectedState.toLowerCase().includes(s.toLowerCase())
              );
              if (matched) {
                setStateName(matched);
                setGpsMessage(`Location set to: ${matched}`);
                return;
              }
            }
          }
          setGpsMessage("Location detected! Please confirm your state in the dropdown below.");
        } catch {
          setGpsMessage(t.gps_failed);
        }
      },
      () => {
        setIsLocating(false);
        setGpsMessage(t.gps_failed);
      },
      { timeout: 7000 }
    );
  };

  // Filtered states
  const filteredStates = useMemo(() => {
    if (!stateSearch.trim()) return INDIAN_STATES_AND_UTS;
    return INDIAN_STATES_AND_UTS.filter((s) =>
      s.toLowerCase().includes(stateSearch.toLowerCase())
    );
  }, [stateSearch]);

  // Current temporary profile object for matching preview on Step 7
  const currentTempUserRecord: UserRecord = useMemo(() => ({
    name: name || user?.name || '',
    phone_number: user?.phone_number || '',
    created_at: user?.created_at || new Date().toISOString(),
    onboarding_completed: false,
    age_range: ageRange,
    gender,
    categories,
    state: stateName,
    district_type: districtType,
    business_situation: bizSituation,
    business_type: bizType,
    business_type_custom: customBizType,
    business_age: bizAge,
    income_range: incomeRange,
  }), [name, user, ageRange, gender, categories, stateName, districtType, bizSituation, bizType, customBizType, bizAge, incomeRange]);

  // Live matching, recomputed whenever any onboarding field changes, so the sidebar
  // can show a running "X of Y schemes match so far" count across every step.
  const liveMatches: MatchedSchemeResult[] = useMemo(() => {
    const profile = userRecordToProfile(currentTempUserRecord);
    return matchSchemes(profile, schemesData as any);
  }, [currentTempUserRecord]);

  const totalSchemesCount = (schemesData as any[]).length;

  // Calculate instant matched schemes preview on Step 7 (top 3, reusing liveMatches)
  const instantMatches: MatchedSchemeResult[] = useMemo(() => {
    if (step !== 7) return [];
    return liveMatches.slice(0, 3);
  }, [step, liveMatches]);

  // Confidence meter: how many key profile signals are filled in so far (out of 5)
  const filledSignalsCount = useMemo(() => {
    let count = 0;
    if (ageRange) count++;
    if (gender) count++;
    if (categories.length > 0) count++;
    if (stateName) count++;
    if (bizType || incomeRange) count++;
    return count;
  }, [ageRange, gender, categories, stateName, bizType, incomeRange]);

  // Count of schemes applicable to the selected state (or nationwide schemes)
  const stateSchemeCount = useMemo(() => {
    if (!stateName) return 0;
    return (schemesData as any[]).filter((s) => {
      const states: string[] = s.applicable_states || [];
      return states.length === 0 || states.includes('All India') || states.includes('All') || states.includes(stateName);
    }).length;
  }, [stateName]);

  // Icon lookup maps for category chips and business-type illustration
  const catIconMap: Record<string, React.ElementType> = {
    SC: UsersRound,
    ST: UsersRound,
    OBC: UsersRound,
    Minority: UsersRound,
    Woman: HeartHandshake,
    'Person with Disability': Accessibility,
    General: User,
  };

  const bizIconMap: Record<string, React.ElementType> = {
    textile_weaving: Scissors,
    dairy_livestock: Milk,
    retail_shop: Store,
    food_processing: UtensilsCrossed,
    street_vendor: ShoppingBag,
    artisan_handicraft: Palette,
    services: Briefcase,
    manufacturing: Factory,
  };

  // Finish Onboarding & Go to Home
  const handleCompleteOnboarding = async () => {
    await persistStep(7, { onboarding_completed: true });
    navigateTo('landing');
  };

  const stepTitles = [
    { num: 1, title: language === 'hi' ? 'स्वागत' : 'Welcome', subtitle: language === 'hi' ? 'मंच परिचय' : 'Platform intro' },
    { num: 2, title: language === 'hi' ? 'बुनियादी पहचान' : 'Basic Identity', subtitle: language === 'hi' ? 'आयु एवं जेंडर' : 'Age & Gender' },
    { num: 3, title: language === 'hi' ? 'सामाजिक श्रेणी' : 'Social Category', subtitle: language === 'hi' ? 'आरक्षण एवं प्राथमिकता' : 'Caste & Group' },
    { num: 4, title: language === 'hi' ? 'स्थान' : 'Location', subtitle: language === 'hi' ? 'राज्य व क्षेत्र' : 'State & Region' },
    { num: 5, title: language === 'hi' ? 'उद्यम स्थिति' : 'Venture Details', subtitle: language === 'hi' ? 'व्यवसाय का प्रकार' : 'Business type' },
    { num: 6, title: language === 'hi' ? 'आय विवरण' : 'Income Bracket', subtitle: language === 'hi' ? 'वार्षिक अनुमान' : 'Annual income' },
    { num: 7, title: language === 'hi' ? 'पात्रता मिलान' : 'Match Preview', subtitle: language === 'hi' ? 'सत्यापित योजनाएं' : 'Matched schemes' },
  ];

  // Compose the current step's heading + message for read-aloud playback
  const getCurrentStepSpeechText = (): string => {
    switch (step) {
      case 1: return t.step1_message;
      case 2: return t.step2_message;
      case 3: return t.step3_message;
      case 4: return t.step4_message;
      case 5: return t.step5_message;
      case 6: return t.step6_message;
      case 7: return t.step7_message;
      default: return '';
    }
  };

  // Toggle read-aloud playback for the current step's question
  const handleToggleStepSpeech = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      setActiveWordIndex(null);
      setHighlightMode('word');
      return;
    }
    const textToSpeak = getCurrentStepSpeechText();
    if (!textToSpeak.trim()) return;
    setIsSpeaking(true);
    setHighlightMode('word');
    speakText({
      text: textToSpeak,
      language,
      onEnd: () => {
        setIsSpeaking(false);
        setActiveWordIndex(null);
      },
      onError: () => {
        setIsSpeaking(false);
        setActiveWordIndex(null);
      },
      onWord: (info) => {
        setActiveWordIndex(info.wordIndex >= 0 ? info.wordIndex : null);
      },
      onDegradeToParagraph: () => {
        setHighlightMode('paragraph');
      },
    });
  };

  // Stop any ongoing read-aloud playback when the step changes or component unmounts
  useEffect(() => {
    stopSpeaking();
    setIsSpeaking(false);
    setActiveWordIndex(null);
    setHighlightMode('word');
    return () => {
      stopSpeaking();
    };
  }, [step]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8">
      {/* Two-Column 30/70 Sidebar Layout (always visible, no mobile collapse) */}
      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[260px_minmax(0,1fr)_300px] gap-6 sm:gap-8 items-start">
        {/* Left Column (always visible, sticky) */}
        <aside className="block w-full sticky top-20 self-start">
          <div className="bg-white rounded-2xl border border-[#004D40]/15 shadow-xs p-5 sm:p-6 space-y-5">
            {/* Brand Logo & Wordmark */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#004D40]/10">
              <div className="w-28 h-28 rounded-xl overflow-hidden bg-white border border-[#004D40]/10 p-2 shadow-2xs shrink-0">
                <img
                  src="https://raw.githubusercontent.com/mradvitiyalive-maker/images/main/sd.png"
                  alt="YojanaMatch logo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#004D40] tracking-tight leading-tight">
                  YojanaMatch
                </h2>
                <p className="text-[11px] text-[#004D40]/65 font-medium">
                  {language === 'hi' ? 'ऑनबोर्डिंग प्रोफाइलिंग' : 'Profile Onboarding'}
                </p>
              </div>
            </div>

            {/* Persistent Step Progress Indicator */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#004D40] mb-2">
                <span>{language === 'hi' ? `चरण ${step} / 7` : `Step ${step} of 7`}</span>
                <span className="text-[#FF6B35]">{Math.round((step / 7) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-[#004D40]/10 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-[#FF6B35] transition-all duration-300 rounded-full"
                  style={{ width: `${(step / 7) * 100}%` }}
                />
              </div>

              {/* Step Items List */}
              <div className="space-y-2">
                {stepTitles.map((s) => {
                  const isDone = s.num < step;
                  const isCurrent = s.num === step;
                  return (
                    <div
                      key={s.num}
                      className={`p-2 rounded-xl flex items-center gap-2.5 transition-colors text-xs ${
                        isCurrent
                          ? 'bg-[#004D40]/5 border border-[#004D40]/15 font-bold text-[#004D40]'
                          : isDone
                          ? 'text-[#004D40]/80 font-medium'
                          : 'text-[#004D40]/40'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCurrent
                            ? 'bg-[#FF6B35] text-white'
                            : 'bg-[#004D40]/10 text-[#004D40]/50'
                        }`}
                      >
                        {isDone ? <Check className="w-3 h-3" /> : s.num}
                      </div>
                      <div className="truncate">
                        <div className="leading-tight truncate">{s.title}</div>
                        <div className="text-[10px] opacity-70 truncate">{s.subtitle}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom hint */}
            <div className="pt-3 border-t border-[#004D40]/10 text-[11px] text-[#004D40]/60 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>{language === 'hi' ? 'डेटा डिवाइस में सुरक्षित है' : 'Data safely stored on your device'}</span>
            </div>
          </div>
        </aside>

        {/* Right Column (70% width): Interactive Content */}
        <div className="w-full">
          {/* Main Step Container */}
          <div className="bg-white border border-[#004D40]/15 rounded-2xl shadow-xs p-6 sm:p-8 relative">
            {/* Read-aloud toggle for the current step's question */}
            <button
              type="button"
              onClick={handleToggleStepSpeech}
              className={`absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 rounded-full border cursor-pointer z-10 ${
                isSpeaking
                  ? 'bg-[#FF6B35]/10 border-[#FF6B35] text-[#FF6B35] animate-pulse'
                  : 'bg-white border-[#004D40]/20 text-[#004D40]/60 hover:bg-[#004D40]/5'
              }`}
              title={isSpeaking ? (language === 'hi' ? 'रोकें' : 'Stop reading') : (language === 'hi' ? 'सुनें' : 'Read aloud')}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {/* ================= STEP 1: WELCOME ================= */}
            {step === 1 && (
              <div className="text-center py-4 sm:py-6">
                <div className="w-32 h-32 rounded-2xl overflow-hidden bg-white border border-[#004D40]/10 p-2 shadow-xs mx-auto mb-5">
                  <img
                    src="https://raw.githubusercontent.com/mradvitiyalive-maker/images/main/sd.png"
                    alt="YojanaMatch logo"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#004D40] tracking-tight">
                  {t.step1_heading}
                </h2>
                <KaraokeExplanation
                  text={t.step1_message}
                  isPlaying={isSpeaking}
                  activeWordIndex={activeWordIndex}
                  highlightMode={highlightMode}
                  language={language}
                  className="mt-3 text-base max-w-xl mx-auto leading-relaxed text-center"
                />

                <div className="mt-8 pt-4 flex justify-center">
                  <button
                    onClick={() => persistStep(2)}
                    className="touch-target px-8 py-3.5 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-base flex items-center gap-2.5 shadow-sm transition-transform hover:scale-102 active:scale-98 cursor-pointer"
                  >
                    <span>{t.btn_get_started}</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

        {/* ================= STEP 2: BASIC IDENTITY ================= */}
        {step === 2 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#004D40]">
              {t.step2_heading}
            </h2>
            <KaraokeExplanation
              text={t.step2_message}
              isPlaying={isSpeaking}
              activeWordIndex={activeWordIndex}
              highlightMode={highlightMode}
              language={language}
              className="mt-1 mb-6"
            />

            <div className="space-y-6">
              {/* Optional Name Confirmation */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-2">
                  {t.label_name}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={user?.name || "Enter name"}
                    className="w-full px-4 py-3 rounded-xl border border-[#004D40]/20 bg-white text-sm sm:text-base text-gray-900 focus:outline-none focus:border-[#004D40]"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVoiceInput('name')}
                    className={`absolute right-2.5 top-2.5 p-2 rounded-lg cursor-pointer ${
                      isVoiceActive ? 'bg-red-100 text-red-600 animate-pulse' : 'text-[#004D40]/50 hover:bg-[#004D40]/5'
                    }`}
                    title={t.voice_tap_to_speak}
                  >
                    {isVoiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Age Range Tappable Buttons */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-2.5">
                  {t.label_age}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['18-25', '26-35', '36-45', '46+'].map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setAgeRange(range)}
                      className={`touch-target py-3 px-4 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                        ageRange === range
                          ? 'border-[#004D40] bg-[#004D40] text-white shadow-xs'
                          : 'border-[#004D40]/20 bg-white text-[#004D40] hover:bg-[#004D40]/5'
                      }`}
                    >
                      {range} {language === 'hi' ? 'वर्ष' : 'years'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender Buttons */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-2.5">
                  {t.label_gender}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { val: 'female' as Gender, label: t.gender_female },
                    { val: 'male' as Gender, label: t.gender_male },
                    { val: 'transgender' as Gender, label: t.gender_transgender },
                    { val: 'any' as Gender, label: t.gender_any },
                  ].map((g) => (
                    <button
                      key={g.val}
                      type="button"
                      onClick={() => setGender(g.val)}
                      className={`touch-target py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                        gender === g.val
                          ? 'border-[#004D40] bg-[#004D40] text-white shadow-xs'
                          : 'border-[#004D40]/20 bg-white text-[#004D40] hover:bg-[#004D40]/5'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="mt-8 pt-5 border-t border-[#004D40]/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#004D40]/70 hover:text-[#004D40] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => persistStep(3)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#004D40]/60 hover:text-[#004D40] cursor-pointer"
                >
                  {t.btn_skip}
                </button>
                <button
                  type="button"
                  onClick={() => persistStep(3)}
                  className="touch-target px-6 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-sm flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>{t.btn_next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: CATEGORY ================= */}
        {step === 3 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#004D40]">
              {t.step3_heading}
            </h2>
            <KaraokeExplanation
              text={t.step3_message}
              isPlaying={isSpeaking}
              activeWordIndex={activeWordIndex}
              highlightMode={highlightMode}
              language={language}
              className="mt-1 mb-6"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { val: 'SC', label: t.cat_sc },
                { val: 'ST', label: t.cat_st },
                { val: 'OBC', label: t.cat_obc },
                { val: 'Minority', label: t.cat_minority },
                { val: 'General', label: t.cat_general },
                { val: 'Woman', label: t.cat_woman },
                { val: 'Person with Disability', label: t.cat_pwd },
                { val: 'Prefer not to say', label: t.cat_prefer_not },
              ].map((item) => {
                const isSelected = categories.includes(item.val);
                return (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => handleToggleCategory(item.val)}
                    className={`touch-target p-4 rounded-xl text-left border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#004D40] bg-[#004D40]/5 ring-1 ring-[#004D40]'
                        : 'border-[#004D40]/20 hover:border-[#004D40]/40 bg-white'
                    }`}
                  >
                    <span className={`text-sm font-semibold ${isSelected ? 'text-[#004D40]' : 'text-gray-800'}`}>
                      {item.label}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected
                          ? 'bg-[#004D40] border-[#004D40] text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Navigation Actions */}
            <div className="mt-8 pt-5 border-t border-[#004D40]/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#004D40]/70 hover:text-[#004D40] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => persistStep(4)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#004D40]/60 hover:text-[#004D40] cursor-pointer"
                >
                  {t.btn_skip}
                </button>
                <button
                  type="button"
                  onClick={() => persistStep(4)}
                  className="touch-target px-6 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-sm flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>{t.btn_next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: LOCATION ================= */}
        {step === 4 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#004D40]">
              {t.step4_heading}
            </h2>
            <KaraokeExplanation
              text={t.step4_message}
              isPlaying={isSpeaking}
              activeWordIndex={activeWordIndex}
              highlightMode={highlightMode}
              language={language}
              className="mt-1 mb-6"
            />

            <div className="space-y-6">
              {/* GPS Geolocation Button */}
              <div className="p-3.5 rounded-xl bg-[#004D40]/5 border border-[#004D40]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#004D40] font-medium">
                  <Navigation className="w-4 h-4 text-[#FF6B35] shrink-0" />
                  <span>{gpsMessage || "Auto-detect state using GPS location"}</span>
                </div>
                <button
                  type="button"
                  onClick={handleUseGps}
                  disabled={isLocating}
                  className="touch-target px-3.5 py-1.5 rounded-lg bg-white border border-[#004D40]/20 text-xs font-bold text-[#004D40] hover:bg-[#004D40]/5 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B35]" />
                  <span>{isLocating ? "Locating..." : t.btn_use_gps}</span>
                </button>
              </div>

              {/* State Selection Dropdown */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-2">
                  {t.label_state}
                </label>
                <div className="relative">
                  <select
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-[#004D40]/20 bg-white text-sm sm:text-base text-gray-900 focus:outline-none focus:border-[#004D40]"
                  >
                    <option value="">{t.select_state}</option>
                    {INDIAN_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => toggleVoiceInput('state')}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg cursor-pointer ${
                      isVoiceActive ? 'bg-red-100 text-red-600 animate-pulse' : 'text-[#004D40]/50 hover:bg-[#004D40]/5'
                    }`}
                    title={t.voice_tap_to_speak}
                  >
                    {isVoiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* District / Area Type Buttons */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-2.5">
                  {t.label_district_type}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { val: 'rural' as DistrictType, label: t.area_rural },
                    { val: 'semi-urban' as DistrictType, label: t.area_semi_urban },
                    { val: 'urban' as DistrictType, label: t.area_urban },
                  ].map((area) => (
                    <button
                      key={area.val}
                      type="button"
                      onClick={() => setDistrictType(area.val)}
                      className={`touch-target py-3 px-4 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                        districtType === area.val
                          ? 'border-[#004D40] bg-[#004D40] text-white shadow-xs'
                          : 'border-[#004D40]/20 bg-white text-[#004D40] hover:bg-[#004D40]/5'
                      }`}
                    >
                      {area.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="mt-8 pt-5 border-t border-[#004D40]/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#004D40]/70 hover:text-[#004D40] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => persistStep(5)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#004D40]/60 hover:text-[#004D40] cursor-pointer"
                >
                  {t.btn_skip}
                </button>
                <button
                  type="button"
                  onClick={() => persistStep(5)}
                  className="touch-target px-6 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-sm flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>{t.btn_next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 5: BUSINESS SITUATION ================= */}
        {step === 5 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#004D40]">
              {t.step5_heading}
            </h2>
            <KaraokeExplanation
              text={t.step5_message}
              isPlaying={isSpeaking}
              activeWordIndex={activeWordIndex}
              highlightMode={highlightMode}
              language={language}
              className="mt-1 mb-6"
            />

            <div className="space-y-6">
              {/* Existing vs New Business Tappable Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { val: 'existing' as const, label: t.biz_has_existing, icon: Briefcase },
                  { val: 'new' as const, label: t.biz_wants_new, icon: TrendingUp },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setBizSituation(item.val)}
                    className={`touch-target p-4 rounded-xl text-left border flex items-center gap-3 transition-all cursor-pointer ${
                      bizSituation === item.val
                        ? 'border-[#004D40] bg-[#004D40]/5 ring-1 ring-[#004D40]'
                        : 'border-[#004D40]/20 bg-white hover:border-[#004D40]/40'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        bizSituation === item.val
                          ? 'bg-[#004D40] text-white'
                          : 'bg-[#004D40]/10 text-[#004D40]'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-gray-900">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Business Type Dropdown */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-2">
                  {t.label_biz_type}
                </label>
                <select
                  value={bizType || ''}
                  onChange={(e) => setBizType((e.target.value || undefined) as BusinessType)}
                  className="w-full px-4 py-3 rounded-xl border border-[#004D40]/20 bg-white text-sm sm:text-base text-gray-900 focus:outline-none focus:border-[#004D40]"
                >
                  <option value="">Select your business sector</option>
                  <option value="textile_weaving">{t.biz_type_tailoring}</option>
                  <option value="dairy_livestock">{t.biz_type_farming}</option>
                  <option value="retail_shop">{t.biz_type_retail}</option>
                  <option value="food_processing">{t.biz_type_food}</option>
                  <option value="street_vendor">{t.biz_type_vendor}</option>
                  <option value="artisan_handicraft">{t.biz_type_artisan}</option>
                  <option value="services">{t.biz_type_services}</option>
                  <option value="manufacturing">{t.biz_type_manufacturing}</option>
                  <option value="any">{t.biz_type_other}</option>
                </select>
              </div>

              {/* If "other" or custom text */}
              <div>
                <label className="block text-xs font-semibold text-[#004D40]/80 mb-1.5">
                  Specific venture details or idea (optional):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customBizType}
                    onChange={(e) => setCustomBizType(e.target.value)}
                    placeholder="e.g. Papad making unit, electric repair stall, bangle craft"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#004D40]/20 bg-white text-sm text-gray-900 focus:outline-none focus:border-[#004D40]"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVoiceInput('biz')}
                    className={`absolute right-2 top-2 p-1.5 rounded-lg cursor-pointer ${
                      isVoiceActive ? 'bg-red-100 text-red-600 animate-pulse' : 'text-[#004D40]/50 hover:bg-[#004D40]/5'
                    }`}
                    title={t.voice_tap_to_speak}
                  >
                    {isVoiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* If "already have a business", show business age */}
              {bizSituation === 'existing' && (
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-2.5">
                    {t.label_biz_age}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { val: '0-1' as const, label: t.biz_age_0_1 },
                      { val: '1-3' as const, label: t.biz_age_1_3 },
                      { val: '3+' as const, label: t.biz_age_3_plus },
                    ].map((ageItem) => (
                      <button
                        key={ageItem.val}
                        type="button"
                        onClick={() => setBizAge(ageItem.val)}
                        className={`touch-target py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                          bizAge === ageItem.val
                            ? 'border-[#004D40] bg-[#004D40] text-white shadow-xs'
                            : 'border-[#004D40]/20 bg-white text-[#004D40] hover:bg-[#004D40]/5'
                        }`}
                      >
                        {ageItem.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Actions */}
            <div className="mt-8 pt-5 border-t border-[#004D40]/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#004D40]/70 hover:text-[#004D40] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => persistStep(6)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#004D40]/60 hover:text-[#004D40] cursor-pointer"
                >
                  {t.btn_skip}
                </button>
                <button
                  type="button"
                  onClick={() => persistStep(6)}
                  className="touch-target px-6 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-sm flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>{t.btn_next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 6: INCOME RANGE ================= */}
        {step === 6 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#004D40]">
              {t.step6_heading}
            </h2>
            <KaraokeExplanation
              text={t.step6_message}
              isPlaying={isSpeaking}
              activeWordIndex={activeWordIndex}
              highlightMode={highlightMode}
              language={language}
              className="mt-1 mb-6"
            />

            <div className="space-y-3">
              {[
                t.income_below_1l,
                t.income_1_3l,
                t.income_3_6l,
                t.income_above_6l,
                t.income_prefer_not,
              ].map((range) => {
                const isSelected = incomeRange === range;
                return (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setIncomeRange(range)}
                    className={`touch-target w-full p-4 rounded-xl text-left border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#004D40] bg-[#004D40]/5 ring-1 ring-[#004D40]'
                        : 'border-[#004D40]/20 hover:border-[#004D40]/40 bg-white'
                    }`}
                  >
                    <span className={`text-sm font-bold ${isSelected ? 'text-[#004D40]' : 'text-gray-900'}`}>
                      {range}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-[#004D40] bg-[#004D40] text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Navigation Actions */}
            <div className="mt-8 pt-5 border-t border-[#004D40]/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#004D40]/70 hover:text-[#004D40] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => persistStep(7)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#004D40]/60 hover:text-[#004D40] cursor-pointer"
                >
                  {t.btn_skip}
                </button>
                <button
                  type="button"
                  onClick={() => persistStep(7)}
                  className="touch-target px-6 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-sm flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>{t.btn_next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 7: CONFIRMATION & IMMEDIATE PAYOFF ================= */}
        {step === 7 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Profile Verified
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#004D40]">
              {t.step7_heading}
            </h2>
            <KaraokeExplanation
              text={t.step7_message}
              isPlaying={isSpeaking}
              activeWordIndex={activeWordIndex}
              highlightMode={highlightMode}
              language={language}
              className="mt-1 mb-6"
            />

            {/* Summary Card with per-field Edit links */}
            <div className="bg-[#004D40]/5 border border-[#004D40]/15 rounded-xl p-4 sm:p-5 mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="flex items-center justify-between pb-2 border-b border-[#004D40]/10">
                  <span className="text-[#004D40]/60 font-medium">{t.summary_name}:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#004D40]">{name || user?.name}</span>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-[#FF6B35] hover:underline flex items-center gap-0.5 text-xs font-bold cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{t.btn_edit}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#004D40]/10">
                  <span className="text-[#004D40]/60 font-medium">{t.summary_phone}:</span>
                  <span className="font-bold text-[#004D40]">+91 {user?.phone_number}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#004D40]/10">
                  <span className="text-[#004D40]/60 font-medium">{t.summary_age}:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#004D40]">{ageRange || 'Not specified'}</span>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-[#FF6B35] hover:underline flex items-center gap-0.5 text-xs font-bold cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{t.btn_edit}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#004D40]/10">
                  <span className="text-[#004D40]/60 font-medium">{t.summary_category}:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#004D40]">
                      {categories.length > 0 ? categories.join(', ') : 'All categories'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-[#FF6B35] hover:underline flex items-center gap-0.5 text-xs font-bold cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{t.btn_edit}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#004D40]/10">
                  <span className="text-[#004D40]/60 font-medium">{t.summary_location}:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#004D40]">
                      {stateName || 'All India'} {districtType ? `(${districtType})` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="text-[#FF6B35] hover:underline flex items-center gap-0.5 text-xs font-bold cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{t.btn_edit}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#004D40]/10">
                  <span className="text-[#004D40]/60 font-medium">{t.summary_business}:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#004D40]">
                      {bizType ? bizType.replace('_', ' ') : 'General'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="text-[#FF6B35] hover:underline flex items-center gap-0.5 text-xs font-bold cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{t.btn_edit}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#004D40]/10 sm:col-span-2">
                  <span className="text-[#004D40]/60 font-medium">{t.summary_income}:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#004D40]">{incomeRange || 'Not disclosed'}</span>
                    <button
                      type="button"
                      onClick={() => setStep(6)}
                      className="text-[#FF6B35] hover:underline flex items-center gap-0.5 text-xs font-bold cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{t.btn_edit}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Payoff Moment: Matched Schemes Preview */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-[#004D40] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#FF6B35]" />
                  <span>{t.matched_now_title}</span>
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35]">
                  Instant Calculation
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 mb-8">
                {instantMatches.map((res) => {
                  const cappedScore = Math.min(90, res.match_score);
                  const tierBadge =
                    cappedScore >= 80
                      ? 'bg-emerald-100 text-emerald-800'
                      : cappedScore >= 65
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-teal-100 text-teal-800';

                  return (
                    <div
                      key={res.scheme.id}
                      className="p-4 rounded-xl border border-[#004D40]/15 bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#004D40]/30 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tierBadge}`}>
                            {cappedScore}% {t.card_match_score}
                          </span>
                          {res.scheme.benefits.collateral_free && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              {t.card_collateral_free}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-gray-900">
                          {language === 'hi' ? res.scheme.hindi_name : res.scheme.name}
                        </h4>
                        <p className="text-xs text-[#FF6B35] font-semibold mt-1">
                          {language === 'hi' ? res.scheme.hindi_benefit_headline : res.scheme.benefit_headline}
                        </p>
                      </div>

                      <a
                        href={res.scheme.official_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="touch-target px-3 py-2 rounded-lg bg-[#004D40]/5 hover:bg-[#004D40]/10 text-xs font-bold text-[#004D40] flex items-center gap-1.5 shrink-0 self-start sm:self-center"
                      >
                        <span>Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Go to Homepage Button */}
            <div className="pt-5 border-t border-[#004D40]/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep(6)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#004D40]/70 hover:text-[#004D40] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleCompleteOnboarding}
                className="touch-target w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-sm transition-transform hover:scale-102 active:scale-98 cursor-pointer"
              >
                <span>{t.btn_go_home}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
          </div>
        </div>

        {/* Right Column: Live Match Preview Sidebar */}
        <aside className="w-full sticky top-20 self-start">
          <div className="bg-white rounded-2xl border border-[#004D40]/15 shadow-xs p-5 sm:p-6 space-y-0">
            {/* Top Match So Far (blurred detail until Step 6) */}
            {step >= 2 && liveMatches.length > 0 && (
              <div className="pt-3 border-t border-[#004D40]/10">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#004D40] mb-1.5">
                  <Trophy className="w-3.5 h-3.5 text-[#FF6B35]" />
                  <span>{language === 'hi' ? 'शीर्ष योजना अभी' : 'Top Match So Far'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#FF6B35]/5 border border-[#FF6B35]/15">
                  <p className="text-xs font-bold text-[#004D40] line-clamp-1">
                    {language === 'hi' ? liveMatches[0].scheme.hindi_name : liveMatches[0].scheme.name}
                  </p>
                  <p className={`text-[11px] font-semibold mt-0.5 ${step >= 6 ? 'text-[#FF6B35]' : 'text-[#004D40]/40 blur-[3px] select-none'}`}>
                    {language === 'hi' ? liveMatches[0].scheme.hindi_benefit_headline : liveMatches[0].scheme.benefit_headline}
                  </p>
                  {step < 6 && (
                    <p className="text-[9px] text-[#004D40]/50 mt-1">
                      {language === 'hi' ? 'विवरण के लिए जारी रखें' : 'Continue to reveal details'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Category-specific icons, live as soon as categories are picked */}
            {step >= 3 && categories.length > 0 && !categories.includes('Prefer not to say') && (
              <div className="pt-3 border-t border-[#004D40]/10">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#004D40] mb-2">
                  <Tags className="w-3.5 h-3.5 text-[#FF6B35]" />
                  <span>{language === 'hi' ? 'प्रासंगिक श्रेणियां' : 'Relevant Categories'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const CatIcon = catIconMap[cat] || User;
                    return (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#004D40]/5 text-[10px] font-semibold text-[#004D40]"
                      >
                        <CatIcon className="w-3 h-3" />
                        <span>{cat}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* State-specific live fact */}
            {step >= 4 && stateName && (
              <div className="pt-3 border-t border-[#004D40]/10">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#004D40] mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B35]" />
                  <span>{stateName}</span>
                </div>
                <p className="text-[11px] text-[#004D40]/70">
                  {language === 'hi'
                    ? `${stateName} में ${stateSchemeCount} सक्रिय योजनाएं उपलब्ध हैं`
                    : `${stateSchemeCount} active schemes available in ${stateName}`}
                </p>
              </div>
            )}

            {/* Comparative encouragement nudge */}
            {step >= 3 && filledSignalsCount >= 2 && liveMatches.length > 0 && (
              <div className="pt-3 border-t border-[#004D40]/10">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'बढ़िया प्रगति' : 'Great progress'}</span>
                </div>
                <p className="text-[11px] text-[#004D40]/70">
                  {language === 'hi'
                    ? 'आप पहले से ही अधिकांश नए आवेदकों की तुलना में अधिक योजनाओं के लिए योग्य हैं'
                    : 'You already qualify for more schemes than most first-time applicants'}
                </p>
              </div>
            )}

            {/* Business-type mini illustration */}
            {step >= 5 && bizType && (
              <div className="pt-3 border-t border-[#004D40]/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#004D40]/5 flex items-center justify-center shrink-0 text-[#FF6B35]">
                    {React.createElement(bizIconMap[bizType] || Briefcase, { className: 'w-5 h-5' })}
                  </div>
                  <p className="text-[11px] text-[#004D40]/70">
                    {language === 'hi' ? 'आपका व्यवसाय क्षेत्र चुना गया' : 'Business sector selected'}
                  </p>
                </div>
              </div>
            )}

            {/* Income to potential benefit ceiling preview */}
            {step >= 6 && incomeRange && liveMatches.length > 0 && (
              <div className="pt-3 border-t border-[#004D40]/10">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#004D40] mb-1.5">
                  <Wallet className="w-3.5 h-3.5 text-[#FF6B35]" />
                  <span>{language === 'hi' ? 'संभावित लाभ' : 'Potential Benefit'}</span>
                </div>
                <p className="text-[11px] text-[#004D40]/70">
                  {language === 'hi'
                    ? `इस आय स्तर पर, आप ${liveMatches[0].scheme.benefits.hindi_max_loan_or_grant} तक के लाभ के लिए योग्य हो सकते हैं`
                    : `At this income level, you could qualify for up to ${liveMatches[0].scheme.benefits.max_loan_or_grant}`}
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
