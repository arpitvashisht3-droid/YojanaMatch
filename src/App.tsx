import React, { useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingScreen } from './components/LandingScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { FollowUpChatScreen } from './components/FollowUpChatScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { AboutScreen } from './components/AboutScreen';
import { SignupScreen } from './components/SignupScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { SavedSchemesScreen } from './components/SavedSchemesScreen';
import { useAppStore, BG_THEME_COLORS } from './store/useAppStore';

export default function App() {
  const { currentScreen, isLoading, language, isAuthChecking, initAuthSession, user, bgTheme } = useAppStore();

  useEffect(() => {
    initAuthSession();
  }, [initAuthSession]);

  // Initial session hydration
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] text-[#004D40]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-white border border-[#004D40]/10 p-1.5 shadow-xs">
            <img
              src="https://raw.githubusercontent.com/mradvitiyalive-maker/images/main/sd.png"
              alt="YojanaMatch logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="w-6 h-6 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-wide uppercase text-[#004D40]/60">
            {language === 'hi' ? 'लोड हो रहा है...' : 'Loading YojanaMatch...'}
          </span>
        </div>
      </div>
    );
  }

  // Mandatory Sign-Up Gate: if no user is signed in, force Signup screen
  const effectiveScreen = !user
    ? 'signup'
    : !user.onboarding_completed && currentScreen !== 'about'
    ? 'onboarding'
    : currentScreen;

  return (
    <div
      className="min-h-screen flex flex-col text-[#004D40] antialiased selection:bg-[#FF6B35]/20 selection:text-[#FF6B35] transition-colors duration-300"
      style={{ backgroundColor: BG_THEME_COLORS[bgTheme] }}
    >
      {/* Top Navbar with Language Toggle and User Profile */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start w-full">
        {isLoading ? (
          <LoadingScreen />
        ) : (
          <>
            {effectiveScreen === 'signup' && <SignupScreen />}
            {effectiveScreen === 'onboarding' && <OnboardingScreen />}
            {effectiveScreen === 'landing' && <LandingScreen />}
            {effectiveScreen === 'followup' && <FollowUpChatScreen />}
            {effectiveScreen === 'results' && <ResultsScreen />}
            {effectiveScreen === 'about' && <AboutScreen />}
            {effectiveScreen === 'profile' && <ProfileScreen />}
            {effectiveScreen === 'saved' && <SavedSchemesScreen />}
          </>
        )}
      </main>

      {/* Professional Polish Footer */}
      <footer className="w-full bg-[#004D40] text-white py-5 px-4 sm:px-8 mt-auto border-t border-[#004D40]/20">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B35]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#00A86B]"></span>
            </div>
            <span className="font-bold tracking-tight">YojanaMatch (योजना मैच)</span>
            <span className="text-white/40">|</span>
            <span className="text-white/80">
              {language === 'hi' ? 'स्मार्ट इंडिया हैकाथॉन एमवीपी' : 'Smart India Hackathon MVP'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-white/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{language === 'hi' ? 'भाषिणी वॉयस एवं पात्रता इंजन सक्रिय' : 'Voice & Deterministic Engine Active'}</span>
            </div>
            <span>•</span>
            <span>{language === 'hi' ? '100% निशुल्क एवं सुरक्षित' : '100% Free & Open'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
