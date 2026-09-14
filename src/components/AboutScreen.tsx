import React from 'react';
import { Sparkles, ArrowRight, Shield, Cpu, Users, Award, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';

export const AboutScreen: React.FC = () => {
  const { language, navigateTo } = useAppStore();
  const t = translations[language];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      {/* Title & Vision */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#004D40]/5 border border-[#004D40]/10 text-[#004D40] text-xs font-bold uppercase tracking-wider">
          <Award className="w-4 h-4 text-[#FF6B35]" />
          <span>{language === 'hi' ? 'स्मार्ट इंडिया हैकाथॉन मिशन' : 'Smart India Hackathon Mission'}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#004D40] tracking-tight">
          {t.about_title}
        </h1>
        <p className="text-base sm:text-lg text-[#004D40]/75 max-w-2xl mx-auto leading-relaxed font-normal">
          {t.about_subtitle}
        </p>
      </div>

      {/* 3-Step Icon Based Workflow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Step 1 */}
        <div className="bg-white rounded-2xl p-6 border border-[#004D40]/10 shadow-xs flex flex-col items-center text-center space-y-3 hover:shadow-sm transition-all">
          <div className="w-12 h-12 rounded-xl bg-[#FFF5F0] text-[#FF6B35] flex items-center justify-center font-bold text-lg border border-[#FF6B35]/20">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#004D40]">
            {t.step1_title}
          </h2>
          <p className="text-sm text-[#004D40]/70 leading-relaxed font-normal">
            {t.step1_desc}
          </p>
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-2xl p-6 border border-[#004D40]/10 shadow-xs flex flex-col items-center text-center space-y-3 hover:shadow-sm transition-all">
          <div className="w-12 h-12 rounded-xl bg-[#004D40]/5 text-[#004D40] flex items-center justify-center font-bold text-lg border border-[#004D40]/10">
            <Cpu className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#004D40]">
            {t.step2_title}
          </h2>
          <p className="text-sm text-[#004D40]/70 leading-relaxed font-normal">
            {t.step2_desc}
          </p>
        </div>

        {/* Step 3 */}
        <div className="bg-white rounded-2xl p-6 border border-[#004D40]/10 shadow-xs flex flex-col items-center text-center space-y-3 hover:shadow-sm transition-all">
          <div className="w-12 h-12 rounded-xl bg-[#FFF5F0] text-[#FF6B35] flex items-center justify-center font-bold text-lg border border-[#FF6B35]/20">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#004D40]">
            {t.step3_title}
          </h2>
          <p className="text-sm text-[#004D40]/70 leading-relaxed font-normal">
            {t.step3_desc}
          </p>
        </div>
      </div>

      {/* Core Principles & Guarantees */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-[#004D40]/10 shadow-xs space-y-5">
        <h2 className="text-xl font-bold text-[#004D40] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#FF6B35]" />
          <span>{t.guarantee_title}</span>
        </h2>

        <div className="space-y-4 text-sm sm:text-base text-[#004D40]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#FF6B35] mt-0.5 shrink-0" />
            <p>
              <strong className="text-[#004D40]">{language === 'hi' ? 'नियम-आधारित निष्पक्षता: ' : 'Deterministic Code Matching: '}</strong>
              <span className="text-[#004D40]/80">{t.principle1}</span>
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#004D40] mt-0.5 shrink-0" />
            <p>
              <strong className="text-[#004D40]">{language === 'hi' ? 'गोपनीयता सुरक्षा: ' : 'Privacy First: '}</strong>
              <span className="text-[#004D40]/80">{t.principle2}</span>
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#FF6B35] mt-0.5 shrink-0" />
            <p>
              <strong className="text-[#004D40]">{language === 'hi' ? 'सुलभता एवं आवाज समर्थन: ' : 'Accessible for All: '}</strong>
              <span className="text-[#004D40]/80">{t.principle3}</span>
            </p>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="text-center pt-2">
        <button
          onClick={() => navigateTo('landing')}
          className="touch-target inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#FF6B35] hover:bg-[#E8551F] text-white font-bold text-base sm:text-lg shadow-md shadow-[#FF6B35]/25 transition-all cursor-pointer hover:scale-[1.01] active:scale-95"
        >
          <span>{t.btn_back_to_search}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

