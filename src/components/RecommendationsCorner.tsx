import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Flame,
  MapPin,
  Tag,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Lightbulb,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';
import { DID_YOU_KNOW_FACTS, DID_YOU_KNOW_SCHOLARSHIP_FACTS } from '../lib/userProfileHelper';
import schemesRaw from '../data/schemes.json';
import scholarshipsRaw from '../data/scholarships.json';
import { Scheme } from '../types';

type SchemeWithExtras = Scheme & {
  popularity_score?: number;
  date_added?: string;
  applicable_states?: string[];
  category_tags?: string[];
};

// Helper to pre-highlight category chip from user's profile
export const getPrehighlightedTag = (
  user: ReturnType<typeof useAppStore.getState>['user'],
  isScholarship: boolean = false
) => {
  if (!user) return 'all';
  const cats = user.categories || [];

  if (isScholarship) {
    if (user.gender === 'female' || cats.includes('Woman')) return 'women';
    if (cats.includes('SC') || cats.includes('ST')) return 'sc_st';
    if (user.education_level === 'school') return 'pre_matric';
    if (user.education_level === 'diploma') return 'post_matric';
    if (user.education_level === 'undergraduate' || user.education_level === 'postgraduate') return 'higher_ed';
    return 'all';
  }

  if (cats.includes('Woman')) return 'women';
  if (cats.includes('SC') || cats.includes('ST')) return 'sc_st';
  if (user.business_type === 'artisan_handicraft') return 'artisan';
  if (user.business_type === 'street_vendor') return 'vendor';
  if (user.business_type === 'dairy_livestock') return 'agriculture';
  if (user.business_type === 'manufacturing' || user.business_type === 'retail_shop') return 'msme';
  return 'all';
};

// Shared card renderers
export const renderPopularSchemeCard = (
  scheme: SchemeWithExtras,
  language: 'en' | 'hi',
  t: (typeof translations)['en'],
  onExplore: (name: string) => void,
  isScholarship: boolean = false
) => (
  <div
    key={scheme.id}
    className="p-3.5 rounded-xl border border-[#004D40]/10 hover:border-[#004D40]/25 transition-all bg-[#004D40]/2 flex flex-col justify-between gap-2 max-[899px]:min-w-[270px] max-[899px]:max-w-[270px] max-[899px]:shrink-0 max-[899px]:snap-start min-[900px]:w-full min-[900px]:h-[136px] min-[900px]:shrink-0 min-[900px]:snap-start"
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
          {scheme.popularity_score || 90}/100 {isScholarship ? 'Verified' : 'Demand'}
        </span>
        {scheme.benefits.collateral_free && (
          <span className="text-[10px] sm:text-[11px] text-gray-600 font-medium">
            • {isScholarship ? (language === 'hi' ? 'प्रत्यक्ष लाभ' : 'Direct DBT') : t.card_collateral_free}
          </span>
        )}
      </div>
      <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug line-clamp-2">
        {language === 'hi' ? scheme.hindi_name : scheme.name}
      </h4>
      <p className="text-xs text-[#FF6B35] font-semibold mt-0.5 line-clamp-1">
        {language === 'hi' ? scheme.hindi_benefit_headline : scheme.benefit_headline}
      </p>
    </div>

    <div className="pt-2 border-t border-[#004D40]/5 flex items-center justify-between">
      <span className="text-[11px] text-gray-500 line-clamp-1">{scheme.ministry.split('(')[0]}</span>
      <button
        type="button"
        onClick={() => onExplore(scheme.name)}
        className="touch-target px-2.5 py-1 rounded-lg bg-white border border-[#004D40]/20 hover:bg-[#004D40]/5 text-xs font-bold text-[#004D40] shrink-0 cursor-pointer"
      >
        {language === 'hi' ? 'जांचें' : 'Check'}
      </button>
    </div>
  </div>
);

export const renderTrendingSchemeCard = (
  scheme: SchemeWithExtras,
  idx: number,
  language: 'en' | 'hi',
  onExplore: (name: string) => void,
  isScholarship: boolean = false
) => (
  <div
    key={scheme.id}
    className="p-3.5 rounded-xl border border-[#004D40]/10 hover:border-[#004D40]/25 transition-all bg-[#FF6B35]/2 flex flex-col justify-between gap-2 max-[899px]:min-w-[270px] max-[899px]:max-w-[270px] max-[899px]:shrink-0 max-[899px]:snap-start min-[900px]:w-full min-[900px]:h-[136px] min-[900px]:shrink-0 min-[900px]:snap-start"
  >
    <div className="flex items-start gap-2.5 flex-1 min-w-0">
      <div className="w-5 h-5 rounded-full bg-[#FF6B35] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
        #{idx + 1}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug line-clamp-2">
          {language === 'hi' ? scheme.hindi_name : scheme.name}
        </h4>
        <p className="text-xs text-[#FF6B35] font-semibold mt-0.5 line-clamp-1">
          {language === 'hi' ? scheme.hindi_benefit_headline : scheme.benefit_headline}
        </p>
        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
          {scheme.ministry.split('(')[0]}
        </p>
      </div>
    </div>

    <div className="pt-2 border-t border-[#004D40]/5 flex items-center justify-between">
      <span className="text-[10px] font-bold text-emerald-700">
        {isScholarship ? 'High Merit / DBT' : 'High Approval'}
      </span>
      <button
        type="button"
        onClick={() => onExplore(scheme.name)}
        className="touch-target px-2.5 py-1 rounded-lg bg-[#FF6B35] hover:bg-[#e05a28] text-xs font-bold text-white shrink-0 cursor-pointer shadow-2xs"
      >
        {language === 'hi' ? 'जांचें' : 'Check'}
      </button>
    </div>
  </div>
);

export const renderNewThisMonthSchemeCard = (
  scheme: SchemeWithExtras,
  language: 'en' | 'hi',
  onExplore: (name: string) => void,
  isScholarship: boolean = false
) => (
  <div
    key={scheme.id}
    className="p-3.5 rounded-xl border border-emerald-600/20 bg-emerald-50/20 flex flex-col justify-between max-[899px]:min-w-[260px] max-[899px]:max-w-[260px] max-[899px]:shrink-0 max-[899px]:snap-start min-[900px]:w-full"
  >
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
          {isScholarship ? 'Open Portal' : 'New Policy'}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">
          {scheme.date_added || '2025'}
        </span>
      </div>
      <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug line-clamp-2">
        {language === 'hi' ? scheme.hindi_name : scheme.name}
      </h4>
      <p className="text-xs text-[#FF6B35] font-semibold mt-1 line-clamp-2">
        {language === 'hi' ? scheme.hindi_benefit_headline : scheme.benefit_headline}
      </p>
    </div>

    <button
      type="button"
      onClick={() => onExplore(scheme.name)}
      className="touch-target mt-3 w-full py-1.5 px-3 rounded-lg bg-white border border-[#004D40]/20 hover:bg-[#004D40]/5 text-xs font-bold text-[#004D40] flex items-center justify-center gap-1 cursor-pointer"
    >
      <span>
        {isScholarship
          ? (language === 'hi' ? 'छात्रवृत्ति देखें' : 'View Scholarship')
          : (language === 'hi' ? 'विवरण देखें' : 'View Scheme')}
      </span>
      <ArrowRight className="w-3 h-3" />
    </button>
  </div>
);

// 1. LEFT SIDEBAR: "New & Updated This Month"
// Sized automatically to fit-content with no excess empty space
export const NewThisMonthSidebar: React.FC = () => {
  const { language, contentMode, startDiscovery } = useAppStore();
  const t = translations[language];
  const isScholarship = contentMode === 'scholarships';

  const allItems = (isScholarship ? scholarshipsRaw : schemesRaw) as SchemeWithExtras[];
  const newThisMonth = useMemo(() => {
    return [...allItems]
      .filter((s) => s.date_added)
      .sort((a, b) => new Date(b.date_added || '').getTime() - new Date(a.date_added || '').getTime())
      .slice(0, 3);
  }, [allItems]);

  return (
    <div className="bg-white border border-[#004D40]/15 rounded-2xl p-4 sm:p-5 shadow-2xs h-fit self-start">
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-[#004D40]/10">
        <h3 className="text-sm sm:text-base font-bold text-[#004D40] flex items-center gap-2">
          {isScholarship ? <GraduationCap className="w-4 h-4 text-[#FF6B35]" /> : <Calendar className="w-4 h-4 text-[#FF6B35]" />}
          <span>
            {isScholarship
              ? (language === 'hi' ? 'हाल ही में जोड़ी गई छात्रवृत्तियां' : 'New Scholarships This Month')
              : t.rec_new_month_title}
          </span>
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
          2025
        </span>
      </div>
      <p className="text-[11px] text-[#004D40]/70 mb-3 hidden min-[900px]:block">
        {isScholarship
          ? (language === 'hi' ? 'सत्र 2025-26 के लिए नए छात्रवृत्ति आवेदन' : 'Recent scholarship additions for academic year 2025-26')
          : (language === 'hi' ? 'हाल ही में जोड़ी गई सरकारी योजनाएं' : 'Recent additions for micro-enterprises')}
      </p>

      {/* Auto-fits content: stacked normally on desktop without any excess empty space, horizontally scrollable on mobile */}
      <div className="flex flex-col min-[900px]:flex-col max-[899px]:flex-row max-[899px]:overflow-x-auto max-[899px]:gap-3 max-[899px]:pb-2 max-[899px]:snap-x max-[899px]:scrollbar-none gap-3">
        {newThisMonth.map((scheme) =>
          renderNewThisMonthSchemeCard(scheme, language, startDiscovery, isScholarship)
        )}
      </div>
    </div>
  );
};

// 2. RIGHT SIDEBAR BLOCK: "Popular in your state"
// Shows exactly ONE card's height at a time, with remaining cards accessible via vertical scroll inside container
export const PopularInStateSidebar: React.FC = () => {
  const { language, contentMode, user, startDiscovery } = useAppStore();
  const t = translations[language];
  const isScholarship = contentMode === 'scholarships';
  const userState = user?.state || null;
  const scrollRef = useRef<HTMLDivElement>(null);

  const allItems = (isScholarship ? scholarshipsRaw : schemesRaw) as SchemeWithExtras[];
  const popularInState = useMemo(() => {
    if (userState) {
      const stateMatches = allItems.filter(
        (s) =>
          !s.applicable_states ||
          s.applicable_states.includes('All India') ||
          s.applicable_states.includes('All') ||
          s.applicable_states.includes(userState)
      );
      return [...stateMatches]
        .sort((a, b) => (b.popularity_score || 80) - (a.popularity_score || 80))
        .slice(0, 3);
    }
    return [...allItems]
      .sort((a, b) => (b.popularity_score || 80) - (a.popularity_score || 80))
      .slice(0, 3);
  }, [userState, allItems]);

  return (
    <div className="bg-white border border-[#004D40]/15 rounded-2xl p-4 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-[#004D40]/10">
        <h3 className="text-sm sm:text-base font-bold text-[#004D40] flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#FF6B35]" />
          <span>
            {userState
              ? (isScholarship
                  ? (language === 'hi' ? `${userState} में लोकप्रिय छात्रवृत्तियां` : `Popular Scholarships in ${userState}`)
                  : t.rec_popular_state_title.replace('{state}', userState))
              : (isScholarship
                  ? (language === 'hi' ? 'पूरे भारत में लोकप्रिय छात्रवृत्तियां' : 'Popular Scholarships Across India')
                  : (language === 'hi' ? 'पूरे भारत में लोकप्रिय' : 'Popular in India'))}
          </span>
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#004D40]/10 text-[#004D40] shrink-0">
          {userState ? (isScholarship ? `${userState} Quota` : 'State Quotas') : 'All States'}
        </span>
      </div>

      {/* Relative wrapper with single-card height scroll viewport on desktop, horizontally scrollable on mobile */}
      <div className="relative">
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label={
            userState
              ? (isScholarship ? `Popular Scholarships in ${userState}` : t.rec_popular_state_title.replace('{state}', userState))
              : 'Popular items'
          }
          className="flex flex-col min-[900px]:flex-col max-[899px]:flex-row max-[899px]:overflow-x-auto max-[899px]:gap-3 max-[899px]:pb-2 max-[899px]:snap-x max-[899px]:scrollbar-none min-[900px]:h-[136px] min-[900px]:max-h-[136px] min-[900px]:overflow-y-auto min-[900px]:snap-y min-[900px]:snap-mandatory min-[900px]:gap-2.5 min-[900px]:pr-1 focus:outline-none"
        >
          {popularInState.map((scheme) =>
            renderPopularSchemeCard(scheme, language, t, startDiscovery, isScholarship)
          )}
        </div>

        {/* Subtle gradient fade at bottom edge on desktop as visual scroll affordance */}
        <div
          className="pointer-events-none absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-white/90 via-white/50 to-transparent rounded-b-xl hidden min-[900px]:block"
          aria-hidden="true"
        />
      </div>

      {/* Subtle down-chevron scroll affordance */}
      <div className="hidden min-[900px]:flex items-center justify-between mt-2.5 pt-2 border-t border-[#004D40]/5 text-[10px] text-[#004D40]/60 select-none">
        <span className="flex items-center gap-1 font-medium">
          <ChevronDown className="w-3 h-3 text-[#FF6B35] animate-bounce" />
          <span>
            {language === 'hi'
              ? (isScholarship ? 'अन्य 2 छात्रवृत्तियां देखने के लिए नीचे स्क्रॉल करें' : 'अन्य 2 योजनाएं देखने के लिए नीचे स्क्रॉल करें')
              : (isScholarship ? 'Scroll inside box for more (3 scholarships)' : 'Scroll inside box for more (3 schemes)')}
          </span>
        </span>
        <span className="font-semibold text-[#004D40]/70">1 / 3</span>
      </div>
    </div>
  );
};

// 3. RIGHT SIDEBAR BLOCK: "Trending schemes"
// Shows exactly ONE card's height at a time, with remaining cards accessible via vertical scroll inside container
export const TrendingSchemesSidebar: React.FC = () => {
  const { language, contentMode, startDiscovery } = useAppStore();
  const t = translations[language];
  const isScholarship = contentMode === 'scholarships';
  const scrollRef = useRef<HTMLDivElement>(null);

  const allItems = (isScholarship ? scholarshipsRaw : schemesRaw) as SchemeWithExtras[];
  const trendingSchemes = useMemo(() => {
    return [...allItems]
      .sort((a, b) => (b.popularity_score || 80) - (a.popularity_score || 80))
      .slice(0, 3);
  }, [allItems]);

  return (
    <div className="bg-white border border-[#004D40]/15 rounded-2xl p-4 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-[#004D40]/10">
        <h3 className="text-sm sm:text-base font-bold text-[#004D40] flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#FF6B35]" />
          <span>
            {isScholarship
              ? (language === 'hi' ? 'ट्रेंडिंग छात्रवृत्तियां' : 'Trending Scholarships')
              : t.rec_trending_title}
          </span>
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35] shrink-0">
          Trending
        </span>
      </div>

      {/* Relative wrapper with single-card height scroll viewport on desktop, horizontally scrollable on mobile */}
      <div className="relative">
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label={isScholarship ? 'Trending scholarships' : t.rec_trending_title}
          className="flex flex-col min-[900px]:flex-col max-[899px]:flex-row max-[899px]:overflow-x-auto max-[899px]:gap-3 max-[899px]:pb-2 max-[899px]:snap-x max-[899px]:scrollbar-none min-[900px]:h-[136px] min-[900px]:max-h-[136px] min-[900px]:overflow-y-auto min-[900px]:snap-y min-[900px]:snap-mandatory min-[900px]:gap-2.5 min-[900px]:pr-1 focus:outline-none"
        >
          {trendingSchemes.map((scheme, idx) =>
            renderTrendingSchemeCard(scheme, idx, language, startDiscovery, isScholarship)
          )}
        </div>

        {/* Subtle gradient fade at bottom edge on desktop as visual scroll affordance */}
        <div
          className="pointer-events-none absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-white/90 via-white/50 to-transparent rounded-b-xl hidden min-[900px]:block"
          aria-hidden="true"
        />
      </div>

      {/* Subtle down-chevron scroll affordance */}
      <div className="hidden min-[900px]:flex items-center justify-between mt-2.5 pt-2 border-t border-[#004D40]/5 text-[10px] text-[#004D40]/60 select-none">
        <span className="flex items-center gap-1 font-medium">
          <ChevronDown className="w-3 h-3 text-[#FF6B35] animate-bounce" />
          <span>
            {language === 'hi'
              ? (isScholarship ? 'अन्य 2 छात्रवृत्तियां देखने के लिए नीचे स्क्रॉल करें' : 'अन्य 2 योजनाएं देखने के लिए नीचे स्क्रॉल करें')
              : (isScholarship ? 'Scroll inside box for more (3 scholarships)' : 'Scroll inside box for more (3 schemes)')}
          </span>
        </span>
        <span className="font-semibold text-[#004D40]/70">1 / 3</span>
      </div>
    </div>
  );
};

// 4. BROWSE BY CATEGORY: Strictly preserved untouched in functionality & styling, mode-adaptive
export const BrowseByCategorySection: React.FC = () => {
  const { language, contentMode, user, startDiscovery } = useAppStore();
  const t = translations[language];
  const isScholarship = contentMode === 'scholarships';
  const allItems = (isScholarship ? scholarshipsRaw : schemesRaw) as SchemeWithExtras[];

  const [selectedTag, setSelectedTag] = useState<string>(() => getPrehighlightedTag(user, isScholarship));

  // Reset tag when contentMode changes
  useEffect(() => {
    setSelectedTag(getPrehighlightedTag(user, isScholarship));
  }, [contentMode, user]);

  const schemeFilters = [
    { id: 'all', label: t.rec_tag_all, tag: 'all' },
    { id: 'women', label: t.rec_tag_women, tag: 'women' },
    { id: 'sc_st', label: t.rec_tag_sc_st, tag: 'sc_st' },
    { id: 'artisan', label: t.rec_tag_artisan, tag: 'artisan' },
    { id: 'vendor', label: t.rec_tag_vendor, tag: 'street_vendor' },
    { id: 'agriculture', label: t.rec_tag_agriculture, tag: 'agriculture' },
    { id: 'msme', label: t.rec_tag_msme, tag: 'msme' },
  ];

  const scholarshipFilters = [
    { id: 'all', label: language === 'hi' ? 'सभी छात्रवृत्तियां' : 'All Scholarships', tag: 'all' },
    { id: 'pre_matric', label: language === 'hi' ? 'कक्षा 9-10 (Pre-Matric)' : 'Pre-Matric (9th-10th)', tag: 'pre_matric' },
    { id: 'post_matric', label: language === 'hi' ? 'कक्षा 11-12 व कॉलेज' : 'Post-Matric (11th-12th & UG)', tag: 'post_matric' },
    { id: 'higher_ed', label: language === 'hi' ? 'स्नातक व उच्च शिक्षा' : 'Higher Education & Degree', tag: 'higher_ed' },
    { id: 'technical', label: language === 'hi' ? 'इंजीनियरिंग व तकनीकी' : 'Engineering & Technical', tag: 'technical' },
    { id: 'women', label: language === 'hi' ? 'बालिका एवं छात्रा' : 'Girls & Women', tag: 'women' },
    { id: 'sc_st', label: language === 'hi' ? 'SC / ST / आरक्षित' : 'SC / ST / Reserved', tag: 'sc_st' },
  ];

  const categoryFilters = isScholarship ? scholarshipFilters : schemeFilters;

  const filteredByCategory = useMemo(() => {
    if (selectedTag === 'all') return allItems.slice(0, 4);
    return allItems
      .filter((s) => s.category_tags && s.category_tags.includes(selectedTag))
      .slice(0, 4);
  }, [selectedTag, allItems]);

  return (
    <div className="bg-white border border-[#004D40]/15 rounded-2xl p-5 sm:p-6 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-bold text-[#004D40] flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#FF6B35]" />
          <span>
            {isScholarship
              ? (language === 'hi' ? 'कक्षा एवं श्रेणी अनुसार छात्रवृत्तियां' : 'Browse Scholarships by Level & Category')
              : t.rec_browse_category_title}
          </span>
        </h3>
        {selectedTag !== 'all' && (
          <span className="text-[11px] text-[#004D40]/60 font-medium">
            {language === 'hi' ? 'आपकी प्रोफ़ाइल से प्री-फ़िल्टर' : 'Pre-filtered from profile'}
          </span>
        )}
      </div>

      {/* Category Chips Scroll / Grid */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categoryFilters.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedTag(cat.tag)}
            className={`touch-target px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedTag === cat.tag
                ? 'bg-[#004D40] text-white shadow-xs'
                : 'bg-[#004D40]/5 hover:bg-[#004D40]/10 text-[#004D40]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Filtered Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {filteredByCategory.map((scheme) => (
          <div
            key={scheme.id}
            className="p-4 rounded-xl border border-[#004D40]/10 hover:border-[#004D40]/30 transition-all flex flex-col justify-between bg-white"
          >
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#004D40]/10 text-[#004D40]">
                  {scheme.ministry.split('(')[0]}
                </span>
                {scheme.benefits.benefit_percentage && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                    {scheme.benefits.benefit_percentage}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-gray-900">
                {language === 'hi' ? scheme.hindi_name : scheme.name}
              </h4>
              <p className="text-xs text-[#FF6B35] font-semibold mt-1 line-clamp-2">
                {language === 'hi' ? scheme.hindi_benefit_headline : scheme.benefit_headline}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-[#004D40]/10 flex items-center justify-between">
              <a
                href={scheme.official_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#004D40]/70 hover:text-[#004D40] font-semibold flex items-center gap-1"
              >
                <span>Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={() => startDiscovery(scheme.name)}
                className="touch-target px-3 py-1 rounded-lg bg-[#004D40] hover:bg-[#00382e] text-xs font-bold text-white cursor-pointer"
              >
                {language === 'hi' ? 'पात्रता जांचें' : 'Check Eligibility'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 5. CLASSIC STACKED LAYOUT: Preserved recoverable fallback
export const ClassicStackedRecommendations: React.FC = () => {
  const { language, contentMode, user, startDiscovery } = useAppStore();
  const t = translations[language];
  const isScholarship = contentMode === 'scholarships';
  const userState = user?.state || null;

  const [didYouKnowIdx, setDidYouKnowIdx] = useState(0);
  const [isFactHovered, setIsFactHovered] = useState(false);

  const activeFacts = isScholarship ? DID_YOU_KNOW_SCHOLARSHIP_FACTS : DID_YOU_KNOW_FACTS;
  const allItems = (isScholarship ? scholarshipsRaw : schemesRaw) as SchemeWithExtras[];

  useEffect(() => {
    setDidYouKnowIdx(0);
  }, [contentMode]);

  useEffect(() => {
    if (isFactHovered) return;
    const timer = setInterval(() => {
      setDidYouKnowIdx((prev) => (prev + 1) % activeFacts.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isFactHovered, activeFacts.length]);

  const popularInState = useMemo(() => {
    if (userState) {
      const stateMatches = allItems.filter(
        (s) =>
          !s.applicable_states ||
          s.applicable_states.includes('All India') ||
          s.applicable_states.includes('All') ||
          s.applicable_states.includes(userState)
      );
      return [...stateMatches]
        .sort((a, b) => (b.popularity_score || 80) - (a.popularity_score || 80))
        .slice(0, 3);
    }
    return [...allItems]
      .sort((a, b) => (b.popularity_score || 80) - (a.popularity_score || 80))
      .slice(0, 3);
  }, [userState, allItems]);

  const trendingSchemes = useMemo(() => {
    return [...allItems]
      .sort((a, b) => (b.popularity_score || 80) - (a.popularity_score || 80))
      .slice(0, 3);
  }, [allItems]);

  const newThisMonth = useMemo(() => {
    return [...allItems]
      .filter((s) => s.date_added)
      .sort((a, b) => new Date(b.date_added || '').getTime() - new Date(a.date_added || '').getTime())
      .slice(0, 3);
  }, [allItems]);

  const currentFact = activeFacts[didYouKnowIdx % activeFacts.length];
  const nextFact = () => setDidYouKnowIdx((prev) => (prev + 1) % activeFacts.length);
  const prevFact = () => setDidYouKnowIdx((prev) => (prev - 1 + activeFacts.length) % activeFacts.length);

  return (
    <div className="space-y-8 mt-12 mb-10 w-full">
      {/* 1. DID YOU KNOW? */}
      <div
        onMouseEnter={() => setIsFactHovered(true)}
        onMouseLeave={() => setIsFactHovered(false)}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#004D40] to-[#00695C] text-white p-5 sm:p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35] bg-white/10 px-3 py-1 rounded-full w-fit">
            <Lightbulb className="w-4 h-4 text-[#FFB74D]" />
            <span>{isScholarship ? (language === 'hi' ? 'क्या आप जानते हैं?' : 'Did You Know?') : t.rec_did_you_know_title}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={prevFact}
              className="touch-target p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Previous fact"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-white/70 font-mono px-1">
              {didYouKnowIdx + 1}/{activeFacts.length}
            </span>
            <button
              type="button"
              onClick={nextFact}
              className="touch-target p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Next fact"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm sm:text-base text-emerald-50 leading-relaxed font-medium">
          {language === 'hi' ? currentFact.hi : currentFact.en}
        </p>

        <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between">
          <span className="text-xs text-white/70">
            {isScholarship ? 'Official Scholarship Information' : 'Official Government Policy Highlight'}
          </span>
          <button
            type="button"
            onClick={() => {
              const target = allItems.find((s) => s.id === currentFact.schemeId);
              if (target) startDiscovery(target.name);
            }}
            className="touch-target px-3 py-1.5 rounded-lg bg-[#FF6B35] hover:bg-[#e05a28] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>
              {isScholarship
                ? (language === 'hi' ? 'छात्रवृत्ति देखें' : 'View Scholarship')
                : (language === 'hi' ? 'योजना का विवरण देखें' : 'View Scheme')}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Popular in Your State */}
      <div className="bg-white border border-[#004D40]/15 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold text-[#004D40] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#FF6B35]" />
            <span>
              {userState
                ? (isScholarship
                    ? (language === 'hi' ? `${userState} में लोकप्रिय छात्रवृत्तियां` : `Popular Scholarships in ${userState}`)
                    : t.rec_popular_state_title.replace('{state}', userState))
                : (isScholarship
                    ? (language === 'hi' ? 'पूरे भारत में लोकप्रिय छात्रवृत्तियां' : 'Popular Scholarships Across India')
                    : (language === 'hi' ? 'पूरे भारत में लोकप्रिय योजनाएं' : 'Popular in India'))}
            </span>
          </h3>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#004D40]/10 text-[#004D40]">
            {userState ? (isScholarship ? `${userState} Quota` : 'State Quotas') : 'All States'}
          </span>
        </div>
        <div className="space-y-3">
          {popularInState.map((scheme) =>
            renderPopularSchemeCard(scheme, language, t, startDiscovery, isScholarship)
          )}
        </div>
      </div>

      {/* 3. Trending Across India */}
      <div className="bg-white border border-[#004D40]/15 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold text-[#004D40] flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#FF6B35]" />
            <span>
              {isScholarship
                ? (language === 'hi' ? 'ट्रेंडिंग छात्रवृत्तियां' : 'Trending Scholarships')
                : t.rec_trending_title}
            </span>
          </h3>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35]">
            Trending Now
          </span>
        </div>
        <div className="space-y-3">
          {trendingSchemes.map((scheme, idx) =>
            renderTrendingSchemeCard(scheme, idx, language, startDiscovery, isScholarship)
          )}
        </div>
      </div>

      {/* 4. Browse by Category */}
      <BrowseByCategorySection />

      {/* 5. New This Month */}
      <div className="bg-white border border-[#004D40]/15 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold text-[#004D40] flex items-center gap-2">
            {isScholarship ? <GraduationCap className="w-4 h-4 text-[#FF6B35]" /> : <Calendar className="w-4 h-4 text-[#FF6B35]" />}
            <span>
              {isScholarship
                ? (language === 'hi' ? 'हाल ही में जोड़ी गई छात्रवृत्तियां' : 'New Scholarships This Month')
                : t.rec_new_month_title}
            </span>
          </h3>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {isScholarship ? 'Open Applications 2025-26' : 'Verified 2025 Policies'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {newThisMonth.map((scheme) =>
            renderNewThisMonthSchemeCard(scheme, language, startDiscovery, isScholarship)
          )}
        </div>
      </div>
    </div>
  );
};

// Default export wrapper for legacy or direct usage
export const RecommendationsCorner: React.FC = () => {
  return <ClassicStackedRecommendations />;
};
