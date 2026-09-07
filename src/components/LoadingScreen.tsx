import React from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';

export const LoadingScreen: React.FC = () => {
  const { language, loadingMessageKey } = useAppStore();
  const t = translations[language];

  const mainMessage =
    loadingMessageKey === 'loading_matching'
      ? t.loading_matching
      : t.loading_understanding;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-12">
      {/* Animated Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FFF5F0] text-[#FF6B35] border border-[#FF6B35]/20 shadow-sm shadow-[#FF6B35]/15 animate-bounce mb-4">
          <Sparkles className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#004D40] mb-2">
          {mainMessage}
        </h2>
        <p className="text-sm sm:text-base text-[#004D40]/70 font-medium">
          {language === 'hi'
            ? 'कृपया प्रतीक्षा करें, हम आपकी पात्रता का सही मिलान कर रहे हैं...'
            : 'Please wait, analyzing your profile against verified criteria...'}
        </p>
      </div>

      {/* Progress Skeleton Cards */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-6 border border-[#004D40]/10 shadow-xs animate-pulse space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 bg-[#004D40]/10 rounded-md w-2/3"></div>
              <div className="h-5 bg-emerald-100 rounded-full w-24"></div>
            </div>
            <div className="h-4 bg-[#004D40]/5 rounded w-full"></div>
            <div className="h-4 bg-[#004D40]/5 rounded w-4/5"></div>
            <div className="pt-3 flex items-center justify-between border-t border-[#004D40]/10">
              <div className="h-4 bg-[#FF6B35]/20 rounded w-1/3"></div>
              <div className="h-9 bg-[#004D40]/15 rounded-xl w-28"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Status indicator items */}
      <div className="mt-8 bg-white rounded-2xl p-5 border border-[#004D40]/10 shadow-xs flex flex-col sm:flex-row items-center justify-around gap-4 text-xs font-semibold">
        <div className="flex items-center gap-2 text-[#004D40]">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{language === 'hi' ? '1. प्रोफाइल विश्लेषण' : '1. Profile Analysis'}</span>
        </div>
        <div className="flex items-center gap-2 text-[#FF6B35]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B35] animate-ping" />
          <span>{language === 'hi' ? '2. नियम-आधारित मिलान' : '2. Rule-Based Matching'}</span>
        </div>
        <div className="flex items-center gap-2 text-[#004D40]/40">
          <span>{language === 'hi' ? '3. परिणाम तैयारी' : '3. Final Ranking'}</span>
        </div>
      </div>
    </div>
  );
};

