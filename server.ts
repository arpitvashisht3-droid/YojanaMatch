import express, { Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  connectDB, 
  UserModel, 
  SchemeModel, 
  ScholarshipModel, 
  MatchHistoryModel,
  UserDocument,
  EmbeddedUserProfile,
  normalizePhoneNumber
} from "yojanamatch-database";
import schemesData from "./src/data/schemes.json" with { type: "json" };
import scholarshipsData from "./src/data/scholarships.json" with { type: "json" };
import { matchSchemes } from "./src/lib/matchingEngine";
import { Scheme, UserProfile, UserRecord, SafeUser } from "./src/types";
import { formatUserForResponse, sanitizeUser, findUserByPhone, createUser, updateUser } from "./src/server/db";

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "yojanamatch-sih2026-default-dev-secret-key";

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET environment variable is not set. Using development secret key.");
}

app.use(express.json({ limit: "10mb" }));

// Extended Request interface for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: SafeUser;
  rawUserDoc?: UserDocument;
}

// Authentication Middleware
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication token missing or malformed" });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: "Authentication token required" });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr: any) {
      return res.status(401).json({ error: "Invalid or expired authentication token" });
    }

    const phone = payload?.phone;
    const userId = payload?.userId;

    let userDoc: UserDocument | null = null;
    if (userId) {
      userDoc = await UserModel.findById(userId);
    }
    if (!userDoc && phone) {
      userDoc = await UserModel.findByPhone(phone);
    }

    if (!userDoc) {
      return res.status(404).json({ error: "Authenticated user not found" });
    }

    req.rawUserDoc = userDoc;
    req.user = formatUserForResponse(userDoc)!;
    next();
  } catch (error: any) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Authentication verification failed" });
  }
}

// Helper to optionally extract authenticated user from header if present
async function getOptionalUser(req: Request): Promise<{ userDoc: UserDocument | null; safeUser: SafeUser | null }> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { userDoc: null, safeUser: null };
    }
    const token = authHeader.substring(7).trim();
    if (!token) return { userDoc: null, safeUser: null };

    const payload: any = jwt.verify(token, JWT_SECRET);
    let userDoc: UserDocument | null = null;
    if (payload?.userId) {
      userDoc = await UserModel.findById(payload.userId);
    }
    if (!userDoc && payload?.phone) {
      userDoc = await UserModel.findByPhone(payload.phone);
    }
    return {
      userDoc,
      safeUser: userDoc ? formatUserForResponse(userDoc) : null,
    };
  } catch {
    return { userDoc: null, safeUser: null };
  }
}

// Health check endpoint
app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    const schemes = await SchemeModel.getAllActiveSchemes();
    res.json({ 
      status: "ok", 
      database: "connected",
      schemes_count: schemes.length > 0 ? schemes.length : schemesData.length 
    });
  } catch (err) {
    res.json({ 
      status: "ok", 
      database: "fallback",
      schemes_count: schemesData.length 
    });
  }
});

// PART 1 — SIGNUP & LOGIN
// 1. POST /api/auth/signup
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  try {
    const { name, phone_number, password } = req.body;
    const cleanName = (name || "").trim();
    const cleanPhone = normalizePhoneNumber(phone_number);

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: "Valid name (at least 2 characters) is required" });
    }
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const existingUser = await UserModel.findByPhone(cleanPhone);
    if (existingUser) {
      return res.status(409).json({ error: "A user with this mobile number is already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUserDoc = await UserModel.createUser({
      name: cleanName,
      phone_number: cleanPhone,
      password_hash,
      role: "user",
      preferred_language: "en"
    });

    const safeUser = formatUserForResponse(newUserDoc);
    const token = jwt.sign(
      { userId: newUserDoc._id?.toString(), phone: cleanPhone, name: cleanName },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: safeUser,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: error?.message || "Signup failed. Please try again." });
  }
});

// 2. POST /api/auth/login
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { phone_number, password } = req.body;
    const cleanPhone = normalizePhoneNumber(phone_number);

    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    const userDoc = await UserModel.findByPhone(cleanPhone);
    if (!userDoc) {
      return res.status(401).json({ error: "Invalid phone number or password" });
    }

    if (!userDoc.password_hash) {
      return res.status(401).json({ error: "Account has no password set. Please sign up." });
    }

    const isMatch = await bcrypt.compare(password, userDoc.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid phone number or password" });
    }

    const safeUser = formatUserForResponse(userDoc);
    const token = jwt.sign(
      { userId: userDoc._id?.toString(), phone: cleanPhone, name: userDoc.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: safeUser,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// 3. GET /api/auth/me (Protected current-user endpoint)
app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ user: req.user });
  } catch (error: any) {
    console.error("Get /api/auth/me error:", error);
    return res.status(500).json({ error: "Failed to fetch user session" });
  }
});

// PART 2 — USER PROFILE APIs
// 1. GET /api/user/profile (Protected)
app.get("/api/user/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ user: req.user });
  } catch (error: any) {
    console.error("Get user profile error:", error);
    return res.status(500).json({ error: "Failed to retrieve user profile" });
  }
});

// 2. PATCH /api/user/profile (Protected)
app.patch("/api/user/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userDoc = req.rawUserDoc!;
    const incoming = req.body || {};

    const profileUpdates: Partial<EmbeddedUserProfile> = {};
    const profileKeys = [
      "age", "gender", "caste_category", "state", "district_type",
      "business_type", "estimated_income", "is_differently_abled",
      "education_level", "current_marks_percentage", "course_type"
    ];

    for (const key of profileKeys) {
      if (key in incoming) {
        (profileUpdates as any)[key] = incoming[key];
      }
    }

    if (Object.keys(profileUpdates).length > 0 && userDoc._id) {
      await UserModel.updateProfile(userDoc._id, profileUpdates);
    }

    if (incoming.name || incoming.preferred_language) {
      await UserModel.updateUser(userDoc._id!, {
        name: incoming.name,
        preferred_language: incoming.preferred_language
      });
    }

    if (typeof incoming.onboarding_completed === "boolean" || typeof incoming.onboarding_step === "number") {
      const step = typeof incoming.onboarding_step === "number" ? incoming.onboarding_step : (userDoc.onboarding?.step || 1);
      const completed = typeof incoming.onboarding_completed === "boolean" ? incoming.onboarding_completed : (userDoc.onboarding?.completed || false);
      await UserModel.updateOnboarding(userDoc._id!, step, completed);
    }

    const updatedUserDoc = await UserModel.findById(userDoc._id!);
    return res.json({
      message: "Profile updated successfully",
      user: formatUserForResponse(updatedUserDoc),
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

// PART 3 — ONBOARDING DATA API
// 1. PUT /api/user/onboarding (Protected)
app.put("/api/user/onboarding", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userDoc = req.rawUserDoc!;
    const data = req.body || {};

    const profileUpdates: Partial<EmbeddedUserProfile> = {};
    const profileKeys = [
      "age", "gender", "caste_category", "state", "district_type",
      "business_type", "estimated_income", "is_differently_abled",
      "education_level", "current_marks_percentage", "course_type"
    ];

    for (const key of profileKeys) {
      if (key in data && data[key] !== undefined) {
        (profileUpdates as any)[key] = data[key];
      }
    }

    if (Object.keys(profileUpdates).length > 0 && userDoc._id) {
      await UserModel.updateProfile(userDoc._id, profileUpdates);
    }

    const step = typeof data.onboarding_step === "number" ? data.onboarding_step : (userDoc.onboarding?.step || 1);
    const completed = typeof data.onboarding_completed === "boolean" ? data.onboarding_completed : true;
    
    if (userDoc._id) {
      await UserModel.updateOnboarding(userDoc._id, step, completed);
    }

    const updatedUserDoc = await UserModel.findById(userDoc._id!);
    return res.json({
      message: "Onboarding data saved successfully",
      user: formatUserForResponse(updatedUserDoc),
    });
  } catch (error: any) {
    console.error("Save onboarding error:", error);
    return res.status(500).json({ error: "Failed to save onboarding data" });
  }
});

// 2. GET /api/user/onboarding (Protected)
app.get("/api/user/onboarding", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userDoc = req.rawUserDoc!;
    const profile = userDoc.profile || {};
    const onboarding = userDoc.onboarding || { completed: false, step: 1 };

    return res.json({
      onboarding_completed: onboarding.completed,
      onboarding_step: onboarding.step || 1,
      data: profile,
    });
  } catch (error: any) {
    console.error("Get onboarding error:", error);
    return res.status(500).json({ error: "Failed to retrieve onboarding data" });
  }
});

// PART 4 — SCHEMES & SCHOLARSHIPS API
// 1. GET /api/schemes
app.get("/api/schemes", async (_req: Request, res: Response) => {
  try {
    const mongoSchemes = await SchemeModel.getAllActiveSchemes();
    if (mongoSchemes && mongoSchemes.length > 0) {
      const formatted = mongoSchemes.map((s) => ({
        id: s.scheme_id || s._id?.toString(),
        ...s
      }));
      return res.json(formatted);
    }
    return res.json(schemesData);
  } catch (error: any) {
    console.warn("Failed to fetch schemes from MongoDB, using fallback data:", error?.message || error);
    return res.json(schemesData);
  }
});

// 2. GET /api/schemes/:id
app.get("/api/schemes/:id", async (req: Request, res: Response) => {
  try {
    const schemeId = req.params.id;
    let scheme = await SchemeModel.findBySchemeId(schemeId);
    if (!scheme) {
      scheme = await SchemeModel.findById(schemeId).catch(() => null);
    }
    if (scheme) {
      return res.json({
        id: scheme.scheme_id || scheme._id?.toString(),
        ...scheme
      });
    }

    const fallback = (schemesData as Scheme[]).find((s) => s.id === schemeId);
    if (fallback) return res.json(fallback);

    return res.status(404).json({ error: "Scheme not found" });
  } catch (error: any) {
    console.error("Get scheme by ID error:", error);
    return res.status(500).json({ error: "Failed to fetch scheme details" });
  }
});

// 3. GET /api/scholarships
app.get("/api/scholarships", async (_req: Request, res: Response) => {
  try {
    const mongoScholarships = await ScholarshipModel.getAllActiveScholarships();
    if (mongoScholarships && mongoScholarships.length > 0) {
      const formatted = mongoScholarships.map((s) => ({
        id: s.scholarship_id || s._id?.toString(),
        ...s
      }));
      return res.json(formatted);
    }
    return res.json(scholarshipsData);
  } catch (error: any) {
    console.warn("Failed to fetch scholarships from MongoDB, using fallback data:", error?.message || error);
    return res.json(scholarshipsData);
  }
});

// 4. GET /api/scholarships/:id
app.get("/api/scholarships/:id", async (req: Request, res: Response) => {
  try {
    const schId = req.params.id;
    let scholarship = await ScholarshipModel.findByScholarshipId(schId);
    if (!scholarship) {
      scholarship = await ScholarshipModel.findById(schId).catch(() => null);
    }
    if (scholarship) {
      return res.json({
        id: scholarship.scholarship_id || scholarship._id?.toString(),
        ...scholarship
      });
    }

    const fallback = (scholarshipsData as Scheme[]).find((s) => s.id === schId);
    if (fallback) return res.json(fallback);

    return res.status(404).json({ error: "Scholarship not found" });
  } catch (error: any) {
    console.error("Get scholarship by ID error:", error);
    return res.status(500).json({ error: "Failed to fetch scholarship details" });
  }
});

// PART 5 — MATCHING ENGINE & MATCH HISTORY
// 1. POST /api/match-schemes
app.post("/api/match-schemes", async (req: Request, res: Response) => {
  try {
    const { profile, category_type = "scheme", input_mode = "text", raw_input_text = "", language = "en" } = req.body;
    const userProfile: UserProfile = profile || {};
    const isScholarship = category_type === "scholarship";

    let dataset: Scheme[] = [];

    if (isScholarship) {
      const mongoDocs = await ScholarshipModel.getAllActiveScholarships().catch(() => []);
      if (mongoDocs.length > 0) {
        dataset = mongoDocs.map((s) => ({
          id: s.scholarship_id || s._id?.toString() || "",
          ...s
        })) as unknown as Scheme[];
      } else {
        dataset = scholarshipsData as unknown as Scheme[];
      }
    } else {
      const mongoDocs = await SchemeModel.getAllActiveSchemes().catch(() => []);
      if (mongoDocs.length > 0) {
        dataset = mongoDocs.map((s) => ({
          id: s.scheme_id || s._id?.toString() || "",
          ...s
        })) as unknown as Scheme[];
      } else {
        dataset = schemesData as unknown as Scheme[];
      }
    }

    const matchedResults = matchSchemes(userProfile, dataset, category_type);

    // Save match run into match_histories if user is logged in
    const { userDoc } = await getOptionalUser(req);
    if (userDoc && userDoc._id) {
      try {
        const formattedResults = matchedResults.map((r) => ({
          scheme_id: r.scheme.id,
          scheme_name: r.scheme.name,
          hindi_scheme_name: r.scheme.hindi_name,
          benefit_headline: r.scheme.benefit_headline,
          match_score: r.match_score,
          matched_criteria_count: r.matched_criteria_count,
          total_criteria_checked: r.total_criteria_checked,
          match_details: r.match_details,
          ai_explanation: r.ai_explanation
        }));

        await MatchHistoryModel.createMatchHistory({
          user_id: userDoc._id,
          category_type: isScholarship ? "scholarship" : "scheme",
          input_mode: input_mode as "voice" | "text" | "onboarding",
          raw_input_text: raw_input_text,
          extracted_profile_snapshot: userProfile as EmbeddedUserProfile,
          results: formattedResults,
          language: language as "en" | "hi"
        });
      } catch (histErr) {
        console.warn("Failed to save match history entry:", histErr);
      }
    }

    return res.json({
      total_matches: matchedResults.length,
      results: matchedResults,
    });
  } catch (error: any) {
    console.error("Matching error:", error);
    return res.status(500).json({ error: "Failed to match schemes" });
  }
});

// 2. GET /api/user/match-history (Protected)
app.get("/api/user/match-history", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userDoc = req.rawUserDoc!;
    if (!userDoc._id) {
      return res.status(400).json({ error: "Valid user ID required" });
    }

    const history = await MatchHistoryModel.getHistoryByUserId(userDoc._id, 20);
    return res.json({
      count: history.length,
      history: history
    });
  } catch (error: any) {
    console.error("Get user match history error:", error);
    return res.status(500).json({ error: "Failed to retrieve user match history" });
  }
});


// Lazy initialize Google GenAI
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set in environment variables");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Resilient helper to handle temporary 503/429 high demand spikes on flash models
async function generateWithModelFallback(ai: any, params: any) {
  try {
    return await ai.models.generateContent({
      model: "gemini-3.8-flash",
      ...params,
    });
  } catch (err: any) {
    const isHighDemand =
      err?.status === 503 ||
      err?.status === 429 ||
      err?.message?.includes("503") ||
      err?.message?.includes("high demand") ||
      err?.message?.includes("UNAVAILABLE") ||
      err?.message?.includes("RESOURCE_EXHAUSTED");

    if (isHighDemand) {
      console.warn("gemini-3.8-flash is busy/unavailable, falling back to gemini-2.5-flash...");
      try {
        return await ai.models.generateContent({
          model: "gemini-2.5-flash",
          ...params,
        });
      } catch (fallbackErr: any) {
        console.warn("gemini-2.5-flash fallback also unavailable:", fallbackErr?.message || fallbackErr);
        throw fallbackErr;
      }
    }
    throw err;
  }
}

// 1. Profile Extraction Endpoint (Gemini Call 1)
app.post("/api/extract-profile", async (req: Request, res: Response) => {
  try {
    const { text, language = "en", knownProfile, mode = "schemes" } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text description is required" });
    }

    const ai = getGenAI();
    if (!ai) {
      const heuristicProfile = extractHeuristicProfile(text, mode);
      const merged = { ...(knownProfile || {}), ...heuristicProfile };
      return res.json({ profile: merged, extracted_by: "heuristic" });
    }

    const isScholarship = mode === "scholarships";

    const knownContext = knownProfile
      ? `NOTE: The user's confirmed onboarding profile already has:
Age: ${knownProfile.age || "unspecified"}
Gender: ${knownProfile.gender || "unspecified"}
Category: ${knownProfile.caste_category || "unspecified"}
State: ${knownProfile.state || "unspecified"}
District Type: ${knownProfile.district_type || "unspecified"}
${!isScholarship ? `Business Type: ${knownProfile.business_type || "unspecified"}` : ""}
Income: ${knownProfile.estimated_income ? "₹" + knownProfile.estimated_income : "unspecified"}
Do NOT re-extract or conflict with these known attributes unless the user explicitly mentions a different one in their text. Focus primarily on any NEW details, education background, or distinct requirements.`
      : "";

    const systemInstruction = isScholarship
      ? `You are a strict data extraction system for Indian government and institutional scholarships discovery.
Analyze the user's free-text or transcribed voice input (which may be in English, Hindi, or Hinglish).
${knownContext}
Extract the following structured attributes into JSON without inferring false positives:
- age: integer or null (e.g. 19)
- gender: "female" | "male" | "transgender" | "any" | null
- caste_category: "sc" | "st" | "obc" | "general" | "minority" | "ews" | "any" | null
- state: Indian state name or null (e.g. "Odisha", "Uttar Pradesh", "Bihar", "Rajasthan")
- district_type: "rural" | "urban" | "semi-urban" | "any" | null
- estimated_income: integer (estimated annual family income in INR) or null
- is_differently_abled: boolean or null
- education_level: "school" | "undergraduate" | "postgraduate" | "diploma" | "any" | null
- course_type: "general" | "technical" | "medical" | "vocational" | "any" | null
- current_marks_percentage: integer (percentage marks in previous exam e.g. 85) or null

Return ONLY accurate JSON matching the schema. Do not make up information that was not mentioned in the text.`
      : `You are a strict data extraction system for Indian government schemes discovery.
Analyze the user's free-text or transcribed voice input (which may be in English, Hindi, or Hinglish).
${knownContext}
Extract the following structured attributes into JSON without inferring false positives:
- age: integer or null (e.g. 28)
- gender: "female" | "male" | "transgender" | "any" | null
- caste_category: "sc" | "st" | "obc" | "general" | "minority" | "ews" | "any" | null
- state: Indian state name or null (e.g. "Uttar Pradesh", "Bihar", "Maharashtra")
- district_type: "rural" | "urban" | "semi-urban" | "any" | null
- business_type: "manufacturing" | "services" | "retail_shop" | "artisan_handicraft" | "agriculture_allied" | "street_vendor" | "textile_weaving" | "food_processing" | "dairy_livestock" | "fisheries" | "tech_startup" | "any" | null
- estimated_income: integer (estimated annual income in INR) or null
- is_differently_abled: boolean or null

Return ONLY accurate JSON matching the schema. Do not make up information that was not mentioned in the text.`;

    const schemaProperties: any = {
      age: { type: Type.INTEGER, description: "Age in years, null if unknown" },
      gender: { type: Type.STRING, description: "female, male, transgender, any, or null" },
      caste_category: { type: Type.STRING, description: "sc, st, obc, general, minority, ews, any, or null" },
      state: { type: Type.STRING, description: "State in India or null" },
      district_type: { type: Type.STRING, description: "rural, urban, semi-urban, any, or null" },
      estimated_income: { type: Type.INTEGER, description: "Annual income in INR or null" },
      is_differently_abled: { type: Type.BOOLEAN, description: "True if person with disability/divyangjan, otherwise null" },
    };

    if (isScholarship) {
      schemaProperties.education_level = { type: Type.STRING, description: "school, undergraduate, postgraduate, diploma, any, or null" };
      schemaProperties.course_type = { type: Type.STRING, description: "general, technical, medical, vocational, any, or null" };
      schemaProperties.current_marks_percentage = { type: Type.INTEGER, description: "Marks percentage 0 to 100 or null" };
    } else {
      schemaProperties.business_type = { type: Type.STRING, description: "manufacturing, services, retail_shop, artisan_handicraft, agriculture_allied, street_vendor, textile_weaving, food_processing, dairy_livestock, fisheries, tech_startup, any, or null" };
    }

    const response = await generateWithModelFallback(ai, {
      contents: `Extract user profile from: "${text}"`,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
        },
      },
    });

    const responseText = response.text?.trim() || "{}";
    const extracted = JSON.parse(responseText);

    const mergedProfile: UserProfile = {
      ...(knownProfile || {}),
    };

    for (const key of Object.keys(extracted) as (keyof UserProfile)[]) {
      if (extracted[key] !== null && extracted[key] !== undefined) {
        (mergedProfile as any)[key] = extracted[key];
      }
    }

    return res.json({ profile: mergedProfile, extracted_by: "gemini" });
  } catch (error: any) {
    console.error("Profile extraction error:", error);
    const heuristicProfile = extractHeuristicProfile(req.body.text || "", req.body.mode || "schemes");
    const merged = { ...(req.body.knownProfile || {}), ...heuristicProfile };
    return res.json({ profile: merged, extracted_by: "fallback_heuristic" });
  }
});

// 2. Scheme / Scholarship Explanation Endpoint (Gemini Call 2)
app.post("/api/explain-scheme", async (req: Request, res: Response) => {
  try {
    const { scheme, profile, language = "en", mode = "schemes" } = req.body;
    if (!scheme) {
      return res.status(400).json({ error: "Scheme object is required" });
    }

    const ai = getGenAI();
    if (!ai) {
      const defaultExp = language === "hi" ? scheme.hindi_short_summary : scheme.short_summary;
      return res.json({ explanation: defaultExp });
    }

    const isScholarship = mode === "scholarships" || Boolean(scheme.eligibility?.education_levels);
    const targetLang = language === "hi" ? "Hindi (हिंदी)" : "simple plain English";
    const roleTitle = isScholarship ? "scholarships guidance advisor for Indian students" : "advisor explaining Indian government schemes to a marginalized entrepreneur";
    
    const systemInstruction = `You are a warm, helpful ${roleTitle}.
Write a plain-language explanation in ${targetLang} about why this ${isScholarship ? "scholarship" : "scheme"} is beneficial for this applicant.
Strict constraints:
1. Maximum 60 words.
2. 6th-grade reading level (simple words, zero bureaucratic jargon).
3. Directly state the exact benefit (${isScholarship ? "scholarship / fee reimbursement amount" : "financial benefit / loan amount"}) and why they qualify.
4. Do NOT say 'as an AI'. Write directly to the applicant ('You can get...', 'आपको मिलेगा...').`;

    const prompt = isScholarship
      ? `Scholarship: ${scheme.name} (${scheme.benefit_headline || ""})
User Profile: Age ${profile?.age || "unspecified"}, Gender ${profile?.gender || "unspecified"}, Category ${profile?.caste_category || "unspecified"}, Education ${profile?.education_level || "unspecified"}, Marks ${profile?.current_marks_percentage ? profile.current_marks_percentage + "%" : "unspecified"}, Stream ${profile?.course_type || "unspecified"}, State ${profile?.state || "unspecified"}, Income ${profile?.estimated_income ? "₹" + profile.estimated_income : "unspecified"}.
Explain why they qualify and how this scholarship supports their education in under 60 words in ${targetLang}.`
      : `Scheme: ${scheme.name} (${scheme.benefit_headline || ""})
User Profile: Age ${profile?.age || "unspecified"}, Gender ${profile?.gender || "unspecified"}, Category ${profile?.caste_category || "unspecified"}, Area ${profile?.district_type || "unspecified"}, Business ${profile?.business_type || "unspecified"}, Income ${profile?.estimated_income ? "₹" + profile.estimated_income : "unspecified"}.
Explain why they qualify and how this scheme helps them in under 60 words in ${targetLang}.`;

    const response = await generateWithModelFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    const explanation = response.text?.trim() || (language === "hi" ? scheme.hindi_short_summary : scheme.short_summary);
    return res.json({ explanation });
  } catch (error: any) {
    console.warn("Scheme explanation using fallback summary due to:", error?.message || error);
    const defaultExp = req.body.language === "hi" ? req.body.scheme?.hindi_short_summary : req.body.scheme?.short_summary;
    return res.json({ explanation: defaultExp || "You are eligible for this program and can apply online." });
  }
});

// Heuristic fallback extractor
function extractHeuristicProfile(text: string, mode: string = "schemes"): UserProfile {
  const lower = text.toLowerCase();
  const profile: UserProfile = {};

  const ageMatch = lower.match(/(?:age\s*|i am\s*|meri umar\s*)?(\b\d{2}\b)(?:\s*(?:years|yr|saal|sal|वर्ष))?/i);
  if (ageMatch && parseInt(ageMatch[1], 10) >= 12 && parseInt(ageMatch[1], 10) <= 80) {
    profile.age = parseInt(ageMatch[1], 10);
  }

  if (lower.includes("female") || lower.includes("woman") || lower.includes("mahila") || lower.includes("aurat") || lower.includes("girl") || lower.includes("lady") || lower.includes("stree") || lower.includes("beti")) {
    profile.gender = "female";
  } else if (lower.includes("male") || lower.includes("man") || lower.includes("purush") || lower.includes("ladka") || lower.includes("boy") || lower.includes("aadmi")) {
    profile.gender = "male";
  }

  if (lower.includes("sc") || lower.includes("scheduled caste") || lower.includes("dalit") || lower.includes("anusuchit jaati")) {
    profile.caste_category = "sc";
  } else if (lower.includes("st") || lower.includes("scheduled tribe") || lower.includes("adivasi") || lower.includes("anusuchit janjati")) {
    profile.caste_category = "st";
  } else if (lower.includes("obc") || lower.includes("other backward") || lower.includes("pichhda") || lower.includes("pichhada")) {
    profile.caste_category = "obc";
  } else if (lower.includes("minority") || lower.includes("muslim") || lower.includes("alpashankhyak") || lower.includes("sikh") || lower.includes("christian")) {
    profile.caste_category = "minority";
  } else if (lower.includes("general") || lower.includes("samanya")) {
    profile.caste_category = "general";
  }

  const stateKeywords: Record<string, string> = {
    "uttar pradesh": "Uttar Pradesh", "up": "Uttar Pradesh", "bihar": "Bihar",
    "rajasthan": "Rajasthan", "madhya pradesh": "Madhya Pradesh", "mp": "Madhya Pradesh",
    "maharashtra": "Maharashtra", "odisha": "Odisha", "orissa": "Odisha",
    "west bengal": "West Bengal", "delhi": "Delhi", "tamil nadu": "Tamil Nadu",
    "karnataka": "Karnataka", "punjab": "Punjab", "haryana": "Haryana",
    "kerala": "Kerala", "jharkhand": "Jharkhand", "assam": "Assam", "gujarat": "Gujarat"
  };
  for (const [kw, st] of Object.entries(stateKeywords)) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
      profile.state = st;
      break;
    }
  }

  if (lower.includes("rural") || lower.includes("village") || lower.includes("gaon") || lower.includes("dehat") || lower.includes("gramin")) {
    profile.district_type = "rural";
  } else if (lower.includes("urban") || lower.includes("city") || lower.includes("shahar") || lower.includes("metro") || lower.includes("nagar")) {
    profile.district_type = "urban";
  } else if (lower.includes("semi-urban") || lower.includes("town") || lower.includes("kasba")) {
    profile.district_type = "semi-urban";
  }

  if (lower.includes("disabilit") || lower.includes("divyang") || lower.includes("handicap") || lower.includes("pwd")) {
    profile.is_differently_abled = true;
  }

  if (mode === "scholarships") {
    if (lower.includes("12th") || lower.includes("10th") || lower.includes("school") || lower.includes("matric")) {
      profile.education_level = "school";
    } else if (lower.includes("undergraduate") || lower.includes("college") || lower.includes("btech") || lower.includes("degree")) {
      profile.education_level = "undergraduate";
    } else if (lower.includes("postgraduate") || lower.includes("masters") || lower.includes("pg")) {
      profile.education_level = "postgraduate";
    } else if (lower.includes("diploma") || lower.includes("polytechnic") || lower.includes("iti")) {
      profile.education_level = "diploma";
    }

    if (lower.includes("engineer") || lower.includes("tech") || lower.includes("btech")) {
      profile.course_type = "technical";
    } else if (lower.includes("medical") || lower.includes("mbbs") || lower.includes("nursing")) {
      profile.course_type = "medical";
    } else if (lower.includes("iti") || lower.includes("vocational")) {
      profile.course_type = "vocational";
    } else if (lower.includes("arts") || lower.includes("science") || lower.includes("commerce")) {
      profile.course_type = "general";
    }

    const marksMatch = lower.match(/(\b\d{2}\b)\s*(?:%|percent|pratishat)/i);
    if (marksMatch) {
      const val = parseInt(marksMatch[1], 10);
      if (val >= 35 && val <= 100) {
        profile.current_marks_percentage = val;
      }
    }
  } else {
    if (lower.includes("tailor") || lower.includes("artisan") || lower.includes("handicraft") || lower.includes("carpenter")) {
      profile.business_type = "artisan_handicraft";
    } else if (lower.includes("street vendor") || lower.includes("vendor") || lower.includes("thela") || lower.includes("rehri")) {
      profile.business_type = "street_vendor";
    } else if (lower.includes("shop") || lower.includes("dukan") || lower.includes("retail")) {
      profile.business_type = "retail_shop";
    } else if (lower.includes("weaving") || lower.includes("textile") || lower.includes("bunker")) {
      profile.business_type = "textile_weaving";
    } else if (lower.includes("dairy") || lower.includes("livestock") || lower.includes("pashupalan")) {
      profile.business_type = "dairy_livestock";
    } else if (lower.includes("fish") || lower.includes("machhli") || lower.includes("aquaculture")) {
      profile.business_type = "fisheries";
    } else if (lower.includes("food") || lower.includes("processing") || lower.includes("bakery")) {
      profile.business_type = "food_processing";
    } else if (lower.includes("startup") || lower.includes("tech")) {
      profile.business_type = "tech_startup";
    } else if (lower.includes("factory") || lower.includes("manufacturing")) {
      profile.business_type = "manufacturing";
    } else if (lower.includes("service") || lower.includes("repair")) {
      profile.business_type = "services";
    }
  }

  return profile;
}

// Start Server & Connect to MongoDB Atlas
async function startServer() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    const db = await connectDB();
    console.log(`Connected to MongoDB Atlas database: '${db.databaseName}'`);
  } catch (err: any) {
    console.warn("MongoDB connection warning:", err?.message || err);
    console.warn("Server will continue running with fallback dataset handling.");
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
    console.log(`YojanaMatch server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
