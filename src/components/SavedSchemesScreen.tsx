import React, { useMemo } from 'react';
import { Bookmark, ExternalLink, Building2, Coins, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import schemesRaw from '../data/schemes.json';
import scholarshipsRaw from '../data/scholarships.json';
import { Scheme } from '../types';

export const SavedSchemesScreen: React.FC = () => {
  const { language, bookmarkedSchemeIds, toggleBookmark, navigateTo } = useAppStore();
  const t = translations[language];

  const savedItems = useMemo(() => {
    return bookmarkedSchemeIds
      .map((key) => {
        const [categoryType, id] = key.split(':') as ['scheme' | 'scholarship', string];
        const dataset = (categoryType === 'scholarship' ? scholarshipsRaw : schemesRaw) as Scheme[];
        const scheme = dataset.find((s) => s.id === id);
        if (!scheme) return null;
        return { scheme, categoryType };
      })
      .filter((item): item is { scheme: Scheme; categoryType: 'scheme' | 'scholarship' } => item !== null);
  }, [bookmarkedSchemeIds]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#004D40]/10 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#004D40]/5 border border-[#004D40]/10 text-[#004D40] text-xs font-bold uppercase tracking-wider mb-2">
            <Bookmark className="w-3.5 h-3.5 text-[#FF6B35]" />
            <span>{language === 'hi' ? 'सहेजी गई योजनाएं' : 'Saved Schemes & Scholarships'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#004D40] tracking-tight">
            {language === 'hi'
              ? `${savedItems.length} सहेजी गई योजनाएं`
              : `${savedItems.length} saved item${savedItems.length === 1 ? '' : 's'}`}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('landing')}
          className="touch-target px-4 py-2 text-xs sm:text-sm font-bold text-[#004D40] bg-[#004D40]/5 hover:bg-[#004D40]/10 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-[#004D40]/10 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'hi' ? 'वापस' : 'Back'}</span>
        </button>
      </div>

      {savedItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-xs border-2 border-[#004D40]/10 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#FFF5F0] text-[#FF6B35] flex items-center justify-center mx-auto shadow-inner">
            <Bookmark className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-bold text-[#004D40]">
            {language === 'hi' ? 'अभी कोई योजना सहेजी नहीं गई' : 'No saved schemes yet'}
          </h2>
          <p className="text-sm text-[#004D40]/70 max-w-md mx-auto leading-relaxed">
            {language === 'hi'
              ? 'परिणाम पृष्ठ पर बुकमार्क आइकन टैप करके कोई भी योजना यहां सहेजें।'
              : 'Tap the bookmark icon on any result card to save it here for later.'}
          </p>
          <button
            type="button"
            onClick={() => navigateTo('landing')}
            className="touch-target px-6 py-3 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-sm cursor-pointer"
          >
            {language === 'hi' ? 'योजनाएं खोजें' : 'Find Schemes'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {savedItems.map(({ scheme, categoryType }) => {
            const schemeName = language === 'hi' ? scheme.hindi_name : scheme.name;
            const ministryName = language === 'hi' ? scheme.hindi_ministry : scheme.ministry;
            const benefitHeadline = language === 'hi' ? scheme.hindi_benefit_headline : scheme.benefit_headline;

            return (
              <div
                key={`${categoryType}:${scheme.id}`}
                className="bg-white rounded-2xl border border-[#004D40]/10 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-[#004D40]/5 text-[#004D40] text-[10px] font-bold uppercase tracking-wider">
                    {categoryType === 'scholarship'
                      ? (language === 'hi' ? 'छात्रवृत्ति' : 'Scholarship')
                      : (language === 'hi' ? 'योजना' : 'Scheme')}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[#004D40] leading-snug">
                    {schemeName}
                  </h3>
                  <div className="flex items-center gap-2 text-sm font-bold text-[#FF6B35]">
                    <Coins className="w-4 h-4 shrink-0" />
                    <span>{benefitHeadline}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#004D40]/60 font-medium">
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-[#004D40]/40" />
                    <span className="line-clamp-1">{ministryName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={scheme.official_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="touch-target px-3.5 py-2 rounded-xl bg-[#004D40] hover:bg-[#00382E] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{language === 'hi' ? 'आवेदन करें' : 'Apply'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => toggleBookmark(scheme.id, categoryType)}
                    className="touch-target p-2.5 rounded-xl bg-[#004D40] text-white hover:bg-[#00382E] cursor-pointer"
                    aria-label="Remove from saved"
                    title={language === 'hi' ? 'हटाएं' : 'Remove'}
                  >
                    <Bookmark className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
