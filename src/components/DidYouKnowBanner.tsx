import React, { useState, useEffect } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import { DID_YOU_KNOW_FACTS, DID_YOU_KNOW_SCHOLARSHIP_FACTS } from '../lib/userProfileHelper';
import schemesRaw from '../data/schemes.json';
import scholarshipsRaw from '../data/scholarships.json';
import { Scheme } from '../types';

interface DidYouKnowBannerProps {
  className?: string;
}

export const DidYouKnowBanner: React.FC<DidYouKnowBannerProps> = ({ className = '' }) => {
  const { language, contentMode, startDiscovery } = useAppStore();
  const t = translations[language];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const activeFacts = contentMode === 'scholarships' ? DID_YOU_KNOW_SCHOLARSHIP_FACTS : DID_YOU_KNOW_FACTS;
  const allItems = (contentMode === 'scholarships' ? scholarshipsRaw : schemesRaw) as Scheme[];

  // Reset index when mode changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [contentMode]);

  // Auto-rotate every 6 seconds unless hovered
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeFacts.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isHovered, activeFacts.length]);

  const currentFact = activeFacts[currentIndex % activeFacts.length];

  const nextFact = () => setCurrentIndex((prev) => (prev + 1) % activeFacts.length);
  const prevFact = () => setCurrentIndex((prev) => (prev - 1 + activeFacts.length) % activeFacts.length);

  const handleExploreScheme = () => {
    if (!currentFact) return;
    const target = allItems.find((s) => s.id === currentFact.schemeId);
    if (target) {
      startDiscovery(target.name);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#004D40] via-[#00574B] to-[#00695C] text-white p-4 sm:p-5 shadow-xs border border-[#004D40]/30 transition-all duration-300 ${className}`}
      role="region"
      aria-label={t.rec_did_you_know_title}
    >
      {/* Background Accent Subtle Glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#FF6B35]/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Badge & Fact Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur text-amber-300 text-[11px] font-bold uppercase tracking-wider">
              <Lightbulb className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>{t.rec_did_you_know_title}</span>
            </span>
            <span className="text-[11px] text-white/60 hidden md:inline">
              {language === 'hi' ? 'आधिकारिक सरकारी नीति मुख्य आकर्षण' : 'Official Policy Highlight'}
            </span>
          </div>

          <p className="text-sm sm:text-[15px] font-medium text-emerald-50 leading-snug line-clamp-2 transition-opacity duration-300">
            {language === 'hi' ? currentFact.hi : currentFact.en}
          </p>
        </div>

        {/* Right: Controls & Action */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
          {/* Fact Counter & Arrows */}
          <div className="flex items-center gap-1.5 bg-black/15 px-2 py-1 rounded-xl">
            <button
              type="button"
              onClick={prevFact}
              className="touch-target p-1 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
              aria-label="Previous fact"
              title="Previous fact"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono text-white/80 px-1 font-semibold select-none">
              {currentIndex + 1}/{activeFacts.length}
            </span>
            <button
              type="button"
              onClick={nextFact}
              className="touch-target p-1 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
              aria-label="Next fact"
              title="Next fact"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick CTA to discover/check scheme or scholarship */}
          <button
            type="button"
            onClick={handleExploreScheme}
            className="touch-target px-3 py-1.5 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] active:bg-[#c94d1f] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <span>
              {contentMode === 'scholarships'
                ? (language === 'hi' ? 'छात्रवृत्ति देखें' : 'View Scholarship')
                : (language === 'hi' ? 'योजना देखें' : 'View Scheme')}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
