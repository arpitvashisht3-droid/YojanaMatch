import React from 'react';
import { MessageSquare, ArrowRight, HelpCircle, FastForward } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import { FOLLOW_UP_QUESTIONS } from '../lib/followUpQuestions';

export const FollowUpChatScreen: React.FC = () => {
  const {
    language,
    missingFields,
    currentQuestionIndex,
    answerQuestion,
    skipRemainingQuestions,
  } = useAppStore();
  const t = translations[language];

  if (missingFields.length === 0 || currentQuestionIndex >= missingFields.length) {
    return null;
  }

  const currentField = missingFields[currentQuestionIndex];
  const questionConfig = FOLLOW_UP_QUESTIONS[currentField];
  const totalQuestions = missingFields.length;
  const currentNum = currentQuestionIndex + 1;

  const questionText = language === 'hi' ? questionConfig.question_hi : questionConfig.question_en;

  const handleSelectOption = (val: any) => {
    answerQuestion(currentField, val);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Progress & Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border-2 border-[#004D40]/10 space-y-6">
        <div className="flex items-center justify-between border-b border-[#004D40]/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#004D40]/5 text-[#004D40] flex items-center justify-center font-bold text-sm border border-[#004D40]/10">
              <MessageSquare className="w-5 h-5 text-[#004D40]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#FF6B35] uppercase tracking-wider">
                {t.chat_progress.replace('{current}', String(currentNum)).replace('{total}', String(totalQuestions))}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-[#004D40]">
                {t.chat_header}
              </h2>
            </div>
          </div>

          {/* Skip Button */}
          <button
            onClick={skipRemainingQuestions}
            className="touch-target text-xs sm:text-sm font-bold text-[#004D40]/70 hover:text-[#FF6B35] flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-[#004D40]/5 transition-colors cursor-pointer"
          >
            <span>{t.chat_skip_all}</span>
            <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#004D40]/5 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-[#FF6B35] h-full transition-all duration-300 rounded-full"
            style={{ width: `${(currentNum / totalQuestions) * 100}%` }}
          />
        </div>

        {/* Chat Question Bubble */}
        <div className="space-y-3 pt-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#004D40] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              YM
            </div>
            <div className="bg-[#004D40]/5 text-[#004D40] p-5 rounded-2xl rounded-tl-sm text-base sm:text-lg font-semibold leading-relaxed border border-[#004D40]/10 shadow-2xs">
              {questionText}
            </div>
          </div>
        </div>

        {/* Quick-Reply Tappable Option Buttons */}
        <div className="pt-3">
          <p className="text-xs font-bold text-[#004D40]/60 uppercase tracking-wider mb-3">
            {language === 'hi' ? 'उत्तर चुनने के लिए टैप करें:' : 'Tap to answer:'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {questionConfig.options.map((opt, idx) => {
              const label = language === 'hi' ? opt.label_hi : opt.label_en;
              const isWildcard = opt.value === 'any' || opt.value === null;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectOption(opt.value)}
                  className={`touch-target w-full text-left px-5 py-4 rounded-xl border text-sm sm:text-base font-semibold transition-all flex items-center justify-between group cursor-pointer ${
                    isWildcard
                      ? 'border-[#004D40]/15 bg-[#FAFAF7] hover:bg-[#004D40]/5 text-[#004D40]/70'
                      : 'border-[#004D40]/15 bg-white hover:border-[#FF6B35] hover:bg-[#FFF5F0] text-[#004D40] shadow-2xs'
                  }`}
                >
                  <span className="group-hover:text-[#FF6B35] transition-colors">{label}</span>
                  <ArrowRight className="w-4 h-4 text-[#004D40]/40 group-hover:text-[#FF6B35] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Wildcard note */}
        <div className="pt-4 border-t border-[#004D40]/10 flex items-center gap-2 text-xs text-[#004D40]/60 font-medium">
          <HelpCircle className="w-4 h-4 text-[#004D40]/40 shrink-0" />
          <span>
            {language === 'hi'
              ? 'यदि आप "नहीं बताना चाहते" चुनते हैं, तो सभी संबंधित योजनाओं की खोज की जाएगी।'
              : 'Choosing "Prefer not to say" acts as a wildcard and matches all related schemes.'}
          </span>
        </div>
      </div>
    </div>
  );
};

