import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Info, Home, User, LogOut, Bookmark, Globe, ChevronDown, Check, Users as UsersIcon } from 'lucide-react';
import type { AppLanguage } from '../types';

const LANGUAGE_OPTIONS: { code: AppLanguage; short: string; label: string }[] = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'hi', short: 'हिं', label: 'हिन्दी' },
  { code: 'mr', short: 'मरा', label: 'मराठी' },
  { code: 'te', short: 'తె', label: 'తెలుగు' },
];
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';

export const Navbar: React.FC = () => {
  const { language, setLanguage, contentMode, setContentMode, currentScreen, navigateTo, user, logout, bookmarkedSchemeIds } = useAppStore();
  const t = translations[language];

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const currentLang = LANGUAGE_OPTIONS.find((o) => o.code === language) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!langMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [langMenuOpen]);

  const handleBrandClick = () => {
    if (!user) {
      navigateTo('signup');
    } else if (!user.onboarding_completed) {
      navigateTo('onboarding');
    } else {
      navigateTo('landing');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#004D40]/10 shadow-xs px-4 py-3 sm:px-8">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Title */}
        <button
          onClick={handleBrandClick}
          className="flex items-center gap-2.5 sm:gap-3 text-left group focus:outline-none cursor-pointer"
          aria-label="Go to YojanaMatch home"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-[#004D40]/10 shadow-xs group-hover:scale-105 transition-transform p-1 shrink-0">
            <img
              src="https://raw.githubusercontent.com/mradvitiyalive-maker/images/main/sd.png"
              alt="YojanaMatch logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-[#004D40]">
                YojanaMatch
              </span>
              <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35] font-bold">
                {contentMode === 'scholarships' ? (language === 'hi' ? 'छात्रवृत्ति' : 'Scholarships') : (language === 'hi' ? 'योजना' : 'Schemes')}
              </span>
            </div>
            <p className="text-[11px] text-[#004D40]/60 hidden sm:block font-medium">
              {contentMode === 'scholarships'
                ? (language === 'hi' ? 'छात्रों एवं युवाओं के लिए सरकारी छात्रवृत्तियां' : 'Government Scholarships for Students & Youth')
                : (language === 'hi' ? 'वंचित उद्यमियों के लिए योजनाएं' : 'Govt Schemes for Marginalized Entrepreneurs')}
            </p>
          </div>
        </button>

        {/* Right Actions: User info, Navigation & Segmented Mode/Language Toggles */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Segmented Mode Toggle: Schemes | Scholarships */}
          <div
            id="header-content-mode-toggle"
            className="flex bg-[#004D40]/5 rounded-full p-0.5 border border-[#004D40]/10"
            role="group"
            aria-label="Content Mode Toggle"
          >
            <button
              id="mode-toggle-schemes-btn"
              type="button"
              onClick={() => setContentMode('schemes')}
              className={`touch-target px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer ${
                contentMode === 'schemes'
                  ? 'bg-white shadow-2xs text-[#004D40]'
                  : 'text-[#004D40]/60 hover:text-[#004D40]'
              }`}
            >
              {language === 'hi' ? 'योजनाएं' : 'Schemes'}
            </button>
            <button
              id="mode-toggle-scholarships-btn"
              type="button"
              onClick={() => setContentMode('scholarships')}
              className={`touch-target px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer ${
                contentMode === 'scholarships'
                  ? 'bg-white shadow-2xs text-[#004D40]'
                  : 'text-[#004D40]/60 hover:text-[#004D40]'
              }`}
            >
              {language === 'hi' ? 'छात्रवृत्ति' : 'Scholarships'}
            </button>
          </div>

          {user && (
            <nav className="flex items-center gap-1.5 sm:gap-2">
              {user.onboarding_completed && (
                <button
                  onClick={() => navigateTo('family')}
                  className={`touch-target flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                    currentScreen === 'family'
                      ? 'bg-[#004D40]/10 text-[#004D40]'
                      : 'text-[#004D40]/80 hover:text-[#004D40] hover:bg-[#004D40]/5'
                  }`}
                  title={t.family_nav}
                >
                  <UsersIcon className="w-4 h-4 text-[#FF6B35]" />
                  <span className="hidden lg:inline">{t.family_nav}</span>
                </button>
              )}
              {currentScreen !== 'landing' && user.onboarding_completed && (
                <button
                  onClick={() => navigateTo('landing')}
                  className="touch-target flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-[#004D40] hover:bg-[#004D40]/5 rounded-lg transition-colors cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden md:inline">{t.nav_home}</span>
                </button>
              )}

              {user.onboarding_completed && (
                <button
                  onClick={() => navigateTo('saved')}
                  className={`touch-target relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                    currentScreen === 'saved'
                      ? 'bg-[#004D40]/10 text-[#004D40]'
                      : 'text-[#004D40]/80 hover:text-[#004D40] hover:bg-[#004D40]/5'
                  }`}
                  title={language === 'hi' ? 'सहेजी गई योजनाएं' : 'Saved Schemes'}
                >
                  <Bookmark className="w-4 h-4 text-[#FF6B35]" />
                  <span className="hidden md:inline">{language === 'hi' ? 'सहेजी गई' : 'Saved'}</span>
                  {bookmarkedSchemeIds.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6B35] text-white text-[9px] font-bold flex items-center justify-center">
                      {bookmarkedSchemeIds.length > 9 ? '9+' : bookmarkedSchemeIds.length}
                    </span>
                  )}
                </button>
              )}

              {user.onboarding_completed && (
                <button
                  onClick={() => navigateTo('profile')}
                  className={`touch-target flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                    currentScreen === 'profile'
                      ? 'bg-[#004D40]/10 text-[#004D40]'
                      : 'text-[#004D40]/80 hover:text-[#004D40] hover:bg-[#004D40]/5'
                  }`}
                  title={user.name}
                >
                  <User className="w-4 h-4 text-[#FF6B35]" />
                  <span className="max-w-[90px] sm:max-w-[130px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                </button>
              )}
            </nav>
          )}

          {/* About link */}
          <button
            onClick={() => navigateTo('about')}
            className={`touch-target flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
              currentScreen === 'about'
                ? 'bg-[#004D40]/10 text-[#004D40]'
                : 'text-[#004D40]/70 hover:text-[#004D40] hover:bg-[#004D40]/5'
            }`}
            aria-label="Learn about YojanaMatch"
          >
            <Info className="w-4 h-4" />
            <span className="hidden sm:inline">{t.nav_about}</span>
          </button>

          {/* Language Dropdown */}
          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setLangMenuOpen((o) => !o)}
              className="touch-target flex items-center gap-1.5 bg-[#004D40]/5 border border-[#004D40]/10 rounded-full px-3 py-1.5 text-xs font-bold tracking-wide text-[#004D40] hover:bg-[#004D40]/10 transition-all cursor-pointer"
              aria-haspopup="listbox"
              aria-expanded={langMenuOpen}
              aria-label="Choose language"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{currentLang.short}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {langMenuOpen && (
              <ul
                role="listbox"
                className="absolute right-0 mt-2 w-40 bg-white border border-[#004D40]/10 rounded-xl shadow-lg py-1 z-40"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <li key={opt.code} role="option" aria-selected={language === opt.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setLanguage(opt.code);
                        setLangMenuOpen(false);
                      }}
                      className={`touch-target w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-left cursor-pointer transition-colors ${
                        language === opt.code
                          ? 'bg-[#004D40]/10 text-[#004D40]'
                          : 'text-[#004D40]/80 hover:bg-[#004D40]/5'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {language === opt.code && <Check className="w-4 h-4 text-[#FF6B35]" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
