import express, { Request, Response, NextFunction } from "express";
import path from "path";
import process from "process";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

import { connectDB } from "./config/connection.js";
import { UserModel } from "./models/User.js";
import { SchemeModel } from "./models/Scheme.js";
import { ScholarshipModel } from "./models/Scholarship.js";
import { MatchHistoryModel } from "./models/MatchHistory.js";
import {
  hashPassword,
  verifyPassword,
  signJwtToken,
  verifyJwtToken,
  toFlatUser,
} from "./src/server/authHelper.js";
import {
  translateText,
  isBhashiniConfigured,
} from "./src/server/bhashiniService.js";
import { DataIngestionService } from "./src/server/dataIngestionService.js";

// Static JSON dataset fallbacks
import schemesRaw from "./src/data/schemes.json" assert { type: "json" };
import scholarshipsRaw from "./src/data/scholarships.json" assert { type: "json" };
import { matchSchemes } from "./src/lib/matchingEngine.js";
import { UserProfile, Scheme } from "./src/types.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Initialize Google Gemini AI SDK if API Key is available
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Auth Middleware: Validates Bearer JWT Token or optional phone query parameter fallback
interface AuthenticatedRequest extends Request {
  user?: any;
  userDoc?: any;
}

const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const payload = verifyJwtToken(token);
      if (payload && payload.id) {
        const userDoc = await UserModel.findById(payload.id);
        if (userDoc) {
          req.userDoc = userDoc;
          req.user = toFlatUser(userDoc);
          return next();
        }
      }
    }

    // Fallback query parameter for phone number session hydration
    const phoneParam = req.query.phone as string;
    if (phoneParam) {
      const userDoc = await UserModel.findByPhone(phoneParam);
      if (userDoc) {
        req.userDoc = userDoc;
        req.user = toFlatUser(userDoc);
        return next();
      }
    }

    return res.status(401).json({ error: "Unauthorized access. Valid token or session required." });
  } catch (error: any) {
    return res.status(401).json({ error: "Authentication failed", detail: error?.message });
  }
};

// Health Check
app.get("/api/health", async (_req: Request, res: Response) => {
  res.json({
    status: "active",
    name: "YojanaMatch Unified Server",
    bhashini_configured: isBhashiniConfigured(),
    gemini_configured: Boolean(ai),
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// POST /api/auth/signup - Registered user signup with password
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  try {
    const { name, phone_number, password } = req.body;
    if (!name || !phone_number || !password) {
      return res.status(400).json({ error: "Name, phone number, and password are required." });
    }

    const cleanPhone = (phone_number || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: "Please enter a valid 10-digit phone number." });
    }

    const existing = await UserModel.findByPhone(cleanPhone);
    if (existing) {
      return res.status(409).json({ error: "An account with this phone number already exists." });
    }

    const password_hash = hashPassword(password);
    const userDoc = await UserModel.createUser({
      name,
      phone_number: cleanPhone,
      password_hash,
    });

    const flatUser = toFlatUser(userDoc);
    const token = signJwtToken({ id: userDoc._id?.toString(), phone_number: cleanPhone });

    return res.status(201).json({ user: flatUser, token });
  } catch (error: any) {
    return res.status(500).json({ error: "Signup failed", detail: error?.message });
  }
});

// POST /api/auth/login - Registered user login
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { phone_number, password } = req.body;
    if (!phone_number || !password) {
      return res.status(400).json({ error: "Phone number and password are required." });
    }

    const userDoc = await UserModel.findByPhone(phone_number);
    if (!userDoc || !userDoc.password_hash) {
      return res.status(401).json({ error: "Invalid phone number or password." });
    }

    const valid = verifyPassword(password, userDoc.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid phone number or password." });
    }

    const flatUser = toFlatUser(userDoc);
    const token = signJwtToken({ id: userDoc._id?.toString(), phone_number: userDoc.phone_number });

    return res.json({ user: flatUser, token });
  } catch (error: any) {
    return res.status(500).json({ error: "Login failed", detail: error?.message });
  }
});

// POST /api/auth/signup-or-login - Frontend Phone-Only Compatibility Endpoint
app.post("/api/auth/signup-or-login", async (req: Request, res: Response) => {
  try {
    const { name, phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ error: "Phone number is required." });
    }

    const cleanPhone = (phone_number || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: "Please enter a valid 10-digit Indian phone number." });
    }

    let userDoc = await UserModel.findByPhone(cleanPhone);
    let isNewUser = false;

    if (!userDoc) {
      isNewUser = true;
      userDoc = await UserModel.createUser({
        name: (name || "Beneficiary").trim(),
        phone_number: cleanPhone,
      });
    }

    const flatUser = toFlatUser(userDoc);
    const token = signJwtToken({ id: userDoc._id?.toString(), phone_number: cleanPhone });

    return res.json({ isNewUser, user: flatUser, token });
  } catch (error: any) {
    return res.status(500).json({ error: "Authentication failed", detail: error?.message });
  }
});

// GET /api/auth/me - Current user session hydration
app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

// ==========================================
// 2. USER PROFILE & ONBOARDING ENDPOINTS
// ==========================================

// GET /api/user/profile
app.get("/api/user/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

// PATCH /api/user/profile
app.patch("/api/user/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updates = req.body || {};
    const userId = req.userDoc._id;

    if (updates.name) {
      await UserModel.updateUser(userId, { name: updates.name });
    }

    const profileFields = [
      "age", "gender", "caste_category", "state", "district_type",
      "business_type", "estimated_income", "is_differently_abled",
      "education_level", "course_type", "current_marks_percentage"
    ];

    const profileUpdates: Record<string, any> = {};
    for (const field of profileFields) {
      if (updates[field] !== undefined) {
        profileUpdates[field] = updates[field];
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      await UserModel.updateProfile(userId, profileUpdates);
    }

    if (updates.onboarding_completed !== undefined || updates.onboarding_step !== undefined) {
      await UserModel.updateOnboarding(
        userId,
        updates.onboarding_step ?? req.userDoc.onboarding?.step ?? 1,
        updates.onboarding_completed ?? req.userDoc.onboarding?.completed ?? false
      );
    }

    const updatedUserDoc = await UserModel.findById(userId);
    return res.json({ user: toFlatUser(updatedUserDoc) });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to update profile", detail: error?.message });
  }
});

// POST /api/auth/update-profile - Legacy Compatibility Endpoint
app.post("/api/auth/update-profile", async (req: Request, res: Response) => {
  try {
    const { phone_number, updates } = req.body;
    if (!phone_number || !updates) {
      return res.status(400).json({ error: "phone_number and updates object are required." });
    }

    const userDoc = await UserModel.findByPhone(phone_number);
    if (!userDoc) {
      return res.status(404).json({ error: "User not found." });
    }

    const userId = userDoc._id;
    if (updates.name) {
      await UserModel.updateUser(userId, { name: updates.name });
    }

    const profileFields = [
      "age", "gender", "caste_category", "state", "district_type",
      "business_type", "estimated_income", "is_differently_abled",
      "education_level", "course_type", "current_marks_percentage"
    ];

    const profileUpdates: Record<string, any> = {};
    for (const field of profileFields) {
      if (updates[field] !== undefined) {
        profileUpdates[field] = updates[field];
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      await UserModel.updateProfile(userId, profileUpdates);
    }

    if (updates.onboarding_completed !== undefined || updates.onboarding_step !== undefined) {
      await UserModel.updateOnboarding(
        userId,
        updates.onboarding_step ?? userDoc.onboarding?.step ?? 1,
        updates.onboarding_completed ?? userDoc.onboarding?.completed ?? false
      );
    }

    const updatedUserDoc = await UserModel.findById(userId);
    return res.json({ user: toFlatUser(updatedUserDoc) });
  } catch (error: any) {
    return res.status(500).json({ error: "Update profile failed", detail: error?.message });
  }
});

// PUT /api/user/onboarding
app.put("/api/user/onboarding", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body || {};
    const userId = req.userDoc._id;

    const step = data.onboarding_step ?? 3;
    const completed = data.onboarding_completed ?? true;

    await UserModel.updateOnboarding(userId, step, completed);

    const profileFields = [
      "age", "gender", "caste_category", "state", "district_type",
      "business_type", "estimated_income", "is_differently_abled",
      "education_level", "course_type", "current_marks_percentage"
    ];

    const profileUpdates: Record<string, any> = {};
    for (const field of profileFields) {
      if (data[field] !== undefined) {
        profileUpdates[field] = data[field];
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      await UserModel.updateProfile(userId, profileUpdates);
    }

    const updatedUserDoc = await UserModel.findById(userId);
    return res.json({ user: toFlatUser(updatedUserDoc) });
  } catch (error: any) {
    return res.status(500).json({ error: "Save onboarding failed", detail: error?.message });
  }
});

// GET /api/user/onboarding
app.get("/api/user/onboarding", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    onboarding: req.userDoc.onboarding || { completed: false, step: 1 },
    profile: req.userDoc.profile || {},
  });
});

// GET /api/user/match-history
app.get("/api/user/match-history", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const histories = await MatchHistoryModel.getHistoryByUserId(req.userDoc._id);
    return res.json({ match_history: histories });
  } catch (error: any) {
    return res.status(500).json({ error: "Could not fetch match history", detail: error?.message });
  }
});

// ==========================================
// 3. SCHEMES & SCHOLARSHIPS ENDPOINTS
// ==========================================

const isStrictDb = () => process.env.NODE_ENV === "production" || process.env.STRICT_DB === "true";

// POST /api/admin/sync-government-data - Ingest Authoritative Government Schemes
// Requires: valid JWT (requireAuth) AND role === "admin" on the user document.
app.post("/api/admin/sync-government-data", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  // role check: only admin users may trigger a government data sync
  if (!req.userDoc || req.userDoc.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Only administrators may trigger government data synchronisation." });
  }
  try {
    const result = await DataIngestionService.syncGovernmentSchemes();
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to trigger government data sync", detail: error?.message });
  }
});

// GET /api/schemes
app.get("/api/schemes", async (_req: Request, res: Response) => {
  try {
    const dbSchemes = await SchemeModel.getAllActiveSchemes();
    if (dbSchemes && dbSchemes.length > 0) {
      return res.json(dbSchemes);
    }
    if (isStrictDb()) {
      return res.status(503).json({ error: "Database Unavailable", detail: "MongoDB connection is required in Production environment." });
    }
    return res.json(schemesRaw);
  } catch (error: any) {
    if (isStrictDb()) {
      return res.status(503).json({ error: "Database Unavailable", detail: error?.message });
    }
    return res.json(schemesRaw);
  }
});

// GET /api/schemes/:id
app.get("/api/schemes/:id", async (req: Request, res: Response) => {
  try {
    const scheme = await SchemeModel.findBySchemeId(req.params.id) || await SchemeModel.findById(req.params.id);
    if (scheme) return res.json(scheme);

    if (isStrictDb()) {
      return res.status(404).json({ error: "Scheme not found" });
    }

    const fallback = (schemesRaw as any[]).find((s) => s.id === req.params.id || s.scheme_id === req.params.id);
    if (fallback) return res.json(fallback);

    return res.status(404).json({ error: "Scheme not found" });
  } catch (error: any) {
    if (isStrictDb()) {
      return res.status(503).json({ error: "Database Unavailable", detail: error?.message });
    }
    const fallback = (schemesRaw as any[]).find((s) => s.id === req.params.id || s.scheme_id === req.params.id);
    if (fallback) return res.json(fallback);
    return res.status(404).json({ error: "Scheme not found" });
  }
});

// GET /api/scholarships
app.get("/api/scholarships", async (_req: Request, res: Response) => {
  try {
    const dbScholarships = await ScholarshipModel.getAllActiveScholarships();
    if (dbScholarships && dbScholarships.length > 0) {
      return res.json(dbScholarships);
    }
    if (isStrictDb()) {
      return res.status(503).json({ error: "Database Unavailable", detail: "MongoDB connection is required in Production environment." });
    }
    return res.json(scholarshipsRaw);
  } catch (error: any) {
    if (isStrictDb()) {
      return res.status(503).json({ error: "Database Unavailable", detail: error?.message });
    }
    return res.json(scholarshipsRaw);
  }
});

// GET /api/scholarships/:id
app.get("/api/scholarships/:id", async (req: Request, res: Response) => {
  try {
    const scholarship = await ScholarshipModel.findByScholarshipId(req.params.id) || await ScholarshipModel.findById(req.params.id);
    if (scholarship) return res.json(scholarship);

    if (isStrictDb()) {
      return res.status(404).json({ error: "Scholarship not found" });
    }

    const fallback = (scholarshipsRaw as any[]).find((s) => s.id === req.params.id || s.scholarship_id === req.params.id);
    if (fallback) return res.json(fallback);

    return res.status(404).json({ error: "Scholarship not found" });
  } catch (error: any) {
    if (isStrictDb()) {
      return res.status(503).json({ error: "Database Unavailable", detail: error?.message });
    }
    const fallback = (scholarshipsRaw as any[]).find((s) => s.id === req.params.id || s.scholarship_id === req.params.id);
    if (fallback) return res.json(fallback);
    return res.status(404).json({ error: "Scholarship not found" });
  }
});

// ==========================================
// 4. AI & SCHEME MATCHING ENDPOINTS
// ==========================================

// POST /api/extract-profile - Gemini structured attribute extraction
app.post("/api/extract-profile", async (req: Request, res: Response) => {
  try {
    const { text, mode } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text cannot be empty" });
    }

    if (!ai) {
      const heuristic = extractHeuristicProfile(text, mode || "schemes");
      return res.json({ profile: heuristic, extracted_by: "heuristic_fallback" });
    }

    const systemInstruction = `You are an expert AI eligibility assistant for Indian government schemes and scholarships.
Extract user background attributes into JSON strictly conforming to this schema:
{
  "age": integer or null,
  "gender": "female" | "male" | "transgender" | "any" | null,
  "caste_category": "sc" | "st" | "obc" | "general" | "minority" | "ews" | "any" | null,
  "state": string or null,
  "district_type": "rural" | "urban" | "semi-urban" | "any" | null,
  "business_type": "manufacturing" | "services" | "retail_shop" | "artisan_handicraft" | "agriculture_allied" | "street_vendor" | "textile_weaving" | "food_processing" | "dairy_livestock" | "fisheries" | "tech_startup" | "any" | null,
  "estimated_income": integer or null,
  "is_differently_abled": boolean or null,
  "education_level": "school" | "undergraduate" | "postgraduate" | "diploma" | "phd" | "any" | null,
  "course_type": "general" | "technical" | "medical" | "vocational" | "any" | null,
  "current_marks_percentage": integer or null
}
Extract attributes directly mentioned or inferred. Return null for unmentioned attributes. Do not invent details.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract user profile from: "${text}"`,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const textOutput = response.text || "{}";
    const profile = JSON.parse(textOutput);
    return res.json({ profile, extracted_by: "gemini" });
  } catch (error: any) {
    const heuristic = extractHeuristicProfile(req.body.text || "", req.body.mode || "schemes");
    return res.json({ profile: heuristic, extracted_by: "heuristic_fallback_on_error" });
  }
});

// POST /api/match-schemes - Deterministic Rule-Based Scheme Matching Engine
// Production: fetches active records from MongoDB. Development: falls back to static JSON if DB is unavailable.
app.post("/api/match-schemes", async (req: Request, res: Response) => {
  try {
    const { profile, category_type, mode } = req.body;
    const userProfile: UserProfile = profile || {};

    const activeMode = mode || (category_type === "scholarship" ? "scholarships" : "schemes");
    let activeDataset: any[];

    try {
      if (activeMode === "scholarships") {
        activeDataset = await ScholarshipModel.getAllActiveScholarships();
      } else {
        activeDataset = await SchemeModel.getAllActiveSchemes();
      }

      // If MongoDB returned an empty collection, fall back only in development
      if (!activeDataset || activeDataset.length === 0) {
        if (isStrictDb()) {
          return res.status(503).json({
            error: "Database Unavailable",
            detail: "No active records found in MongoDB. In Production, static fallback is disabled.",
          });
        }
        activeDataset = activeMode === "scholarships" ? (scholarshipsRaw as any[]) : (schemesRaw as any[]);
      }
    } catch (dbError: any) {
      // MongoDB threw — hard fail in production, fallback in development
      if (isStrictDb()) {
        return res.status(503).json({
          error: "Database Unavailable",
          detail: dbError?.message || "MongoDB connection failed during scheme matching.",
        });
      }
      activeDataset = activeMode === "scholarships" ? (scholarshipsRaw as any[]) : (schemesRaw as any[]);
    }

    const results = matchSchemes(userProfile, activeDataset, category_type || "scheme");

    return res.json({
      total_matches: results.length,
      results,
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Matching failed", detail: error?.message });
  }
});

// POST /api/explain-scheme - Gemini Plain-Language Scheme Explanation
app.post("/api/explain-scheme", async (req: Request, res: Response) => {
  try {
    const { scheme, profile, language } = req.body;
    if (!scheme) {
      return res.status(400).json({ error: "Scheme object is required" });
    }

    const defaultExp = language === "hi" ? scheme.hindi_short_summary : scheme.short_summary;

    if (!ai) {
      return res.json({ explanation: defaultExp || "You meet the eligibility criteria for this scheme." });
    }

    const targetLang = language === "hi" ? "Hindi" : "simple plain English";
    const systemInstruction = `Explain in ${targetLang} (under 60 words, 6th-grade reading level) why this user is eligible for ${scheme.name} (${scheme.benefit_headline}). Address the applicant directly without jargon.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Explain scheme benefits for user profile: ${JSON.stringify(profile || {})}`,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    const explanation = response.text?.trim() || defaultExp;
    return res.json({ explanation });
  } catch (error: any) {
    const defaultExp = req.body.language === "hi" ? req.body.scheme?.hindi_short_summary : req.body.scheme?.short_summary;
    return res.json({ explanation: defaultExp || "You are eligible for this program and can apply online." });
  }
});

// ==========================================
// 5. BHASHINI TRANSLATION ENDPOINT
// ==========================================

// POST /api/bhashini/translate - Official MeitY ULCA Bhashini API Service
app.post("/api/bhashini/translate", async (req: Request, res: Response) => {
  const { text, source_language, target_language } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Field 'text' is required and cannot be empty." });
  }

  // Mandatory credential check: Return HTTP 503 if credentials are missing in environment
  if (!isBhashiniConfigured()) {
    return res.status(503).json({
      translated_text: null,
      source_language: source_language || "en",
      target_language: target_language || "hi",
      status: "error",
      error: "BHASHINI API credentials not configured. Please set BHASHINI_USER_ID and BHASHINI_API_KEY in environment.",
    });
  }

  const result = await translateText(
    text,
    source_language || "en",
    target_language || "hi"
  );

  if (result.status !== "success") {
    return res.status(502).json(result);
  }

  return res.json(result);
});

// Heuristic Fallback Profile Extractor
function extractHeuristicProfile(text: string, mode: string = "schemes"): UserProfile {
  const lower = text.toLowerCase();
  const profile: UserProfile = {};

  const ageMatch = lower.match(/(?:age\s*|i am\s*|meri umar\s*)?(\b\d{2}\b)(?:\s*(?:years|yr|saal|sal|वर्ष))?/i);
  if (ageMatch && parseInt(ageMatch[1], 10) >= 12 && parseInt(ageMatch[1], 10) <= 80) {
    profile.age = parseInt(ageMatch[1], 10);
  }

  if (lower.includes("female") || lower.includes("woman") || lower.includes("mahila") || lower.includes("aurat") || lower.includes("girl") || lower.includes("stree")) {
    profile.gender = "female";
  } else if (lower.includes("male") || lower.includes("man") || lower.includes("purush") || lower.includes("ladka") || lower.includes("aadmi")) {
    profile.gender = "male";
  }

  if (lower.includes("sc") || lower.includes("scheduled caste") || lower.includes("dalit") || lower.includes("anusuchit jaati")) {
    profile.caste_category = "sc";
  } else if (lower.includes("st") || lower.includes("scheduled tribe") || lower.includes("adivasi") || lower.includes("anusuchit janjati")) {
    profile.caste_category = "st";
  } else if (lower.includes("obc") || lower.includes("other backward") || lower.includes("pichhda")) {
    profile.caste_category = "obc";
  } else if (lower.includes("minority") || lower.includes("muslim") || lower.includes("alpashankhyak") || lower.includes("sikh")) {
    profile.caste_category = "minority";
  } else if (lower.includes("general") || lower.includes("samanya")) {
    profile.caste_category = "general";
  }

  const stateKeywords: Record<string, string> = {
    "uttar pradesh": "Uttar Pradesh", "up": "Uttar Pradesh", "bihar": "Bihar",
    "rajasthan": "Rajasthan", "madhya pradesh": "Madhya Pradesh", "mp": "Madhya Pradesh",
    "maharashtra": "Maharashtra", "odisha": "Odisha", "west bengal": "West Bengal",
    "delhi": "Delhi", "tamil nadu": "Tamil Nadu", "karnataka": "Karnataka",
    "punjab": "Punjab", "haryana": "Haryana", "kerala": "Kerala", "jharkhand": "Jharkhand"
  };
  for (const [kw, st] of Object.entries(stateKeywords)) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
      profile.state = st;
      break;
    }
  }

  if (lower.includes("rural") || lower.includes("village") || lower.includes("gaon") || lower.includes("gramin")) {
    profile.district_type = "rural";
  } else if (lower.includes("urban") || lower.includes("city") || lower.includes("shahar") || lower.includes("nagar")) {
    profile.district_type = "urban";
  } else if (lower.includes("semi-urban") || lower.includes("town")) {
    profile.district_type = "semi-urban";
  }

  if (lower.includes("disabilit") || lower.includes("divyang") || lower.includes("handicap") || lower.includes("pwd")) {
    profile.is_differently_abled = true;
  }

  if (mode === "scholarships") {
    if (lower.includes("12th") || lower.includes("10th") || lower.includes("school")) {
      profile.education_level = "school";
    } else if (lower.includes("undergraduate") || lower.includes("college") || lower.includes("btech")) {
      profile.education_level = "undergraduate";
    } else if (lower.includes("postgraduate") || lower.includes("masters")) {
      profile.education_level = "postgraduate";
    }
  } else {
    if (lower.includes("tailor") || lower.includes("artisan") || lower.includes("handicraft")) {
      profile.business_type = "artisan_handicraft";
    } else if (lower.includes("street vendor") || lower.includes("thela")) {
      profile.business_type = "street_vendor";
    } else if (lower.includes("shop") || lower.includes("dukan")) {
      profile.business_type = "retail_shop";
    }
  }

  return profile;
}

// Start Unified Server & Connect to MongoDB Atlas
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production" || process.env.STRICT_DB === "true";
  try {
    console.log("Connecting to MongoDB Atlas...");
    const db = await connectDB();
    console.log(`Successfully connected to MongoDB database: '${db.databaseName}'`);
  } catch (err: any) {
    if (isProduction) {
      console.error("FATAL ERROR: MongoDB connection failed in Production mode:", err?.message || err);
      console.error("Production server startup aborted. MongoDB Atlas connection is MANDATORY.");
      process.exit(1);
    }
    console.warn("MongoDB connection warning:", err?.message || err);
    console.warn("Server will continue running in DEVELOPMENT fallback mode.");
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`YojanaMatch Unified Server running on http://0.0.0.0:${PORT}`);
    console.log(`BHASHINI translation service endpoint: http://0.0.0.0:${PORT}/api/bhashini/translate`);
  });
}

startServer();
