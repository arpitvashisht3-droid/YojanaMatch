import React, { useState } from 'react';
import { ArrowRight, Lock, CheckCircle, AlertCircle, Phone, Mail, User, Sparkles, FileText, Shield } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../lib/translations';

export const SignupScreen: React.FC = () => {
  const { language, signupUser, loginUser, isLoading } = useAppStore();
  const t = translations[language];

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [rememberMe, setRememberMe] = useState(true);
  const [authMethod, setAuthMethod] = useState<'mobile' | 'email'>('email');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);

    const cleanName = name.trim();
    if (mode === 'signup' && !cleanName) {
      setValidationError(t.signup_error_name);
      return;
    }

    let identifier = '';

    if (authMethod === 'mobile') {
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

      if (cleanPhone.length !== 10) {
        setValidationError(t.signup_error_phone);
        return;
      }
      identifier = cleanPhone;
    } else {
      const cleanEmail = email.trim().toLowerCase();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(cleanEmail)) {
        setValidationError(language === 'hi' ? 'कृपया एक मान्य ईमेल पता दर्ज करें' : 'Please enter a valid email address');
        return;
      }
      identifier = cleanEmail;
    }

    if (password && password.length < 6) {
      setValidationError(language === 'hi' ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए' : 'Password must be at least 6 characters long');
      return;
    }

    try {
      if (mode === 'signup') {
        const submitName = cleanName || 'Beneficiary';
        await signupUser(submitName, identifier, password);

        // Reset session state temporarily so user sees account created banner and logs in
        useAppStore.setState({ user: null, currentScreen: 'signup' });
        localStorage.removeItem('ym_session_phone');
        localStorage.removeItem('ym_session_token');

        setSuccessMessage(
          language === 'hi'
            ? 'खाता सफलतापूर्वक बनाया गया! लॉग इन करने के लिए कृपया अपना पासवर्ड दर्ज करें।'
            : 'Account created successfully! Please enter your password below to log in.'
        );
        setPassword('');
        setMode('login');
      } else {
        await loginUser(identifier, password);
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (
        msg.includes('No account found') ||
        msg.includes('create an account first') ||
        msg.includes('no account')
      ) {
        setValidationError(
          language === 'hi'
            ? 'इस ईमेल/मोबाइल नंबर से कोई खाता नहीं मिला। कृपया पहले अपना खाता बनाएं।'
            : 'No account found with this email/phone number. Please create an account first.'
        );
        setMode('signup');
      } else {
        setValidationError(msg || 'Authentication failed. Please check your credentials.');
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col justify-center">
      {/* Mobile-Only Header (< 900px) */}
      <div className="block min-[900px]:hidden mb-5 text-center">
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-[#004D40]/10 p-1 shadow-2xs">
            <img
              src="https://raw.githubusercontent.com/mradvitiyalive-maker/images/main/sd.png"
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
        {/* ================= LEFT COLUMN (30% width) ================= */}
        <div className="hidden min-[900px]:flex flex-col justify-between bg-white border border-[#004D40]/15 rounded-2xl shadow-xs p-6 sm:p-7 space-y-6">
          <div>
            {/* Logo Image */}
            <div className="w-28 h-28 rounded-2xl overflow-hidden bg-white border border-[#004D40]/10 p-1.5 shadow-xs mb-4">
              <img
                src="https://raw.githubusercontent.com/mradvitiyalive-maker/images/main/sd.png"
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
                    {language === 'hi' ? '100% निशुल्क और सुरक्षित' : 'Free & Private'}
                  </strong>
                  <span className="text-[#004D40]/65 text-[11px]">
                    {language === 'hi'
                      ? 'सुरक्षित प्रमाणीकरण और पूर्ण डेटा गोपनीयता।'
                      : 'Secure authentication and complete data privacy.'}
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
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#004D40]">
              {mode === 'login'
                ? (language === 'hi' ? 'लॉग इन करें' : 'Log In')
                : (language === 'hi' ? 'नया खाता बनाएं' : 'Create Account')}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#004D40]/70 leading-relaxed">
              {mode === 'login'
                ? (language === 'hi' ? 'अपनी सहेजी गई योजनाओं तक पहुँचने के लिए लॉग इन करें।' : 'Enter your credentials to log in and access your saved schemes.')
                : (language === 'hi' ? 'योजना मैच का उपयोग करने के लिए नया खाता बनाएं।' : 'Enter your details below to create your YojanaMatch account.')}
            </p>
          </div>

          {/* Account Created Success Banner */}
          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs sm:text-sm text-emerald-800 shadow-xs">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">
                  {language === 'hi' ? 'खाता सफलतापूर्वक बनाया गया!' : 'Account Created Successfully!'}
                </strong>
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          {/* Validation / Server Error Banner */}
          {validationError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs sm:text-sm text-red-700">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

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
              {/* Auth Method Tab Toggle */}
              <div className="flex bg-[#004D40]/5 rounded-xl p-1 border border-[#004D40]/10 mb-3">
                <button
                  type="button"
                  onClick={() => { setAuthMethod('mobile'); setValidationError(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    authMethod === 'mobile' ? 'bg-white shadow-2xs text-[#004D40]' : 'text-[#004D40]/60'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'मोबाइल नंबर' : 'Mobile Number'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMethod('email'); setValidationError(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    authMethod === 'email' ? 'bg-white shadow-2xs text-[#004D40]' : 'text-[#004D40]/60'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'ईमेल' : 'Email'}</span>
                </button>
              </div>

              {authMethod === 'mobile' ? (
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
              ) : (
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-1.5">
                    {language === 'hi' ? 'ईमेल पता' : 'Email Address'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#004D40]/40">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={language === 'hi' ? 'aapka.email@example.com' : 'your.email@example.com'}
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#004D40]/20 bg-white text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#004D40] focus:ring-2 focus:ring-[#004D40]/10 transition-colors"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#004D40] mb-1.5">
                {language === 'hi' ? 'पासवर्ड' : 'Password'}{' '}
                {mode === 'signup' ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">({language === 'hi' ? 'वैकल्पिक' : 'Optional'})</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#004D40]/40">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'signup'
                      ? (language === 'hi' ? 'सुरक्षित पासवर्ड बनाएं (कम से कम 6 अक्षर)' : 'Create a password (min 6 chars)')
                      : (language === 'hi' ? 'अपना पासवर्ड दर्ज करें' : 'Enter your password')
                  }
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-[#004D40]/20 bg-white text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#004D40] focus:ring-2 focus:ring-[#004D40]/10 transition-colors"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#004D40]/30 text-[#FF6B35] focus:ring-[#FF6B35]/30 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-[#004D40]/80 font-medium">
                {language === 'hi' ? 'मुझे याद रखें' : 'Remember me'}
              </span>
            </label>

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
                      ? (language === 'hi' ? 'खाता बनाएं' : 'Create Account')
                      : (language === 'hi' ? 'लॉग इन करें' : 'Log In')}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Bottom Mode Switcher Link */}
            <div className="mt-3 text-center pt-1">
              {mode === 'login' ? (
                <p className="text-xs sm:text-sm text-[#004D40]/80">
                  {language === 'hi' ? 'खाता नहीं है? ' : "Don't have an account? "}
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setValidationError(null); setSuccessMessage(null); }}
                    className="font-bold text-[#FF6B35] hover:underline cursor-pointer ml-1"
                  >
                    {language === 'hi' ? 'नया खाता बनाएं' : 'Create Account'}
                  </button>
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-[#004D40]/80">
                  {language === 'hi' ? 'पहले से खाता है? ' : 'Already have an account? '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setValidationError(null); setSuccessMessage(null); }}
                    className="font-bold text-[#FF6B35] hover:underline cursor-pointer ml-1"
                  >
                    {language === 'hi' ? 'लॉग इन करें' : 'Log In'}
                  </button>
                </p>
              )}
            </div>
          </form>

          {/* Trust Badges */}
          <div className="mt-6 pt-5 border-t border-[#004D40]/10">
            <div className="flex items-start gap-2 text-xs text-[#004D40]/70 leading-normal">
              <Lock className="w-4 h-4 text-[#004D40]/60 shrink-0 mt-0.5" />
              <span>{t.signup_trust_badge}</span>
            </div>

            <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-[#004D40]/60 font-medium">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                No OTP or Password
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
