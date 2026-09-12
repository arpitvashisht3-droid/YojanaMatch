import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Search,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Columns,
  Rows,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import { startSpeechRecognition, stopSpeechRecognition, isSpeechRecognitionSupported } from '../lib/speechService';
import {
  NewThisMonthSidebar,
  PopularInStateSidebar,
  TrendingSchemesSidebar,
  BrowseByCategorySection,
  ClassicStackedRecommendations,
} from './RecommendationsCorner';
import { DidYouKnowBanner } from './DidYouKnowBanner';

export const LandingScreen: React.FC = () => {
  const {
    language,
    contentMode,
    inputText,
    setInputText,
    startDiscovery,
    isListening,
    setIsListening,
    isLoading,
    recommendationsLayout,
    setRecommendationsLayout,
  } = useAppStore();
  const t = translations[language];

  const [voiceAvailable, setVoiceAvailable] = useState<boolean>(true);
  const stopRecordingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setVoiceAvailable(isSpeechRecognitionSupported());
  }, []);

  const handleToggleVoice = () => {
    if (isListening) {
      if (stopRecordingRef.current) {
        stopRecordingRef.current();
      }
      stopSpeechRecognition();
      setIsListening(false);
    } else {
      setIsListening(true);
      const stopFn = startSpeechRecognition(
        language,
        (transcript, _isFinal) => {
          setInputText(transcript);
        },
        () => {
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        }
      );
      stopRecordingRef.current = stopFn;
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) {
      stopSpeechRecognition();
      setIsListening(false);
    }
    if (inputText.trim()) {
      startDiscovery();
    } else {
      const sample = activeSamples[0];
      if (sample) {
        setInputText(sample);
        startDiscovery(sample);
      }
    }
  };

  const handleSampleClick = (sampleText: string) => {
    setInputText(sampleText);
    startDiscovery(sampleText);
  };

  const isScholarship = contentMode === 'scholarships';

  // Dynamic sample queries based on contentMode
  const activeSamples = isScholarship ? t.scholarship_samples : t.samples;
  const activePlaceholder = isScholarship ? t.scholarship_input_placeholder : t.input_placeholder;
  const activeSubmitBtn = isScholarship ? t.scholarship_btn_find : t.find_schemes_btn;
  const activeHeroSubtitle = isScholarship ? t.scholarship_mode_subtitle : t.hero_subtitle;

  // Reusable Primary Search Box Card (strictly unmodified in style, form, mic, and CTA)
  const renderSearchBoxCard = () => (
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border-2 border-[#004D40]/10 transition-all focus-within:border-[#FF6B35] focus-within:shadow-md">
      <form onSubmit={handleFormSubmit} className="space-y-5">
        <label htmlFor="situation-input" className="block text-sm font-bold text-[#004D40]">
          {isScholarship
            ? (language === 'hi' ? 'अपनी शिक्षा, कक्षा, अंक और छात्रवृत्ति आवश्यकता बताएं:' : 'Describe your class, course, marks or scholarship need:')
            : (language === 'hi' ? 'अपनी स्थिति और व्यवसाय के बारे में बताएं:' : 'Describe your business or livelihood situation:')}
        </label>

        <div className="relative">
          <textarea
            id="situation-input"
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={activePlaceholder}
            className="w-full text-base sm:text-lg p-4 rounded-xl border border-[#004D40]/15 focus:border-[#FF6B35] focus:ring-0 text-[#004D40] placeholder:text-[#004D40]/40 resize-none bg-[#FAFAF7]/50 font-normal transition-colors"
          />

          {/* Microphone Button */}
          {voiceAvailable && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#004D40]/10">
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`touch-target flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-sm'
                    : 'bg-[#004D40]/5 text-[#004D40] hover:bg-[#FF6B35] hover:text-white'
                }`}
                aria-label={isListening ? t.mic_stop : t.mic_start}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>{t.mic_listening}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>{t.mic_start}</span>
                  </>
                )}
              </button>

              <span className="text-xs text-[#004D40]/60 font-medium">
                {isListening ? (language === 'hi' ? 'बोलते रहें...' : 'Transcribing live...') : (language === 'hi' ? 'आवाज से लिखें' : 'Voice input ready')}
              </span>
            </div>
          )}
        </div>

        {/* Submit CTA Button */}
        <button
          id="find-schemes-submit-btn"
          type="submit"
          disabled={isLoading}
          className={`touch-target w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-bold text-base sm:text-lg transition-all shadow-md bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white cursor-pointer shadow-orange-500/25 hover:scale-[1.008] active:scale-[0.99] ${
            isLoading ? 'opacity-70 cursor-wait' : ''
          }`}
        >
          <Search className="w-5 h-5 text-white" />
          <span className="text-white font-bold">{activeSubmitBtn}</span>
          <ArrowRight className="w-5 h-5 ml-1 text-white" />
        </button>
      </form>

      {/* Quick Sample Queries */}
      <div className="mt-8 pt-6 border-t border-[#004D40]/10">
        <p className="text-xs font-bold text-[#004D40]/60 uppercase tracking-wider mb-3">
          {t.sample_queries_title}
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
          {activeSamples.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSampleClick(sample)}
              className="text-left text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-[#FAFAF7] hover:bg-[#FFF5F0] hover:text-[#FF6B35] hover:border-[#FF6B35]/40 text-[#004D40]/80 border border-[#004D40]/10 font-medium transition-all shadow-2xs cursor-pointer line-clamp-2"
            >
              "{sample}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Reusable Trust & Privacy Footnote
  const renderTrustFootnote = () => (
    <div className="mt-8 mb-4 flex flex-wrap items-center justify-center gap-6 text-xs text-[#004D40]/70 font-medium">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-[#004D40]" />
        <span>{language === 'hi' ? '100% निशुल्क एवं बिना किसी लॉगिन' : '100% Free & No Login Required'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-[#004D40]" />
        <span>{language === 'hi' ? 'कोई व्यक्तिगत डेटा संग्रहीत नहीं होता' : 'No Personal Data Stored'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-[#004D40]" />
        <span>
          {isScholarship
            ? (language === 'hi' ? '12 प्रामाणिक भारतीय छात्रवृत्ति योजनाएं' : '12 Verified Indian Scholarships')
            : (language === 'hi' ? '15 प्रामाणिक भारतीय सरकारी योजनाएं' : '15 Verified Indian Govt Schemes')}
        </span>
      </div>
    </div>
  );

  // Layout mode switcher bar
  const renderLayoutSwitcher = () => (
    <div className="flex items-center justify-between gap-3 mb-5 pb-2 border-b border-[#004D40]/10">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#004D40]/5 border border-[#004D40]/10 text-[#004D40] text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-[#FF6B35]" />
          <span>
            {isScholarship
              ? (language === 'hi' ? 'स्मार्ट छात्रवृत्ति खोज' : 'Smart Scholarship Discovery')
              : (language === 'hi' ? 'स्मार्ट योजना खोज' : 'Smart Scheme Discovery')}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[#004D40]/60 hidden sm:inline">
          {t.layout_switcher_title}:
        </span>
        <div className="flex bg-[#004D40]/5 rounded-xl p-0.5 border border-[#004D40]/10" title={t.layout_compare_hint}>
          <button
            type="button"
            onClick={() => setRecommendationsLayout('3column')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              recommendationsLayout === '3column'
                ? 'bg-white shadow-2xs text-[#004D40]'
                : 'text-[#004D40]/60 hover:text-[#004D40]'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{t.layout_variant_3col}</span>
          </button>
          <button
            type="button"
            onClick={() => setRecommendationsLayout('stacked')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              recommendationsLayout === 'stacked'
                ? 'bg-white shadow-2xs text-[#004D40]'
                : 'text-[#004D40]/60 hover:text-[#004D40]'
            }`}
          >
            <Rows className="w-3.5 h-3.5" />
            <span>{t.layout_variant_stacked}</span>
          </button>
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // 1. THREE-COLUMN SIDEBAR GRID LAYOUT (NEW PRIMARY REQUIREMENT)
  // Structure: Left Sidebar (New this month) / Center (Did you know + Search) / Right Sidebar (Popular + Trending)
  // All start at top position and run side-by-side.
  // Mobile (<900px): Collapses to single column (Did you know -> Search -> Popular -> Trending -> New this month)
  // =========================================================================
  if (recommendationsLayout === '3column') {
    return (
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-5">
        {/* 3-Column CSS Grid on >=900px, 1-Column on <900px */}
        <div className="grid grid-cols-1 min-[900px]:grid-cols-[280px_minmax(0,1fr)_320px] gap-6 items-start">
          {/* LEFT SIDEBAR COLUMN: "New this month" auto-fits content */}
          <aside className="order-3 min-[900px]:order-1 min-[900px]:col-start-1 h-fit self-start">
            <NewThisMonthSidebar />
          </aside>

          {/* CENTER COLUMN: Hero + "Did you know?" banner at top + Primary Search Box */}
          <div className="order-1 min-[900px]:order-2 min-[900px]:col-start-2 space-y-4">
            {/* Hero Title */}
            <div className="text-center mb-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#004D40] tracking-tight leading-tight mb-2">
                {isScholarship ? (
                  language === 'hi' ? (
                    <>
                      अपनी पढ़ाई बताएं, पाएं <span className="text-[#FF6B35]">सटीक छात्रवृत्तियां</span>
                    </>
                  ) : (
                    <>
                      Find scholarships <span className="text-[#FF6B35]">you're eligible for</span>
                    </>
                  )
                ) : language === 'hi' ? (
                  <>
                    अपनी स्थिति बताएं, पाएं <span className="text-[#FF6B35]">सटीक सरकारी योजनाएं</span>
                  </>
                ) : (
                  <>
                    Find government schemes <span className="text-[#FF6B35]">you're eligible for</span>
                  </>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-[#004D40]/75 max-w-xl mx-auto">
                {activeHeroSubtitle}
              </p>
            </div>

            {/* "Did you know?" rotating banner sits at the TOP of this center column only */}
            <DidYouKnowBanner />

            {/* Primary Search Box */}
            {renderSearchBoxCard()}
          </div>

          {/* RIGHT SIDEBAR COLUMN: "Popular in your state" stacked directly above "Trending schemes" */}
          <aside className="order-2 min-[900px]:order-3 min-[900px]:col-start-3 space-y-4 h-fit self-start">
            <PopularInStateSidebar />
            <TrendingSchemesSidebar />
          </aside>

          {/* FULL WIDTH UNDERNEATH: "Browse by category" (untouched in styling and functionality) */}
          <div className="order-4 min-[900px]:order-4 min-[900px]:col-span-3 mt-4">
            <BrowseByCategorySection />
          </div>

          {/* TRUST FOOTNOTE */}
          <div className="order-5 min-[900px]:order-5 min-[900px]:col-span-3">
            {renderTrustFootnote()}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. RECOVERABLE CLASSIC STACKED LAYOUT (PREVIOUS IMPLEMENTATION)
  // Preserved for comparison and reversibility as explicitly requested.
  // =========================================================================
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Hero Header */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#004D40]/5 border border-[#004D40]/10 text-[#004D40] text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5 text-[#FF6B35]" />
          <span>
            {isScholarship
              ? (language === 'hi' ? 'छात्रवृत्ति पोर्टल 2025' : 'Scholarship Portal 2025')
              : (language === 'hi' ? 'स्मार्ट इंडिया हैकाथॉन एमवीपी' : 'Smart India Hackathon MVP')}
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#004D40] tracking-tight leading-tight mb-4">
          {isScholarship ? (
            language === 'hi' ? (
              <>
                अपनी पढ़ाई बताएं, पाएं <span className="text-[#FF6B35]">सटीक छात्रवृत्तियां</span>
              </>
            ) : (
              <>
                Find scholarships <span className="text-[#FF6B35]">you're eligible for</span>
              </>
            )
          ) : language === 'hi' ? (
            <>
              अपनी स्थिति बताएं, पाएं <span className="text-[#FF6B35]">सटीक सरकारी योजनाएं</span>
            </>
          ) : (
            <>
              Find government schemes <span className="text-[#FF6B35]">you're eligible for</span>
            </>
          )}
        </h1>
        <p className="text-base sm:text-lg text-[#004D40]/75 max-w-2xl mx-auto leading-relaxed font-normal">
          {activeHeroSubtitle}
        </p>
      </div>

      {/* Search Box Card */}
      {renderSearchBoxCard()}

      {/* Stacked Recommendations below search box */}
      <ClassicStackedRecommendations />

      {/* Trust & Privacy Footnote */}
      {renderTrustFootnote()}
    </div>
  );
};
