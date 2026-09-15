import { create } from 'zustand';
import { AppLanguage, AppScreen, ContentMode, MatchedSchemeResult, Scheme, UserProfile, UserRecord } from '../types';
import schemesRaw from '../data/schemes.json';
import scholarshipsRaw from '../data/scholarships.json';
import { matchSchemes } from '../lib/matchingEngine';
import { userRecordToProfile } from '../lib/userProfileHelper';

const SESSION_STORAGE_KEY = 'ym_session_phone';
const TOKEN_STORAGE_KEY = 'ym_session_token';

// ── Background Theme ────────────────────────────────────────────────────────
export type BgTheme = 'original' | 'tan' | 'navy' | 'stone' | 'vanilla';

export const BG_THEME_COLORS: Record<BgTheme, string> = {
  original: '#FAFAF7',
  tan: '#D2B48C',
  navy: '#000080',
  stone: '#CBC3B4',
  vanilla: '#F3E5AB',
};

const BG_THEME_STORAGE_KEY = 'ym_bg_theme';

function loadStoredBgTheme(): BgTheme {
  if (typeof window === 'undefined') return 'original';
  const stored = localStorage.getItem(BG_THEME_STORAGE_KEY);
  if (stored && stored in BG_THEME_COLORS) return stored as BgTheme;
  return 'original';
}

/** Canonical public scheme/scholarship ID (Mongo uses scheme_id / scholarship_id; JSON uses id). */
export function getCanonicalSchemeId(raw: any): string {
  if (raw == null) return '';
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw).trim();
  if (typeof raw === 'object') {
    // Prefer human scheme keys over Mongo ObjectId-looking values.
    const publicId = raw.scheme_id || raw.scholarship_id || raw.id;
    if (publicId != null && String(publicId).trim()) {
      const asStr = String(publicId).trim();
      // If `id` is actually a 24-char hex ObjectId but scheme_id exists, prefer scheme_id.
      const looksLikeObjectId = /^[a-fA-F0-9]{24}$/.test(asStr);
      if (looksLikeObjectId && (raw.scheme_id || raw.scholarship_id)) {
        return String(raw.scheme_id || raw.scholarship_id).trim();
      }
      return asStr;
    }
    if (typeof raw._id === 'string' && raw._id.trim()) return raw._id.trim();
    if (raw._id?.toString) {
      const fromOid = String(raw._id.toString()).trim();
      if (fromOid && fromOid !== '[object Object]') return fromOid;
    }
  }
  return '';
}

/** Ensure matched/API scheme objects always expose `.id` for save/display. */
export function normalizeSchemeRecord(raw: any): Scheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = getCanonicalSchemeId(raw);
  if (!id) return null;
  return {
    ...raw,
    id,
  } as Scheme;
}

function normalizeSavedIdList(entries: any[]): string[] {
  if (!Array.isArray(entries)) return [];
  const out: string[] = [];
  for (const entry of entries) {
    const id = getCanonicalSchemeId(entry);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

function normalizeMatchedResults(results: MatchedSchemeResult[]): MatchedSchemeResult[] {
  return (results || [])
    .map((r) => {
      const scheme = normalizeSchemeRecord(r?.scheme);
      if (!scheme) return null;
      return { ...r, scheme };
    })
    .filter((r): r is MatchedSchemeResult => r !== null);
}

interface AppState {
  language: AppLanguage;
  contentMode: ContentMode;
  currentScreen: AppScreen;
  user: UserRecord | null;
  savedSchemeIds: string[];
  /** Full scheme objects from GET /api/user/saved-schemes (MongoDB source of truth). */
  savedSchemes: Scheme[];
  isSavedSchemesLoading: boolean;
  isAuthChecking: boolean;
  inputText: string;
  isListening: boolean;
  isLoading: boolean;
  loadingMessageKey: string;
  extractedProfile: UserProfile;
  missingFields: (keyof UserProfile)[];
  currentQuestionIndex: number;
  matchedResults: MatchedSchemeResult[];
  expandedCardIds: string[];
  audioPlayingSchemeId: string | null;
  queryCache: Record<string, { profile: UserProfile; results: MatchedSchemeResult[] }>;
  error: string | null;
  recommendationsLayout: '3column' | 'stacked';
  bgTheme: BgTheme;
  bhashiniTranslating: boolean;
  bhashiniError: string | null;
  /**
   * Language the user intends to speak into the mic (independent of UI `language`).
   * Web Speech has no reliable per-result spoken-language detection.
   */
  speechLanguage: AppLanguage;
  /** When set, next discovery should treat inputText as voice transcript in this language. */
  voiceSourceLanguage: AppLanguage | null;

  // Actions
  setLanguage: (lang: AppLanguage) => void;
  setSpeechLanguage: (lang: AppLanguage) => void;
  setContentMode: (mode: ContentMode) => void;
  setInputText: (text: string) => void;
  setIsListening: (val: boolean) => void;
  setRecommendationsLayout: (layout: '3column' | 'stacked') => void;
  setBgTheme: (theme: BgTheme) => void;
  markVoiceInputSource: (lang: AppLanguage) => void;
  clearVoiceInputSource: () => void;
  navigateTo: (screen: AppScreen) => void;
  toggleCard: (schemeId: string) => void;
  setAudioPlaying: (schemeId: string | null) => void;
  startDiscovery: (customText?: string) => Promise<void>;
  answerQuestion: (field: keyof UserProfile, value: any) => Promise<void>;
  skipRemainingQuestions: () => Promise<void>;
  modifyAnswers: () => void;
  resetAll: () => void;
  fetchExplanation: (schemeId: string) => Promise<void>;
  updateExtractedProfileAndRematch: (updates: Partial<UserProfile>) => Promise<void>;
  translateTextWithBhashini: (text: string, sourceLang?: string, targetLang?: string) => Promise<string | null>;
  transliterateTextWithBhashini: (text: string, sourceLang?: string, targetLang?: string) => Promise<string | null>;

  // Saved Schemes Actions (MongoDB / JWT — single source of truth)
  fetchSavedSchemes: () => Promise<void>;
  toggleSaveScheme: (schemeId: string) => Promise<void>;
  isSchemeSaved: (schemeId: string) => boolean;

  // Auth & Onboarding Actions
  initAuthSession: () => Promise<void>;
  loginOrSignup: (name: string, phone: string, authMethod?: 'mobile' | 'email', rememberMe?: boolean) => Promise<{ isNewUser: boolean; user: UserRecord }>;
  signupUser: (name: string, identifier: string, password?: string) => Promise<{ isNewUser: boolean; user: UserRecord }>;
  loginUser: (identifier: string, password?: string) => Promise<{ user: UserRecord }>;
  updateUserProfile: (updates: Partial<UserRecord>) => Promise<UserRecord | null>;
  logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  language: 'en',
  contentMode: 'schemes',
  currentScreen: 'signup',
  user: null,
  savedSchemeIds: [],
  savedSchemes: [],
  isSavedSchemesLoading: false,
  isAuthChecking: true,
  inputText: '',
  isListening: false,
  isLoading: false,
  loadingMessageKey: 'loading_understanding',
  extractedProfile: {},
  missingFields: [],
  currentQuestionIndex: 0,
  matchedResults: [],
  expandedCardIds: [],
  audioPlayingSchemeId: null,
  queryCache: {},
  error: null,
  recommendationsLayout: '3column',
  bgTheme: loadStoredBgTheme(),
  bhashiniTranslating: false,
  bhashiniError: null,
  speechLanguage: 'en',
  voiceSourceLanguage: null,

  setLanguage: (lang) => set({ language: lang }),
  setSpeechLanguage: (lang) => set({ speechLanguage: lang }),
  setContentMode: (mode) => {
    const { contentMode, currentScreen } = get();
    if (contentMode === mode) return;
    set({
      contentMode: mode,
      // If currently viewing results, transition cleanly back to landing for the new mode
      currentScreen: currentScreen === 'results' ? 'landing' : currentScreen,
      matchedResults: [],
      expandedCardIds: [],
      error: null,
    });
  },
  setInputText: (text) => set({ inputText: text, error: null }),
  setIsListening: (val) => set({ isListening: val }),
  setRecommendationsLayout: (layout) => set({ recommendationsLayout: layout }),
  setBgTheme: (theme) => {
    set({ bgTheme: theme });
    try {
      localStorage.setItem(BG_THEME_STORAGE_KEY, theme);
    } catch {
      // Ignored - localStorage unavailable
    }
  },
  markVoiceInputSource: (lang) => set({ voiceSourceLanguage: lang }),
  clearVoiceInputSource: () => set({ voiceSourceLanguage: null }),
  navigateTo: (screen) => set({ currentScreen: screen }),

  initAuthSession: async () => {
    if (get().user) {
      set({ isAuthChecking: false });
      return;
    }
    try {
      const storedPhone = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!storedPhone) {
        set({ user: null, savedSchemeIds: [], savedSchemes: [], currentScreen: 'signup', isAuthChecking: false });
        return;
      }

      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      const headers: Record<string, string> = {};
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch(`/api/auth/me?phone=${encodeURIComponent(storedPhone)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const user: UserRecord = data.user;
          const nextScreen: AppScreen = user.onboarding_completed ? 'landing' : 'onboarding';
          set({
            user,
            savedSchemeIds: normalizeSavedIdList(user.saved_schemes || []),
            currentScreen: nextScreen,
            isAuthChecking: false,
          });
          get().fetchSavedSchemes();
          return;
        }
      }
      // If user not found on backend
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      set({ user: null, savedSchemeIds: [], savedSchemes: [], currentScreen: 'signup', isAuthChecking: false });
    } catch (err) {
      console.warn('Auth session check error:', err);
      set({ isAuthChecking: false, currentScreen: 'signup', savedSchemeIds: [], savedSchemes: [] });
    }
  },

  loginOrSignup: async (name: string, phone: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/signup-or-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone_number: phone }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to authenticate');
      }

      const data = await res.json();
      const user: UserRecord = data.user;
      localStorage.setItem(SESSION_STORAGE_KEY, user.phone_number);
      if (data.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }

      const nextScreen: AppScreen = user.onboarding_completed ? 'landing' : 'onboarding';
      set({
        user,
        savedSchemeIds: normalizeSavedIdList(user.saved_schemes || []),
        currentScreen: nextScreen,
        isLoading: false,
        error: null,
      });

      get().fetchSavedSchemes();

      return { isNewUser: data.isNewUser, user };
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Login failed' });
      throw err;
    }
  },

  signupUser: async (name: string, identifier: string, password?: string) => {
    set({ isLoading: true, error: null });
    try {
      const endpoint = password ? '/api/auth/signup' : '/api/auth/signup-or-login';
      const body = password
        ? { name, phone_number: identifier, password }
        : { name, phone_number: identifier };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create account');
      }

      const data = await res.json();
      set({ isLoading: false, error: null });
      return { isNewUser: true, user: data.user };
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Signup failed' });
      throw err;
    }
  },

  loginUser: async (identifier: string, password?: string) => {
    set({ isLoading: true, error: null });
    try {
      const endpoint = password ? '/api/auth/login' : '/api/auth/signup-or-login';
      const body = password
        ? { phone_number: identifier, password }
        : { phone_number: identifier };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Invalid credentials or password');
      }

      const data = await res.json();
      const user: UserRecord = data.user;
      localStorage.setItem(SESSION_STORAGE_KEY, user.phone_number);
      if (data.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }

      const nextScreen: AppScreen = user.onboarding_completed ? 'landing' : 'onboarding';
      set({
        user,
        savedSchemeIds: normalizeSavedIdList(user.saved_schemes || []),
        currentScreen: nextScreen,
        isLoading: false,
        error: null,
      });

      get().fetchSavedSchemes();
      return { user };
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Login failed' });
      throw err;
    }
  },

  updateUserProfile: async (updates: Partial<UserRecord>) => {
    const { user } = get();
    if (!user) return null;

    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone_number: user.phone_number,
          updates,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedUser: UserRecord = data.user;
        set({ user: updatedUser });
        return updatedUser;
      } else {
        // Optimistic local update fallback
        const localUpdated: UserRecord = { ...user, ...updates };
        set({ user: localUpdated });
        return localUpdated;
      }
    } catch (err) {
      console.warn('Update user profile network error, applying local state:', err);
      const localUpdated: UserRecord = { ...user, ...updates };
      set({ user: localUpdated });
      return localUpdated;
    }
  },

  logout: () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    // Clear legacy localStorage bookmarks if present (MongoDB is the sole source of truth).
    localStorage.removeItem('ym_saved_bookmarks');
    set({
      user: null,
      savedSchemeIds: [],
      savedSchemes: [],
      queryCache: {},
      currentScreen: 'signup',
      extractedProfile: {},
      matchedResults: [],
      inputText: '',
      missingFields: [],
      currentQuestionIndex: 0,
      expandedCardIds: [],
      audioPlayingSchemeId: null,
      error: null,
      voiceSourceLanguage: null,
    });
  },

  fetchSavedSchemes: async () => {
    const { user } = get();
    if (!user) {
      set({ savedSchemeIds: [], savedSchemes: [] });
      return;
    }

    set({ isSavedSchemesLoading: true });
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const phoneParam = user.phone_number ? `?phone=${encodeURIComponent(user.phone_number)}` : '';

      const res = await fetch(`/api/user/saved-schemes${phoneParam}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const ids = normalizeSavedIdList(data.saved_schemes);
        const fromApi = Array.isArray(data.schemes)
          ? data.schemes.map(normalizeSchemeRecord).filter((s: Scheme | null): s is Scheme => !!s)
          : [];

        const have = new Set(fromApi.map((s) => s.id));
        const localAll = [...(schemesRaw as Scheme[]), ...(scholarshipsRaw as Scheme[])];
        const fromLocal = ids
          .filter((id) => !have.has(id))
          .map((id) => localAll.find((s) => getCanonicalSchemeId(s) === id) || null)
          .map((s) => normalizeSchemeRecord(s))
          .filter((s): s is Scheme => !!s);

        const schemes = [...fromApi, ...fromLocal];
        console.debug('[saved-schemes] fetched ids:', ids);
        console.debug('[saved-schemes] resolved schemes:', schemes.map((s) => s.id));
        console.debug(
          '[saved-schemes] unresolved ids:',
          ids.filter((id) => !schemes.some((s) => s.id === id))
        );

        set({ savedSchemeIds: ids, savedSchemes: schemes, isSavedSchemesLoading: false });
      } else {
        set({ isSavedSchemesLoading: false });
      }
    } catch (err) {
      console.warn('Failed to fetch user saved schemes:', err);
      set({ isSavedSchemesLoading: false });
    }
  },

  toggleSaveScheme: async (schemeId: string) => {
    const { user, savedSchemeIds, savedSchemes, matchedResults } = get();
    if (!user || !schemeId) return;

    const cleanId = getCanonicalSchemeId(schemeId);
    if (!cleanId) return;

    const isSaved = savedSchemeIds.includes(cleanId);
    const updatedIds = isSaved
      ? savedSchemeIds.filter((id) => id !== cleanId)
      : [...savedSchemeIds, cleanId];

    let nextSchemes = savedSchemes;
    if (isSaved) {
      nextSchemes = savedSchemes.filter((s) => getCanonicalSchemeId(s) !== cleanId);
    } else if (!savedSchemes.some((s) => getCanonicalSchemeId(s) === cleanId)) {
      const fromResults = matchedResults.find((r) => getCanonicalSchemeId(r.scheme) === cleanId)?.scheme;
      const fromLocal = [...(schemesRaw as Scheme[]), ...(scholarshipsRaw as Scheme[])].find(
        (s) => getCanonicalSchemeId(s) === cleanId
      );
      const normalized = normalizeSchemeRecord(fromResults || fromLocal);
      if (normalized) nextSchemes = [...savedSchemes, normalized];
    }

    set({ savedSchemeIds: updatedIds, savedSchemes: nextSchemes });
    console.debug('[saved-schemes] toggle', { cleanId, nowSaved: !isSaved, savedSchemeIds: updatedIds });

    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const phoneParam = user.phone_number ? `?phone=${encodeURIComponent(user.phone_number)}` : '';

      if (isSaved) {
        const res = await fetch(`/api/user/saved-schemes/${encodeURIComponent(cleanId)}${phoneParam}`, {
          method: 'DELETE',
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.saved_schemes)) {
            const ids = normalizeSavedIdList(data.saved_schemes);
            set({
              savedSchemeIds: ids,
              savedSchemes: nextSchemes.filter((s) => ids.includes(getCanonicalSchemeId(s))),
            });
          }
        } else {
          set({ savedSchemeIds, savedSchemes });
        }
      } else {
        const res = await fetch(`/api/user/saved-schemes${phoneParam}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ scheme_id: cleanId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.saved_schemes)) {
            set({ savedSchemeIds: normalizeSavedIdList(data.saved_schemes), savedSchemes: nextSchemes });
          }
        } else {
          set({ savedSchemeIds, savedSchemes });
        }
      }
    } catch (err) {
      console.warn('Failed to toggle save scheme:', err);
      set({ savedSchemeIds, savedSchemes });
    }
  },

  isSchemeSaved: (schemeId: string) => {
    const cleanId = getCanonicalSchemeId(schemeId);
    return cleanId ? get().savedSchemeIds.includes(cleanId) : false;
  },

  toggleCard: (schemeId) => {
    const { expandedCardIds } = get();
    const isExpanded = expandedCardIds.includes(schemeId);
    set({
      expandedCardIds: isExpanded
        ? expandedCardIds.filter((id) => id !== schemeId)
        : [...expandedCardIds, schemeId],
    });
    if (!isExpanded) {
      get().fetchExplanation(schemeId);
    }
  },

  setAudioPlaying: (schemeId) => set({ audioPlayingSchemeId: schemeId }),

  startDiscovery: async (customText?: string) => {
    let textToAnalyze = customText !== undefined ? customText : get().inputText;
    if (!textToAnalyze.trim()) return;

    const { user, language, queryCache, contentMode, voiceSourceLanguage, speechLanguage } = get();
    const knownProfile = userRecordToProfile(user);

    // Voice pipeline uses explicit speech language (set at mic start), NOT UI language.
    // Chrome Web Speech does not return a detected spoken language on results.
    // Typed/sample paths clear voiceSourceLanguage or pass customText.
    const sourceLangForNmt: AppLanguage | null =
      customText !== undefined || voiceSourceLanguage == null
        ? null
        : voiceSourceLanguage;

    const recognitionLangTag =
      sourceLangForNmt === 'hi' ? 'hi-IN' : sourceLangForNmt === 'en' ? 'en-IN' : null;
    const processingAs =
      sourceLangForNmt == null
        ? 'typed/sample (no voice pipeline)'
        : sourceLangForNmt === 'hi'
          ? 'Hindi voice → transliterate if Roman → NMT hi→en → extract'
          : 'English voice → extract directly';

    console.log('[VOICE] UI language:', language);
    console.log('[VOICE] speech language:', sourceLangForNmt ?? speechLanguage);
    console.log('[VOICE] recognition.lang:', recognitionLangTag ?? '(n/a — not voice)');
    console.log('[VOICE] raw transcript:', textToAnalyze.trim());
    console.log('[VOICE] processing as:', processingAs);

    if (sourceLangForNmt && sourceLangForNmt !== 'en') {
      set({
        isLoading: true,
        loadingMessageKey: 'loading_understanding',
        error: null,
        bhashiniError: null,
      });

      let textForNmt = textToAnalyze.trim();

      // Chrome hi-IN often returns Roman Hindi (Latin), not Devanagari.
      // Existing NMT hi→en ignores Latin Hindi (echoes it). Normalize via
      // BHASHINI IndicXlit (en→hi transliteration) when the transcript is Latin.
      const looksRomanized =
        sourceLangForNmt === 'hi' &&
        /[A-Za-z]/.test(textForNmt) &&
        !/[\u0900-\u097F]/.test(textForNmt);

      if (looksRomanized) {
        console.log('[BHASHINI] transliteration request', {
          url: '/api/bhashini/transliterate',
          text: textForNmt,
          source_language: 'en',
          target_language: 'hi',
        });
        const transliterated = await get().transliterateTextWithBhashini(
          textForNmt,
          'en',
          'hi'
        );
        console.log('[BHASHINI] transliteration response', transliterated);
        if (!transliterated) {
          const failMsg =
            get().bhashiniError ||
            (language === 'hi'
              ? 'भाषिणी लिप्यंतरण विफल रहा। कृपया फिर कोशिश करें या देवनागरी में बोलें/लिखें।'
              : 'BHASHINI transliteration failed. Please try again or type in Devanagari/English.');
          set({
            isLoading: false,
            error: failMsg,
            voiceSourceLanguage: null,
          });
          return;
        }
        textForNmt = transliterated;
      }

      console.log('[BHASHINI] translation request', {
        url: '/api/bhashini/translate',
        text: textForNmt,
        source_language: sourceLangForNmt,
        target_language: 'en',
      });
      const translated = await get().translateTextWithBhashini(
        textForNmt,
        sourceLangForNmt,
        'en'
      );
      console.log('[BHASHINI] translation response', translated);
      if (!translated) {
        const failMsg =
          get().bhashiniError ||
          (language === 'hi'
            ? 'भाषिणी अनुवाद विफल रहा। कृपया फिर कोशिश करें या अंग्रेज़ी में लिखें।'
            : 'BHASHINI translation failed. Please try again or type your query in English.');
        set({
          isLoading: false,
          error: failMsg,
          voiceSourceLanguage: null,
        });
        return;
      }
      textToAnalyze = translated;
      set({ inputText: translated, voiceSourceLanguage: null, error: null });
    } else if (customText === undefined) {
      // English voice or unmarked input — do not call BHASHINI.
      set({ voiceSourceLanguage: null });
    }

    console.log('[DISCOVERY] text sent to extraction', textToAnalyze.trim());

    const cacheKey = `${contentMode}:${language}:${textToAnalyze.trim().toLowerCase()}`;
    const cached = queryCache[cacheKey];

    if (cached) {
      const normalizedCached = normalizeMatchedResults(cached.results);
      set({
        extractedProfile: cached.profile,
        matchedResults: normalizedCached,
        currentScreen: 'results',
        expandedCardIds: normalizedCached.length > 0 ? [normalizedCached[0].scheme.id] : [],
        isLoading: false,
        error: null,
      });
      return;
    }

    set({
      isLoading: true,
      loadingMessageKey: 'loading_understanding',
      error: null,
      inputText: textToAnalyze,
    });

    try {
      // 1. Call extraction API with knownProfile context so AI skips redundant extraction
      let extracted: UserProfile = {};
      try {
        const response = await fetch('/api/extract-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: textToAnalyze,
            language,
            knownProfile,
            mode: contentMode,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          extracted = data.profile || {};
        }
      } catch (err) {
        console.warn('Backend extract error, using local fallback:', err);
      }

      // Merge known profile from onboarding with extracted query profile
      const mergedProfile: UserProfile = {
        ...knownProfile,
        ...extracted,
      };

      set({ extractedProfile: mergedProfile });

      // Determine missing core fields based on mode
      const priorityCheckFields: (keyof UserProfile)[] =
        contentMode === 'scholarships'
          ? ['education_level', 'course_type', 'current_marks_percentage', 'gender', 'caste_category']
          : ['gender', 'caste_category', 'district_type', 'business_type', 'age'];

      const missing: (keyof UserProfile)[] = [];
      for (const field of priorityCheckFields) {
        if (mergedProfile[field] === undefined || mergedProfile[field] === null) {
          missing.push(field);
        }
      }

      // Hard cap to maximum 3 questions
      const cappedMissing = missing.slice(0, 3);

      if (cappedMissing.length > 0) {
        set({
          isLoading: false,
          missingFields: cappedMissing,
          currentQuestionIndex: 0,
          currentScreen: 'followup',
        });
      } else {
        // All fields present -> go directly to matching
        await runMatchingAndResults(mergedProfile, cacheKey, set, get);
      }
    } catch (err: any) {
      console.error('Discovery error:', err);
      const fallbackProfile = { ...knownProfile, ...get().extractedProfile };
      await runMatchingAndResults(fallbackProfile, cacheKey, set, get);
    }
  },

  answerQuestion: async (field: keyof UserProfile, value: any) => {
    const { extractedProfile, missingFields, currentQuestionIndex, inputText, language, contentMode } = get();
    const updatedProfile: UserProfile = {
      ...extractedProfile,
      [field]: value,
    };

    set({ extractedProfile: updatedProfile });

    if (currentQuestionIndex + 1 < missingFields.length) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    } else {
      const cacheKey = `${contentMode}:${language}:${inputText.trim().toLowerCase()}`;
      set({ isLoading: true, loadingMessageKey: 'loading_matching' });
      await runMatchingAndResults(updatedProfile, cacheKey, set, get);
    }
  },

  skipRemainingQuestions: async () => {
    const { extractedProfile, inputText, language, contentMode } = get();
    const cacheKey = `${contentMode}:${language}:${inputText.trim().toLowerCase()}`;
    set({ isLoading: true, loadingMessageKey: 'loading_matching' });
    await runMatchingAndResults(extractedProfile, cacheKey, set, get);
  },

  modifyAnswers: () => {
    set({
      currentScreen: 'landing',
      isLoading: false,
      error: null,
    });
  },

  resetAll: () => {
    set({
      currentScreen: 'landing',
      inputText: '',
      extractedProfile: {},
      missingFields: [],
      currentQuestionIndex: 0,
      matchedResults: [],
      expandedCardIds: [],
      audioPlayingSchemeId: null,
      isLoading: false,
      error: null,
      voiceSourceLanguage: null,
    });
  },

  fetchExplanation: async (schemeId: string) => {
    const { matchedResults, extractedProfile, language, contentMode } = get();
    const target = matchedResults.find((r) => r.scheme.id === schemeId);
    if (!target || target.ai_explanation) return;

    try {
      const res = await fetch('/api/explain-scheme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheme: target.scheme,
          profile: extractedProfile,
          language,
          mode: contentMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.explanation) {
          set({
            matchedResults: matchedResults.map((r) =>
              r.scheme.id === schemeId
                ? { ...r, ai_explanation: data.explanation }
                : r
            ),
          });
        }
      }
    } catch (e) {
      console.warn('Could not fetch AI explanation, fallback already available:', e);
    }
  },

  updateExtractedProfileAndRematch: async (updates: Partial<UserProfile>) => {
    const { extractedProfile, contentMode, language, inputText } = get();
    const updatedProfile: UserProfile = { ...extractedProfile, ...updates };
    set({
      extractedProfile: updatedProfile,
      isLoading: true,
      loadingMessageKey: 'loading_matching',
      error: null,
    });
    const cacheKey = `${contentMode}:${language}:${inputText.trim().toLowerCase()}`;
    await runMatchingAndResults(updatedProfile, cacheKey, set, get);
  },

  translateTextWithBhashini: async (text: string, sourceLang = 'en', targetLang = 'hi'): Promise<string | null> => {
    if (!text || !text.trim()) return null;
    set({ bhashiniTranslating: true, bhashiniError: null });
    try {
      console.log('[BHASHINI] translation request', {
        text,
        source_language: sourceLang,
        target_language: targetLang,
      });
      const res = await fetch('/api/bhashini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          source_language: sourceLang,
          target_language: targetLang,
        }),
      });

      const data = await res.json().catch(() => ({}));
      console.log('[BHASHINI] translation response', { status: res.status, data });

      if (res.ok && data.status === 'success' && data.translated_text) {
        set({ bhashiniTranslating: false, bhashiniError: null });
        return data.translated_text as string;
      }

      if (res.status === 503) {
        const msg =
          data.error ||
          'BHASHINI credentials not configured (503 Service Unavailable).';
        set({ bhashiniTranslating: false, bhashiniError: msg });
        return null;
      }

      set({
        bhashiniTranslating: false,
        bhashiniError: data.error || data.detail || 'BHASHINI translation failed',
      });
      return null;
    } catch (err: any) {
      console.log('[BHASHINI] network error', err);
      set({
        bhashiniTranslating: false,
        bhashiniError: err?.message || 'Translation network error',
      });
      return null;
    }
  },

  transliterateTextWithBhashini: async (text: string, sourceLang = 'en', targetLang = 'hi'): Promise<string | null> => {
    if (!text || !text.trim()) return null;
    set({ bhashiniTranslating: true, bhashiniError: null });
    try {
      console.log('[BHASHINI] transliteration request', {
        text,
        source_language: sourceLang,
        target_language: targetLang,
      });
      const res = await fetch('/api/bhashini/transliterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          source_language: sourceLang,
          target_language: targetLang,
        }),
      });

      const data = await res.json().catch(() => ({}));
      console.log('[BHASHINI] transliteration response', { status: res.status, data });

      if (res.ok && data.status === 'success' && data.transliterated_text) {
        set({ bhashiniTranslating: false, bhashiniError: null });
        return data.transliterated_text as string;
      }

      if (res.status === 503) {
        const msg =
          data.error ||
          'BHASHINI credentials not configured (503 Service Unavailable).';
        set({ bhashiniTranslating: false, bhashiniError: msg });
        return null;
      }

      set({
        bhashiniTranslating: false,
        bhashiniError: data.error || data.detail || 'BHASHINI transliteration failed',
      });
      return null;
    } catch (err: any) {
      console.log('[BHASHINI] transliteration network error', err);
      set({
        bhashiniTranslating: false,
        bhashiniError: err?.message || 'Transliteration network error',
      });
      return null;
    }
  },
}));

// Helper to run deterministic matching and transition to results
async function runMatchingAndResults(
  profile: UserProfile,
  cacheKey: string,
  set: any,
  get: () => AppState
) {
  const { contentMode, language } = get();
  set({ isLoading: true, loadingMessageKey: 'loading_matching' });

  // Pure deterministic rule-based matching
  let results: MatchedSchemeResult[] = [];
  const activeRawDataset = contentMode === 'scholarships' ? scholarshipsRaw : schemesRaw;
  const activeCategoryType = contentMode === 'scholarships' ? 'scholarship' : 'scheme';

  try {
    const res = await fetch('/api/match-schemes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        category_type: activeCategoryType,
        mode: contentMode,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      results = normalizeMatchedResults(data.results || []);
      console.debug('[match-schemes] API returned', data.total_matches, 'matches');
    } else {
      const errData = await res.json().catch(() => ({}));
      console.error('[match-schemes] API error', res.status, errData);
      if (res.status === 503) {
        // Database unavailable — surface this to the user rather than silently showing empty
        set({
          isLoading: false,
          error: errData.detail || errData.error || 'The matching service is temporarily unavailable. Please try again in a moment.',
          matchedResults: [],
          expandedCardIds: [],
          currentScreen: 'results',
        });
        return;
      }
      // For other non-fatal errors fall back to local data
      results = normalizeMatchedResults(matchSchemes(profile, activeRawDataset as any, activeCategoryType));
    }
  } catch (fetchErr) {
    console.error('[match-schemes] Network error', fetchErr);
    results = normalizeMatchedResults(matchSchemes(profile, activeRawDataset as any, activeCategoryType));
  }

  // Pre-fetch explanation for the top matched scheme
  if (results.length > 0) {
    const topScheme = results[0];
    try {
      const expRes = await fetch('/api/explain-scheme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheme: topScheme.scheme,
          profile,
          language,
          mode: contentMode,
        }),
      });
      if (expRes.ok) {
        const expData = await expRes.json();
        if (expData.explanation) {
          topScheme.ai_explanation = expData.explanation;
        }
      }
    } catch {
      // Ignored
    }
  }

  // Update query cache
  const updatedCache = {
    ...get().queryCache,
    [cacheKey]: { profile, results },
  };

  set({
    matchedResults: results,
    expandedCardIds: results.length > 0 ? [results[0].scheme.id] : [],
    currentScreen: 'results',
    isLoading: false,
    queryCache: updatedCache,
  });
}
