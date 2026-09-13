import { create } from 'zustand';
import { AppLanguage, AppScreen, ContentMode, MatchedSchemeResult, UserProfile, UserRecord } from '../types';
import schemesRaw from '../data/schemes.json';
import scholarshipsRaw from '../data/scholarships.json';
import { matchSchemes } from '../lib/matchingEngine';
import { userRecordToProfile } from '../lib/userProfileHelper';

const SESSION_STORAGE_KEY = 'ym_session_phone';
const TOKEN_STORAGE_KEY = 'ym_session_token';

interface AppState {
  language: AppLanguage;
  contentMode: ContentMode;
  currentScreen: AppScreen;
  user: UserRecord | null;
  savedSchemeIds: string[];
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
  bhashiniTranslating: boolean;
  bhashiniError: string | null;

  // Actions
  setLanguage: (lang: AppLanguage) => void;
  setContentMode: (mode: ContentMode) => void;
  setInputText: (text: string) => void;
  setIsListening: (val: boolean) => void;
  setRecommendationsLayout: (layout: '3column' | 'stacked') => void;
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

  // Saved Schemes Actions
  fetchSavedSchemes: () => Promise<void>;
  toggleSaveScheme: (schemeId: string) => Promise<void>;
  isSchemeSaved: (schemeId: string) => boolean;

  // Auth & Onboarding Actions
  initAuthSession: () => Promise<void>;
  loginOrSignup: (name: string, phone: string) => Promise<{ isNewUser: boolean; user: UserRecord }>;
  updateUserProfile: (updates: Partial<UserRecord>) => Promise<UserRecord | null>;
  logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  language: 'en',
  contentMode: 'schemes',
  currentScreen: 'signup',
  user: null,
  savedSchemeIds: [],
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
  bhashiniTranslating: false,
  bhashiniError: null,

  setLanguage: (lang) => set({ language: lang }),
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
  navigateTo: (screen) => set({ currentScreen: screen }),

  initAuthSession: async () => {
    try {
      const storedPhone = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!storedPhone) {
        set({ user: null, savedSchemeIds: [], currentScreen: 'signup', isAuthChecking: false });
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
            savedSchemeIds: user.saved_schemes || [],
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
      set({ user: null, savedSchemeIds: [], currentScreen: 'signup', isAuthChecking: false });
    } catch (err) {
      console.warn('Auth session check error:', err);
      set({ isAuthChecking: false, currentScreen: 'signup', savedSchemeIds: [] });
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
        savedSchemeIds: user.saved_schemes || [],
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
    set({
      user: null,
      savedSchemeIds: [],
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
    });
  },

  fetchSavedSchemes: async () => {
    const { user } = get();
    if (!user) {
      set({ savedSchemeIds: [] });
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
        const ids: string[] = Array.isArray(data.saved_schemes) ? data.saved_schemes : [];
        set({ savedSchemeIds: ids, isSavedSchemesLoading: false });
      } else {
        set({ isSavedSchemesLoading: false });
      }
    } catch (err) {
      console.warn('Failed to fetch user saved schemes:', err);
      set({ isSavedSchemesLoading: false });
    }
  },

  toggleSaveScheme: async (schemeId: string) => {
    const { user, savedSchemeIds } = get();
    if (!user || !schemeId) return;

    const cleanId = schemeId.trim();
    const isSaved = savedSchemeIds.includes(cleanId);
    const updated = isSaved
      ? savedSchemeIds.filter((id) => id !== cleanId)
      : [...savedSchemeIds, cleanId];

    // Optimistic local update
    set({ savedSchemeIds: updated });

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
            set({ savedSchemeIds: data.saved_schemes });
          }
        } else {
          // Rollback on failure
          set({ savedSchemeIds });
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
            set({ savedSchemeIds: data.saved_schemes });
          }
        } else {
          // Rollback on failure
          set({ savedSchemeIds });
        }
      }
    } catch (err) {
      console.warn('Failed to toggle save scheme:', err);
      set({ savedSchemeIds });
    }
  },

  isSchemeSaved: (schemeId: string) => {
    return get().savedSchemeIds.includes(schemeId.trim());
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
    const textToAnalyze = customText !== undefined ? customText : get().inputText;
    if (!textToAnalyze.trim()) return;

    const { user, language, queryCache, contentMode } = get();
    const knownProfile = userRecordToProfile(user);

    const cacheKey = `${contentMode}:${language}:${textToAnalyze.trim().toLowerCase()}`;
    const cached = queryCache[cacheKey];

    if (cached) {
      set({
        extractedProfile: cached.profile,
        matchedResults: cached.results,
        currentScreen: 'results',
        expandedCardIds: cached.results.length > 0 ? [cached.results[0].scheme.id] : [],
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
      const res = await fetch('/api/bhashini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          source_language: sourceLang,
          target_language: targetLang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        set({ bhashiniTranslating: false });
        if (data.status === 'success' && data.translated_text) {
          return data.translated_text;
        }
      } else if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || 'BHASHINI credentials not configured (503 Service Unavailable).';
        set({ bhashiniTranslating: false, bhashiniError: msg });
        return null;
      } else {
        const errData = await res.json().catch(() => ({}));
        set({ bhashiniTranslating: false, bhashiniError: errData.error || 'Translation failed' });
      }
    } catch (err: any) {
      set({ bhashiniTranslating: false, bhashiniError: err?.message || 'Translation network error' });
    }
    return null;
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
      results = data.results || [];
    } else {
      results = matchSchemes(profile, activeRawDataset as any, activeCategoryType);
    }
  } catch {
    results = matchSchemes(profile, activeRawDataset as any, activeCategoryType);
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
