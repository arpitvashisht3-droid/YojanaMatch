import { create } from 'zustand';
import { AppLanguage, AppScreen, ContentMode, MatchedSchemeResult, UserProfile, UserRecord } from '../types';
import schemesRaw from '../data/schemes.json';
import scholarshipsRaw from '../data/scholarships.json';
import { matchSchemes } from '../lib/matchingEngine';
import { userRecordToProfile } from '../lib/userProfileHelper';

const SESSION_STORAGE_KEY = 'ym_session_phone';
const AUTH_TOKEN_KEY = 'ym_auth_token';

interface AppState {
  language: AppLanguage;
  contentMode: ContentMode;
  currentScreen: AppScreen;
  user: UserRecord | null;
  authToken: string | null;
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

  // Auth & Onboarding Actions
  initAuthSession: () => Promise<void>;
  signup: (name: string, phone: string, password: string) => Promise<{ user: UserRecord; token: string }>;
  login: (phone: string, password: string) => Promise<{ user: UserRecord; token: string }>;
  loginOrSignup: (name: string, phone: string, password?: string) => Promise<{ isNewUser: boolean; user: UserRecord }>;
  updateUserProfile: (updates: Partial<UserRecord>) => Promise<UserRecord | null>;
  saveOnboarding: (data: Partial<UserRecord>) => Promise<UserRecord | null>;
  fetchOnboarding: () => Promise<any | null>;
  logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  language: 'en',
  contentMode: 'schemes',
  currentScreen: 'signup',
  user: null,
  authToken: localStorage.getItem(AUTH_TOKEN_KEY),
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
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!storedToken) {
        set({ user: null, authToken: null, currentScreen: 'signup', isAuthChecking: false });
        return;
      }

      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${storedToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const user: UserRecord = data.user;
          const nextScreen: AppScreen = user.onboarding_completed ? 'landing' : 'onboarding';
          set({
            user,
            authToken: storedToken,
            currentScreen: nextScreen,
            isAuthChecking: false,
          });
          return;
        }
      }

      // If token invalid, expired, or user not found
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      set({ user: null, authToken: null, currentScreen: 'signup', isAuthChecking: false });
    } catch (err) {
      console.warn('Auth session check error:', err);
      set({ isAuthChecking: false, currentScreen: 'signup' });
    }
  },

  signup: async (name: string, phone: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone_number: phone, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register account');
      }

      const user: UserRecord = data.user;
      const token: string = data.token;
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(SESSION_STORAGE_KEY, user.phone_number);

      const nextScreen: AppScreen = user.onboarding_completed ? 'landing' : 'onboarding';
      set({
        user,
        authToken: token,
        currentScreen: nextScreen,
        isLoading: false,
        error: null,
      });

      return { user, token };
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Signup failed' });
      throw err;
    }
  },

  login: async (phone: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid phone number or password');
      }

      const user: UserRecord = data.user;
      const token: string = data.token;
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(SESSION_STORAGE_KEY, user.phone_number);

      const nextScreen: AppScreen = user.onboarding_completed ? 'landing' : 'onboarding';
      set({
        user,
        authToken: token,
        currentScreen: nextScreen,
        isLoading: false,
        error: null,
      });

      return { user, token };
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Login failed' });
      throw err;
    }
  },

  loginOrSignup: async (name: string, phone: string, password?: string) => {
    // If password provided, use standard signup/login
    if (password) {
      try {
        const res = await get().login(phone, password);
        return { isNewUser: false, user: res.user };
      } catch (err: any) {
        if (err.message?.includes('not found') || err.message?.includes('sign up')) {
          const res = await get().signup(name, phone, password);
          return { isNewUser: true, user: res.user };
        }
        throw err;
      }
    }

    // Fallback to legacy endpoint if no password supplied
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
      if (data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      }
      localStorage.setItem(SESSION_STORAGE_KEY, user.phone_number);

      const nextScreen: AppScreen = user.onboarding_completed ? 'landing' : 'onboarding';
      set({
        user,
        authToken: data.token || null,
        currentScreen: nextScreen,
        isLoading: false,
        error: null,
      });

      return { isNewUser: data.isNewUser, user };
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Authentication failed' });
      throw err;
    }
  },

  updateUserProfile: async (updates: Partial<UserRecord>) => {
    const { user, authToken } = get();
    if (!user) return null;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedUser: UserRecord = data.user;
        set({ user: updatedUser });
        return updatedUser;
      } else {
        // Fallback for legacy profile update
        const legacyRes = await fetch('/api/auth/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: user.phone_number,
            updates,
          }),
        });
        if (legacyRes.ok) {
          const data = await legacyRes.json();
          const updatedUser: UserRecord = data.user;
          set({ user: updatedUser });
          return updatedUser;
        }

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

  saveOnboarding: async (data: Partial<UserRecord>) => {
    const { user, authToken } = get();
    if (!user) return null;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const resData = await res.json();
        const updatedUser: UserRecord = resData.user;
        set({ user: updatedUser });
        return updatedUser;
      } else {
        return await get().updateUserProfile(data);
      }
    } catch (err) {
      console.warn('Save onboarding network error, fallback to updateUserProfile:', err);
      return await get().updateUserProfile(data);
    }
  },

  fetchOnboarding: async () => {
    const { authToken } = get();
    if (!authToken) return null;

    try {
      const res = await fetch('/api/user/onboarding', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.warn('Fetch onboarding error:', err);
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    set({
      user: null,
      authToken: null,
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
