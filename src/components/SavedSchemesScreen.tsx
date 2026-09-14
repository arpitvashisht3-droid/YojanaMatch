import React, { useEffect, useMemo } from 'react';
import { Bookmark, ExternalLink, Building2, Coins, ArrowLeft } from 'lucide-react';
import { getCanonicalSchemeId, useAppStore } from '../store/useAppStore';
import schemesRaw from '../data/schemes.json';
import scholarshipsRaw from '../data/scholarships.json';
import { Scheme } from '../types';

type SavedItem = {
  scheme: Scheme;
  categoryType: 'scheme' | 'scholarship';
};

function classifyScheme(scheme: Scheme): 'scheme' | 'scholarship' {
  const scholarships = scholarshipsRaw as Scheme[];
  if (scholarships.some((s) => getCanonicalSchemeId(s) === getCanonicalSchemeId(scheme))) {
    return 'scholarship';
  }
  if (scheme.eligibility?.education_levels || /scholarship/i.test(scheme.name || '')) {
    return 'scholarship';
  }
  return 'scheme';
}

function resolveSavedItems(savedIds: string[], savedSchemes: Scheme[]): SavedItem[] {
  const schemesDataset = schemesRaw as Scheme[];
  const scholarshipsDataset = scholarshipsRaw as Scheme[];
  const byId = new Map<string, Scheme>();

  for (const s of savedSchemes) {
    const id = getCanonicalSchemeId(s);
    if (id) byId.set(id, { ...s, id });
  }

  return savedIds
    .map((rawId) => {
      const cleanId = getCanonicalSchemeId(rawId);
      if (!cleanId) return null;

      if (byId.has(cleanId)) {
        const scheme = byId.get(cleanId)!;
        return { scheme, categoryType: classifyScheme(scheme) };
      }

      const fromScholarships = scholarshipsDataset.find((s) => getCanonicalSchemeId(s) === cleanId);
      if (fromScholarships) {
        return { scheme: { ...fromScholarships, id: cleanId }, categoryType: 'scholarship' as const };
      }

      const fromSchemes = schemesDataset.find((s) => getCanonicalSchemeId(s) === cleanId);
      if (fromSchemes) {
        return { scheme: { ...fromSchemes, id: cleanId }, categoryType: 'scheme' as const };
      }

      return null;
    })
    .filter((item): item is SavedItem => item !== null);
}

export const SavedSchemesScreen: React.FC = () => {
  const {
    language,
    user,
    savedSchemeIds,
    savedSchemes,
    isSavedSchemesLoading,
    fetchSavedSchemes,
    toggleSaveScheme,
    navigateTo,
  } = useAppStore();

  useEffect(() => {
    if (!user) return;
    fetchSavedSchemes();
  }, [user, fetchSavedSchemes]);

  const savedItems = useMemo(
    () => resolveSavedItems(savedSchemeIds, savedSchemes),
    [savedSchemeIds, savedSchemes]
  );

  useEffect(() => {
    if (!user) return;
    const unresolved = savedSchemeIds.filter(
      (id) => !savedItems.some((item) => getCanonicalSchemeId(item.scheme) === getCanonicalSchemeId(id))
    );
    console.debug('[SavedSchemesScreen] savedSchemeIds:', savedSchemeIds);
    console.debug('[SavedSchemesScreen] savedSchemes from store:', savedSchemes.map((s) => getCanonicalSchemeId(s)));
    console.debug('[SavedSchemesScreen] resolved items:', savedItems.map((i) => i.scheme.id));
    console.debug('[SavedSchemesScreen] unresolved ids:', unresolved);
  }, [user, savedSchemeIds, savedSchemes, savedItems]);

  if (!user) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <div className="bg-white rounded-2xl p-8 shadow-xs border-2 border-[#004D40]/10 text-center space-y-4">
          <h2 className="text-xl font-bold text-[#004D40]">
            {language === 'hi' ? 'सहेजी गई योजनाएं देखने के लिए लॉगिन करें' : 'Log in to view saved schemes'}
          </h2>
          <button
            type="button"
            onClick={() => navigateTo('signup')}
            className="touch-target px-6 py-3 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-sm cursor-pointer"
          >
            {language === 'hi' ? 'लॉगिन / साइन अप' : 'Login / Sign up'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#004D40]/10 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#004D40]/5 border border-[#004D40]/10 text-[#004D40] text-xs font-bold uppercase tracking-wider mb-2">
            <Bookmark className="w-3.5 h-3.5 text-[#FF6B35]" />
            <span>{language === 'hi' ? 'सहेजी गई योजनाएं' : 'Saved Schemes & Scholarships'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#004D40] tracking-tight">
            {isSavedSchemesLoading
              ? (language === 'hi' ? 'लोड हो रहा है…' : 'Loading…')
              : language === 'hi'
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

      {isSavedSchemesLoading && savedItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-xs border border-[#004D40]/10 text-center text-sm text-[#004D40]/70 font-medium">
          {language === 'hi' ? 'आपकी सहेजी गई योजनाएं लोड हो रही हैं…' : 'Loading your saved schemes…'}
        </div>
      ) : savedItems.length === 0 ? (
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
            const schemeName = language === 'hi' ? (scheme.hindi_name || scheme.name) : scheme.name;
            const ministryName = language === 'hi' ? (scheme.hindi_ministry || scheme.ministry) : scheme.ministry;
            const benefitHeadline = language === 'hi'
              ? (scheme.hindi_benefit_headline || scheme.benefit_headline)
              : scheme.benefit_headline;

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
                    onClick={() => toggleSaveScheme(scheme.id)}
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
