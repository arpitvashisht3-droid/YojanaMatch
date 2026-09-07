import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import schemesData from "./src/data/schemes.json" with { type: "json" };
import scholarshipsData from "./src/data/scholarships.json" with { type: "json" };
import { matchSchemes } from "./src/lib/matchingEngine";
import { Scheme, UserProfile } from "./src/types";
import { findUserByPhone, createUser, updateUser, normalizePhone } from "./src/server/db";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

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

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", schemes_count: schemesData.length });
});

// Auth 1: Signup or Login (Mandatory Gate, trust-based, no OTP)
app.post("/api/auth/signup-or-login", async (req: Request, res: Response) => {
  try {
    const { name, phone_number } = req.body;
    const cleanName = (name || "").trim();
    const cleanPhone = normalizePhone(phone_number);

    if (!cleanName) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number" });
    }

    const existingUser = await findUserByPhone(cleanPhone);
    if (existingUser) {
      // Returning user - update name if user changed it
      if (cleanName && cleanName !== existingUser.name) {
        const updated = await updateUser(cleanPhone, { name: cleanName });
        return res.json({ user: updated || existingUser, isNewUser: false });
      }
      return res.json({ user: existingUser, isNewUser: false });
    }

    // New user
    const newUser = await createUser({
      name: cleanName,
      phone_number: cleanPhone,
      created_at: new Date().toISOString(),
      onboarding_completed: false,
      onboarding_step: 1,
    });

    return res.json({ user: newUser, isNewUser: true });
  } catch (error: any) {
    console.error("Signup/Login error:", error);
    return res.status(500).json({ error: "Authentication failed. Please try again." });
  }
});

// Auth 2: Get Current User by phone (Session hydration)
app.get("/api/auth/me", async (req: Request, res: Response) => {
  try {
    const phone = (req.query.phone as string) || (req.headers.authorization?.replace("Bearer ", ""));
    if (!phone) {
      return res.status(401).json({ error: "Unauthorized: phone number required" });
    }
    const cleanPhone = normalizePhone(phone);
    const user = await findUserByPhone(cleanPhone);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user });
  } catch (error: any) {
    console.error("Get user error:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Auth 3: Update User Profile / Onboarding Progress
app.post("/api/auth/update-profile", async (req: Request, res: Response) => {
  try {
    const { phone_number, updates } = req.body;
    if (!phone_number) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    const cleanPhone = normalizePhone(phone_number);
    const updatedUser = await updateUser(cleanPhone, updates || {});
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found to update" });
    }
    return res.json({ user: updatedUser });
  } catch (error: any) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

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
      // Fallback rule-based heuristic extraction if API key is not present
      const heuristicProfile = extractHeuristicProfile(text, mode);
      const merged = { ...(knownProfile || {}), ...heuristicProfile };
      return res.json({ profile: merged, extracted_by: "heuristic" });
    }

    const isScholarship = mode === "scholarships";

    // Contextual instruction acknowledging already known profile data from onboarding
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
- education_level: "school" | "undergraduate" | "postgraduate" | "diploma" | "any" | null (e.g. 10th/12th/school -> school, BA/BSc/BTech/college/degree -> undergraduate, MA/MSc/MTech/MBA -> postgraduate, polytechnic/diploma/ITI -> diploma)
- course_type: "general" | "technical" | "medical" | "vocational" | "any" | null (e.g. engineering/BTech -> technical, MBBS/pharma/nursing -> medical, arts/science/commerce -> general)
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
- district_type: "rural" | "urban" | "semi-urban" | "any" | null (e.g., "village/gaon/dehat" -> "rural", "city/shahar/town" -> "urban")
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

    // Merge known profile with newly extracted values
    const mergedProfile: UserProfile = {
      ...(knownProfile || {}),
    };

    // Only overwrite known fields if extracted has a non-null explicit value
    for (const key of Object.keys(extracted) as (keyof UserProfile)[]) {
      if (extracted[key] !== null && extracted[key] !== undefined) {
        (mergedProfile as any)[key] = extracted[key];
      }
    }

    return res.json({ profile: mergedProfile, extracted_by: "gemini" });
  } catch (error: any) {
    console.error("Profile extraction error:", error);
    // Graceful degradation: return heuristic profile merged with knownProfile
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

// 3. Deterministic Matching Endpoint (Pure rule-based matching against static schemes.json or scholarships.json)
app.post("/api/match-schemes", (req: Request, res: Response) => {
  try {
    const { profile, category_type = "scheme" } = req.body;
    const userProfile: UserProfile = profile || {};
    const isScholarship = category_type === "scholarship";
    const dataset: Scheme[] = (isScholarship ? scholarshipsData : schemesData) as Scheme[];

    const matchedResults = matchSchemes(userProfile, dataset, category_type);
    return res.json({
      total_matches: matchedResults.length,
      results: matchedResults,
    });
  } catch (error: any) {
    console.error("Matching error:", error);
    return res.status(500).json({ error: "Failed to match schemes" });
  }
});

// Heuristic fallback extractor in case of offline/timeout
function extractHeuristicProfile(text: string, mode: string = "schemes"): UserProfile {
  const lower = text.toLowerCase();
  const profile: UserProfile = {};

  // Age match (e.g., "25 years", "age 30", "28 yo", "22 saal")
  const ageMatch = lower.match(/(?:age\s*|i am\s*|meri umar\s*)?(\b\d{2}\b)(?:\s*(?:years|yr|saal|sal|वर्ष))?/i);
  if (ageMatch && parseInt(ageMatch[1], 10) >= 12 && parseInt(ageMatch[1], 10) <= 80) {
    profile.age = parseInt(ageMatch[1], 10);
  }

  // Gender
  if (lower.includes("female") || lower.includes("woman") || lower.includes("mahila") || lower.includes("aurat") || lower.includes("girl") || lower.includes("lady") || lower.includes("stree") || lower.includes("beti")) {
    profile.gender = "female";
  } else if (lower.includes("male") || lower.includes("man") || lower.includes("purush") || lower.includes("ladka") || lower.includes("boy") || lower.includes("aadmi")) {
    profile.gender = "male";
  }

  // Caste / Category
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

  // State detection
  const stateKeywords: Record<string, string> = {
    "uttar pradesh": "Uttar Pradesh",
    "up": "Uttar Pradesh",
    "bihar": "Bihar",
    "rajasthan": "Rajasthan",
    "madhya pradesh": "Madhya Pradesh",
    "mp": "Madhya Pradesh",
    "maharashtra": "Maharashtra",
    "odisha": "Odisha",
    "orissa": "Odisha",
    "west bengal": "West Bengal",
    "bengal": "West Bengal",
    "delhi": "Delhi",
    "tamil nadu": "Tamil Nadu",
    "karnataka": "Karnataka",
    "punjab": "Punjab",
    "haryana": "Haryana",
    "kerala": "Kerala",
    "jharkhand": "Jharkhand",
    "assam": "Assam",
    "gujarat": "Gujarat",
  };
  for (const [kw, st] of Object.entries(stateKeywords)) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
      profile.state = st;
      break;
    }
  }

  // District / Location type
  if (lower.includes("rural") || lower.includes("village") || lower.includes("gaon") || lower.includes("dehat") || lower.includes("gramin")) {
    profile.district_type = "rural";
  } else if (lower.includes("urban") || lower.includes("city") || lower.includes("shahar") || lower.includes("metro") || lower.includes("nagar")) {
    profile.district_type = "urban";
  } else if (lower.includes("semi-urban") || lower.includes("town") || lower.includes("kasba")) {
    profile.district_type = "semi-urban";
  }

  // Disability / Divyangjan
  if (lower.includes("disabilit") || lower.includes("divyang") || lower.includes("handicap") || lower.includes("pwd")) {
    profile.is_differently_abled = true;
  }

  // Mode-specific heuristics
  if (mode === "scholarships") {
    // Education Level
    if (lower.includes("12th") || lower.includes("10th") || lower.includes("8th") || lower.includes("9th") || lower.includes("11th") || lower.includes("school") || lower.includes("matric")) {
      profile.education_level = "school";
    } else if (lower.includes("undergraduate") || lower.includes("college") || lower.includes("btech") || lower.includes("b.tech") || lower.includes("be") || lower.includes("bsc") || lower.includes("ba") || lower.includes("bcom") || lower.includes("degree") || lower.includes("graduation")) {
      profile.education_level = "undergraduate";
    } else if (lower.includes("postgraduate") || lower.includes("masters") || lower.includes("mtech") || lower.includes("msc") || lower.includes("ma") || lower.includes("mba") || lower.includes("pg")) {
      profile.education_level = "postgraduate";
    } else if (lower.includes("diploma") || lower.includes("polytechnic") || lower.includes("iti")) {
      profile.education_level = "diploma";
    }

    // Course Stream
    if (lower.includes("engineer") || lower.includes("tech") || lower.includes("computer") || lower.includes("btech")) {
      profile.course_type = "technical";
    } else if (lower.includes("medical") || lower.includes("mbbs") || lower.includes("nursing") || lower.includes("pharma")) {
      profile.course_type = "medical";
    } else if (lower.includes("iti") || lower.includes("vocational") || lower.includes("skill")) {
      profile.course_type = "vocational";
    } else if (lower.includes("arts") || lower.includes("science") || lower.includes("commerce")) {
      profile.course_type = "general";
    }

    // Marks percentage (e.g. "85%", "75 percent", "80% marks")
    const marksMatch = lower.match(/(\b\d{2}\b)\s*(?:%|percent|pratishat)/i);
    if (marksMatch) {
      const val = parseInt(marksMatch[1], 10);
      if (val >= 35 && val <= 100) {
        profile.current_marks_percentage = val;
      }
    }
  } else {
    // Business Type
    if (lower.includes("tailor") || lower.includes("darzi") || lower.includes("artisan") || lower.includes("carpenter") || lower.includes("potter") || lower.includes("handicraft") || lower.includes("karigar") || lower.includes("silai")) {
      profile.business_type = "artisan_handicraft";
    } else if (lower.includes("street vendor") || lower.includes("vendor") || lower.includes("thela") || lower.includes("rehari") || lower.includes("rehri") || lower.includes("pheriwala") || lower.includes("cart")) {
      profile.business_type = "street_vendor";
    } else if (lower.includes("shop") || lower.includes("dukan") || lower.includes("kirana") || lower.includes("grocery") || lower.includes("store") || lower.includes("retail")) {
      profile.business_type = "retail_shop";
    } else if (lower.includes("weaving") || lower.includes("bunker") || lower.includes("bunkar") || lower.includes("textile") || lower.includes("kapda") || lower.includes("silk") || lower.includes("handloom")) {
      profile.business_type = "textile_weaving";
    } else if (lower.includes("dairy") || lower.includes("cow") || lower.includes("buffalo") || lower.includes("goat") || lower.includes("pashupalan") || lower.includes("milk") || lower.includes("doodh") || lower.includes("poultry")) {
      profile.business_type = "dairy_livestock";
    } else if (lower.includes("fish") || lower.includes("machhli") || lower.includes("machli") || lower.includes("aquaculture") || lower.includes("matsya")) {
      profile.business_type = "fisheries";
    } else if (lower.includes("food") || lower.includes("bakery") || lower.includes("pickle") || lower.includes("achar") || lower.includes("snack") || lower.includes("processing")) {
      profile.business_type = "food_processing";
    } else if (lower.includes("startup") || lower.includes("tech") || lower.includes("software") || lower.includes("it")) {
      profile.business_type = "tech_startup";
    } else if (lower.includes("factory") || lower.includes("manufacturing") || lower.includes("unit") || lower.includes("production")) {
      profile.business_type = "manufacturing";
    } else if (lower.includes("service") || lower.includes("repair") || lower.includes("saloon") || lower.includes("beauty")) {
      profile.business_type = "services";
    }
  }

  return profile;
}

// Start Server with Vite Middleware
async function startServer() {
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
