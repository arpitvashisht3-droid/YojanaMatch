import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Edit3,
  Building2,
  Coins,
  AlertCircle,
  Bookmark,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import { speakText, stopSpeaking } from '../lib/speechService';
import { KaraokeExplanation } from './KaraokeExplanation';
import { ProfileSummarySidebar } from './ProfileSummarySidebar';
import { MatchedSchemeResult } from '../types';

export const ResultsScreen: React.FC = () => {
  const {
    language,
    contentMode,
    matchedResults,
    expandedCardIds,
    toggleCard,
    modifyAnswers,
    resetAll,
    audioPlayingSchemeId,
    setAudioPlaying,
    toggleBookmark,
    isBookmarked,
  } = useAppStore();
  const t = translations[language];

  const [ttsErrorIds, setTtsErrorIds] = useState<string[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [highlightMode, setHighlightMode] = useState<'word' | 'paragraph'>('word');

  // Audio cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      setAudioPlaying(null);
    };
  }, [setAudioPlaying]);

  const handleToggleAudio = (e: React.MouseEvent, result: MatchedSchemeResult) => {
    e.stopPropagation();
    const schemeId = result.scheme.id;

    if (audioPlayingSchemeId === schemeId) {
      stopSpeaking();
      setAudioPlaying(null);
      setActiveWordIndex(null);
    } else {
      // Auto-expand card if not already expanded so user sees karaoke highlighting
      if (!expandedCardIds.includes(schemeId)) {
        toggleCard(schemeId);
      }

      setAudioPlaying(schemeId);
      setActiveWordIndex(0);
      setHighlightMode('word');

      const textToRead =
        result.ai_explanation ||
        (language === 'hi'
          ? result.scheme.hindi_short_summary
          : result.scheme.short_summary);

      speakText({
        language,
        text: textToRead,
        onStart: () => {
          setAudioPlaying(schemeId);
          setActiveWordIndex(0);
          setHighlightMode('word');
        },
        onEnd: () => {
          setAudioPlaying(null);
          setActiveWordIndex(null);
        },
        onError: () => {
          setTtsErrorIds((prev) => [...prev, schemeId]);
          setAudioPlaying(null);
          setActiveWordIndex(null);
        },
        onWord: (info) => {
          setActiveWordIndex(info.wordIndex >= 0 ? info.wordIndex : null);
        },
        onDegradeToParagraph: () => {
          setHighlightMode('paragraph');
        },
      });
    }
  };

  // 0 Matches Empty State
  if (matchedResults.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-xs border-2 border-[#004D40]/10 space-y-5">
          <div className="w-16 h-16 rounded-full bg-[#FFF5F0] text-[#FF6B35] flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-[#004D40]">
            {t.empty_title}
          </h2>
          <p className="text-base text-[#004D40]/70 max-w-md mx-auto leading-relaxed">
            {t.empty_desc}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={modifyAnswers}
              className="touch-target w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#FF6B35] hover:bg-[#E8551F] text-white font-bold text-base shadow-sm shadow-[#FF6B35]/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>{t.btn_modify_answers}</span>
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="touch-target w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-[#FAFAF7] text-[#004D40] border border-[#004D40]/20 font-bold text-base transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t.btn_new_search}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const countText =
    matchedResults.length === 1
      ? t.results_found_single
      : t.results_found_title.replace('{count}', String(matchedResults.length));

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header & Global Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#004D40]/10 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#004D40]/5 border border-[#004D40]/10 text-[#004D40] text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B35]" />
            <span>{language === 'hi' ? 'सत्यापित पात्रता मिलान' : 'Deterministic Scheme Match'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#004D40] tracking-tight">
            {countText}
          </h1>
          <p className="text-xs sm:text-sm text-[#004D40]/65 mt-1 font-medium">
            {t.results_subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={modifyAnswers}
            className="touch-target px-4 py-2 text-xs sm:text-sm font-bold text-[#004D40] bg-[#004D40]/5 hover:bg-[#004D40]/10 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-[#004D40]/10"
            title="Edit input description"
          >
            <Edit3 className="w-4 h-4" />
            <span>{language === 'hi' ? 'सुधारें' : 'Modify'}</span>
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="touch-target px-4 py-2 text-xs sm:text-sm font-bold text-[#004D40]/80 bg-white hover:bg-[#FAFAF7] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-[#004D40]/20"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{language === 'hi' ? 'नई खोज' : 'New Search'}</span>
          </button>
        </div>
      </div>

      {/* Two-column 30/70 Layout (Desktop/Tablet >= 900px, Single Stack on Mobile) */}
      <div className="grid grid-cols-1 min-[900px]:grid-cols-[30%_1fr] gap-6 items-start">
        {/* Left Column: 30% width Sticky Profile Summary Sidebar */}
        <ProfileSummarySidebar />

        {/* Right Column: 70% width Scheme Cards List */}
        <div className="space-y-4 w-full">
          {matchedResults.map((res, index) => {
            const { scheme, match_score, match_details, ai_explanation } = res;
            const isExpanded = expandedCardIds.includes(scheme.id);
            const isPlayingAudio = audioPlayingSchemeId === scheme.id;
            const isTtsHidden = ttsErrorIds.includes(scheme.id);
            const categoryType: 'scheme' | 'scholarship' = contentMode === 'scholarships' ? 'scholarship' : 'scheme';
            const isSaved = isBookmarked(scheme.id, categoryType);

            // Cap displayed percentage at 90%
            const cappedScore = Math.min(90, match_score);
            const scoreTierBadge =
              cappedScore >= 80
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : cappedScore >= 65
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-teal-50 text-teal-800 border-teal-200';

            const schemeName = language === 'hi' ? scheme.hindi_name : scheme.name;
            const ministryName = language === 'hi' ? scheme.hindi_ministry : scheme.ministry;
            const benefitHeadline =
              language === 'hi' ? scheme.hindi_benefit_headline : scheme.benefit_headline;
            const maxLoan =
              language === 'hi'
                ? scheme.benefits.hindi_max_loan_or_grant
                : scheme.benefits.max_loan_or_grant;
            const benefitPct =
              language === 'hi'
                ? scheme.benefits.hindi_benefit_percentage
                : scheme.benefits.benefit_percentage;

            return (
              <div
                key={scheme.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden relative ${
                  isExpanded
                    ? 'border-[#FF6B35] shadow-md ring-1 ring-[#FF6B35]/20'
                    : 'border-[#004D40]/10 hover:border-[#004D40]/25 shadow-xs hover:shadow-sm'
                }`}
              >
                {/* Top/Left Accent Bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${
                    isExpanded ? 'bg-[#FF6B35]' : index === 0 ? 'bg-[#004D40]' : 'bg-transparent'
                  }`}
                />

                {/* Card Header: Pure Div Container (NO nested button hydration error) */}
                <div className="w-full text-left p-5 sm:p-6 pl-6 sm:pl-7 flex items-start justify-between gap-4">
                  {/* Main Clickable Card Summary */}
                  <button
                    type="button"
                    onClick={() => toggleCard(scheme.id)}
                    className="space-y-2.5 flex-1 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]/50 group"
                    aria-expanded={isExpanded}
                    aria-label={`Toggle details for ${schemeName}`}
                  >
                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#004D40] text-white text-xs font-bold">
                        #{index + 1} {language === 'hi' ? 'प्राथमिकता' : 'Rank'}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-md border text-xs font-bold flex items-center gap-1 ${scoreTierBadge}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {cappedScore}% {language === 'hi' ? 'पात्रता मिलान' : 'Eligibility Match'}
                        </span>
                      </span>
                      {scheme.benefits.collateral_free && (
                        <span className="px-2.5 py-0.5 rounded-md bg-[#004D40]/5 text-[#004D40] border border-[#004D40]/10 text-xs font-semibold">
                          {t.card_collateral_free}
                        </span>
                      )}
                    </div>

                    {/* Scheme Title */}
                    <h2 className="text-lg sm:text-xl font-bold text-[#004D40] leading-snug group-hover:text-[#FF6B35] transition-colors">
                      {schemeName}
                    </h2>

                    {/* Benefit Highlight */}
                    <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#FF6B35]">
                      <Coins className="w-4 h-4 shrink-0" />
                      <span>{benefitHeadline}</span>
                    </div>

                    {/* Ministry */}
                    <div className="flex items-center gap-1.5 text-xs text-[#004D40]/60 font-medium">
                      <Building2 className="w-3.5 h-3.5 shrink-0 text-[#004D40]/40" />
                      <span className="line-clamp-1">{ministryName}</span>
                    </div>
                  </button>

                  {/* Sibling Action Buttons Column (Bookmark, Audio & Chevron - strictly siblings, never nested) */}
                  <div className="flex flex-col items-center gap-3 shrink-0 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(scheme.id, categoryType);
                      }}
                      className={`touch-target p-2.5 rounded-full transition-all cursor-pointer ${
                        isSaved
                          ? 'bg-[#004D40] text-white shadow-sm'
                          : 'bg-[#004D40]/5 hover:bg-[#004D40]/10 text-[#004D40]/60'
                      }`}
                      aria-label={isSaved ? 'Remove from saved' : 'Save this scheme'}
                      title={isSaved ? (language === 'hi' ? 'सहेजा गया' : 'Saved') : (language === 'hi' ? 'सहेजें' : 'Save')}
                    >
                      <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                    </button>
                    {!isTtsHidden && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleAudio(e, res)}
                        className={`touch-target p-2.5 rounded-full transition-all cursor-pointer ${
                          isPlayingAudio
                            ? 'bg-[#FF6B35] text-white animate-pulse shadow-sm'
                            : 'bg-[#004D40]/5 hover:bg-[#FF6B35] text-[#004D40] hover:text-white'
                        }`}
                        aria-label={
                          isPlayingAudio ? t.card_listening_stop : t.card_listen_explanation
                        }
                        title={isPlayingAudio ? t.card_listening_stop : t.card_listen_explanation}
                      >
                        {isPlayingAudio ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleCard(scheme.id)}
                      className="touch-target p-1 rounded-full text-[#004D40]/40 hover:text-[#004D40] cursor-pointer"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[#FF6B35]" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Card Details */}
                {isExpanded && (
                  <div className="px-6 pb-6 sm:px-8 sm:pb-7 pt-3 border-t border-[#004D40]/10 bg-[#FAFAF7]/50 space-y-6">
                    {/* Plain Language Explanation Header */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#FF6B35]" />
                        <span className="text-xs font-bold text-[#004D40] uppercase tracking-wider">
                          {t.card_plain_explanation}
                        </span>
                      </div>
                      {!isTtsHidden && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleAudio(e, res)}
                          className={`touch-target text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                            isPlayingAudio
                              ? 'bg-[#FF6B35] text-white shadow-xs'
                              : 'bg-[#004D40]/5 hover:bg-[#FF6B35] text-[#004D40] hover:text-white'
                          }`}
                        >
                          {isPlayingAudio ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>{t.card_listening_stop}</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>{t.card_listen_explanation}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Word-Level Karaoke Text Highlight Container */}
                    <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#004D40]/10 shadow-2xs">
                      <KaraokeExplanation
                        text={
                          ai_explanation ||
                          (language === 'hi'
                            ? scheme.hindi_short_summary
                            : scheme.short_summary)
                        }
                        isPlaying={isPlayingAudio}
                        activeWordIndex={isPlayingAudio ? activeWordIndex : null}
                        highlightMode={highlightMode}
                        language={language}
                      />
                    </div>

                    {/* Key Benefits Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-white p-4 rounded-xl border border-[#004D40]/10 shadow-2xs">
                        <span className="text-xs font-medium text-[#004D40]/60 block">
                          {language === 'hi' ? 'अधिकतम ऋण / अनुदान' : 'Max Loan / Grant'}
                        </span>
                        <span className="text-sm sm:text-base font-bold text-[#004D40] mt-1 block">
                          {maxLoan}
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-[#004D40]/10 shadow-2xs">
                        <span className="text-xs font-medium text-[#004D40]/60 block">
                          {language === 'hi' ? 'वित्तीय लाभ / सहयोग' : 'Financial Benefit'}
                        </span>
                        <span className="text-sm sm:text-base font-bold text-[#FF6B35] mt-1 block">
                          {benefitPct}
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-[#004D40]/10 shadow-2xs col-span-2 sm:col-span-1">
                        <span className="text-xs font-medium text-[#004D40]/60 block">
                          {language === 'hi' ? 'गारंटी आवश्यकता' : 'Collateral Requirement'}
                        </span>
                        <span className="text-sm sm:text-base font-bold text-[#004D40] mt-1 block">
                          {scheme.benefits.collateral_free
                            ? language === 'hi'
                              ? 'शून्य गारंटी (बिना बंधक)'
                              : 'Zero Collateral'
                            : language === 'hi'
                            ? 'मानक बैंक नियम'
                            : 'Standard Bank Terms'}
                        </span>
                      </div>
                    </div>

                    {/* Verified Eligibility Criteria List */}
                    {match_details.length > 0 && (
                      <div className="space-y-2.5">
                        <p className="text-xs font-bold text-[#004D40]/70 uppercase tracking-wider">
                          {t.card_criteria_checked}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                          {match_details.map((d, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-xl flex items-center gap-2.5 border ${
                                d.matched
                                  ? 'bg-white border-emerald-200 text-[#004D40]'
                                  : 'bg-[#FAFAF7] border-[#004D40]/10 text-[#004D40]/50'
                              }`}
                            >
                              <CheckCircle2
                                className={`w-4 h-4 shrink-0 ${
                                  d.matched ? 'text-emerald-600' : 'text-gray-400'
                                  }`}
                              />
                              <span className="font-semibold">
                                {language === 'hi' ? d.hindi_criteria : d.criteria}:{' '}
                                <span className="font-normal text-[#004D40]/80">
                                  {d.scheme_requirement}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Direct Official Apply Button */}
                    <div className="pt-2">
                      <a
                        href={scheme.official_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="touch-target w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-base bg-[#004D40] hover:bg-[#00382E] text-white shadow-md shadow-[#004D40]/20 transition-all cursor-pointer focus:ring-2 focus:ring-offset-2 focus:ring-[#004D40]"
                      >
                        <span>{t.card_apply_now}</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <p className="text-[11px] text-[#004D40]/60 text-center mt-2 font-medium">
                        {language === 'hi'
                          ? 'यह लिंक आपको सीधे भारत सरकार के आधिकारिक पोर्टल पर ले जाएगा।'
                          : 'Opens official Government of India scheme portal in a new tab.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Reset & Modify Buttons */}
      <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={modifyAnswers}
          className="touch-target w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-[#FAFAF7] text-[#004D40] border border-[#004D40]/20 font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
        >
          <Edit3 className="w-4 h-4" />
          <span>{t.btn_modify_answers}</span>
        </button>

        <button
          type="button"
          onClick={resetAll}
          className="touch-target w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#FF6B35] hover:bg-[#E8551F] text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[#FF6B35]/20"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{t.btn_new_search}</span>
        </button>
      </div>
    </div>
  );
};
