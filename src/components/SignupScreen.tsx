import React, { useState } from 'react';
import { ArrowRight, Lock, CheckCircle, AlertCircle, Phone, User, Sparkles, FileText, Shield, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';

export const SignupScreen: React.FC = () => {
  const { language, signup, login, isLoading } = useAppStore();
  const t = translations[language];

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Normalize phone digits
    const digits = phone.replace(/\D/g, '');
    let cleanPhone = digits;
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.slice(1);
    } else if (cleanPhone.length > 10) {
      cleanPhone = cleanPhone.slice(-10);
    }

    if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setValidationError(
        language === 'hi'
          ? 'कृपया एक मान्य 10-अंकीय भारतीय मोबाइल नंबर दर्ज करें (6-9 से शुरू)'
          : 'Please enter a valid 10-digit Indian mobile number (starting with 6-9)'
      );
      return;
    }

    if (!password || password.length < 6) {
      setValidationError(
        language === 'hi'
          ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए'
          : 'Password must be at least 6 characters long'
      );
      return;
    }

    if (mode === 'signup') {
      const cleanName = name.trim();
      if (!cleanName || cleanName.length < 2) {
        setValidationError(
          language === 'hi'
            ? 'कृपया अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)'
            : 'Please enter your full name (minimum 2 characters)'
        );
        return;
      }

      try {
        await signup(cleanName, cleanPhone, password);
      } catch (err: any) {
        setValidationError(err.message || 'Error signing up. Please try again.');
      }
    } else {
      try {
        await login(cleanPhone, password);
      } catch (err: any) {
        setValidationError(err.message || 'Invalid mobile number or password.');
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col justify-center">
      {/* Mobile-Only Header (< 900px) */}
      <div className="block min-[900px]:hidden mb-5 text-center">
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-[#004D40]/10 p-0.5 shadow-2xs">
            <img
              src="https://raw.githubusercontent.com/mradvitiyalive-maker/logo/main/yml2.jpg"
              alt="YojanaMatch logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-extrabold text-[#004D40] tracking-tight leading-none">
              YojanaMatch
            </h1>
            <p className="text-[11px] text-[#004D40]/70 font-medium mt-1">
              {language === 'hi'
                ? 'वंचित उद्यमियों एवं छात्रों के लिए योजना मंच'
                : 'Voice-First Government Schemes Platform'}
            </p>
          </div>
        </div>
      </div>

      {/* 30/70 Responsive Grid Container */}
      <div className="grid grid-cols-1 min-[900px]:grid-cols-[32%_1fr] gap-6 sm:gap-8 items-stretch">
        {/* ================= LEFT COLUMN (30% width, desktop/tablet >= 900px) ================= */}
        <div className="hidden min-[900px]:flex flex-col justify-between bg-white border border-[#004D40]/15 rounded-2xl shadow-xs p-6 sm:p-7 space-y-6">
          <div>
            {/* Logo Image */}
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-[#004D40]/10 p-1 shadow-xs mb-4">
              <img
                src="https://raw.githubusercontent.com/mradvitiyalive-maker/logo/main/yml2.jpg"
                alt="YojanaMatch logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Wordmark & Tagline */}
            <h2 className="text-2xl font-extrabold text-[#004D40] tracking-tight">
              YojanaMatch
            </h2>
            <p className="mt-1.5 text-xs text-[#004D40]/75 leading-relaxed font-medium">
              {language === 'hi'
                ? 'वंचित उद्यमियों एवं युवाओं के लिए भारत का अग्रणी योजना खोज मंच।'
                : 'Voice-first Indian government schemes discovery platform.'}
            </p>

            {/* 3-Point Value Proposition */}
            <div className="mt-6 pt-5 border-t border-[#004D40]/10 space-y-3.5 text-xs text-[#004D40]/80">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="block text-[#004D40] font-bold">
                    {language === 'hi' ? 'पात्रता आधारित खोज' : 'Find Schemes You Qualify For'}
                  </strong>
                  <span className="text-[#004D40]/65 text-[11px]">
                    {language === 'hi'
                      ? 'बिना किसी भ्रामक जानकारी के केवल वही योजनाएं जो आपके लिए हैं।'
                      : 'Verified matching based on your real background.'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-[#004D40]/10 text-[#004D40] flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="block text-[#004D40] font-bold">
                    {language === 'hi' ? 'सरल भाषा, शून्य कागजी उलझन' : 'No Paperwork Jargon'}
                  </strong>
                  <span className="text-[#004D40]/65 text-[11px]">
                    {language === 'hi'
                      ? 'आसान वॉयस व टेक्स्ट के साथ योजनाओं की सीधी जानकारी।'
                      : 'Plain explanations in Hindi & English with audio support.'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="block text-[#004D40] font-bold">
                    {language === 'hi' ? '100% सुरक्षित और निजी' : 'Secure & Private'}
                  </strong>
                  <span className="text-[#004D40]/65 text-[11px]">
                    {language === 'hi'
                      ? 'सुरक्षित प्रमाणीकरण एवं एन्क्रिप्टेड डेटा सुरक्षा।'
                      : 'Industry standard JWT auth with bcrypt password security.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#004D40]/10 text-[11px] text-[#004D40]/60 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Smart India Hackathon MVP</span>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (70% width, Interactive Form) ================= */}
        <div className="bg-white border border-[#004D40]/15 rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col justify-center">
          {/* Sign Up / Log In Tabs */}
          <div className="flex bg-[#004D40]/5 rounded-xl p-1 mb-6 border border-[#004D40]/10">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setValidationError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-[#004D40] shadow-2xs'
                  : 'text-[#004D40]/60 hover:text-[#004D40]'
              }`}
            >
              {language === 'hi' ? 'नया खाता बनाएं (Sign Up)' : 'Create Account (Sign Up)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setValidationError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#004D40] shadow-2xs'
                  : 'text-[#004D40]/60 hover:text-[#004D40]'
              }`}
            >
              {language === 'hi' ? 'लॉग इन करें (Log In)' : 'Log In'}
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#004D40]">
              {mode === 'signup'
                ? (language === 'hi' ? 'योजना मैच में खाता बनाएं' : 'Join YojanaMatch')
                : (language === 'hi' ? 'वापसी पर स्वागत है' : 'Welcome Back')}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#004D40]/70 leading-relaxed">
              {mode === 'signup'
                ? (language === 'hi'
                    ? 'सरकारी योजनाओं व छात्रवृत्तियों की खोज के लिए अपना विवरण दर्ज करें।'
                    : 'Discover central and state government schemes tailored for you.')
                : (language === 'hi'
                    ? 'अपने पंजीकृत मोबाइल नंबर और पासवर्ड से लॉग इन करें।'
                    : 'Log in with your registered mobile number and password.')}
            </p>
          </div>

          {/* Validation / Server Error Banner */}
          {validationError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs sm:text-sm text-red-700">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-1.5">
                  {t.signup_name_label} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#004D40]/40">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.signup_name_placeholder}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#004D40]/20 bg-white text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#004D40] focus:ring-2 focus:ring-[#004D40]/10 transition-colors"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-1.5">
                {t.signup_phone_label} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#004D40]/40">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="absolute inset-y-0 left-9 flex items-center pointer-events-none text-xs font-bold text-[#004D40]/60 pr-1">
                  +91
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.signup_phone_placeholder}
                  maxLength={14}
                  className="w-full pl-18 pr-3.5 py-3 rounded-xl border border-[#004D40]/20 bg-white text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#004D40] focus:ring-2 focus:ring-[#004D40]/10 transition-colors tracking-wide"
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-1.5">
                {language === 'hi' ? 'पासवर्ड' : 'Password'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#004D40]/40">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'signup'
                      ? (language === 'hi' ? 'कम से कम 6 अक्षर' : 'At least 6 characters')
                      : (language === 'hi' ? 'अपना पासवर्ड दर्ज करें' : 'Enter your password')
                  }
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#004D40]/20 bg-white text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#004D40] focus:ring-2 focus:ring-[#004D40]/10 transition-colors"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#004D40]/40 hover:text-[#004D40] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Continue Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="touch-target w-full mt-2 py-3.5 px-6 rounded-xl bg-[#FF6B35] hover:bg-[#e05a28] text-white font-bold text-base flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'signup'
                      ? (language === 'hi' ? 'साइन अप करें और आगे बढ़ें' : 'Sign Up & Continue')
                      : (language === 'hi' ? 'लॉग इन करें' : 'Log In & Continue')}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Tab Footer */}
          <div className="mt-4 text-center">
            {mode === 'signup' ? (
              <p className="text-xs text-[#004D40]/70">
                {language === 'hi' ? 'पहले से खाता है?' : 'Already registered?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setValidationError(null);
                  }}
                  className="font-bold text-[#FF6B35] hover:underline cursor-pointer"
                >
                  {language === 'hi' ? 'यहाँ लॉग इन करें' : 'Log In here'}
                </button>
              </p>
            ) : (
              <p className="text-xs text-[#004D40]/70">
                {language === 'hi' ? 'नया उपयोगकर्ता?' : 'New user?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setValidationError(null);
                  }}
                  className="font-bold text-[#FF6B35] hover:underline cursor-pointer"
                >
                  {language === 'hi' ? 'यहाँ खाता बनाएं' : 'Create an account'}
                </button>
              </p>
            )}
          </div>

          {/* Trust Badges */}
          <div className="mt-6 pt-5 border-t border-[#004D40]/10">
            <div className="flex items-start gap-2 text-xs text-[#004D40]/70 leading-normal">
              <Lock className="w-4 h-4 text-[#004D40]/60 shrink-0 mt-0.5" />
              <span>
                {language === 'hi'
                  ? 'आपकी जानकारी सुरक्षित टोकन (JWT) और एन्क्रिप्टेड सुरक्षा के साथ सुरक्षित है।'
                  : 'Your information is secured with industry-standard encrypted credentials and JWT tokens.'}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-[#004D40]/60 font-medium">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Secure Login
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                100% Free Access
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

