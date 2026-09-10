import os
import json
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from models import UserProfile, Scheme, MatchedSchemeResult, BhashiniTranslateRequest, BhashiniTranslateResponse
from matching import match_schemes
from bhashini import translate_text, is_bhashini_configured
import google.generativeai as genai

app = FastAPI(
    title="YojanaMatch API",
    description="Government Scheme Discovery and Eligibility Matching Engine for Marginalized Entrepreneurs",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load schemes.json static data
SCHEMES_FILE = os.path.join(os.path.dirname(__file__), "schemes.json")
try:
    with open(SCHEMES_FILE, "r", encoding="utf-8") as f:
        schemes_raw = json.load(f)
        SCHEMES: List[Scheme] = [Scheme(**s) for s in schemes_raw]
except Exception as e:
    print(f"Warning: Could not load schemes.json: {e}")
    SCHEMES = []

# Gemini configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class ExtractProfileRequest(BaseModel):
    text: str
    language: Optional[str] = "en"

class ExplainSchemeRequest(BaseModel):
    scheme: Scheme
    profile: Optional[UserProfile] = None
    language: Optional[str] = "en"

class MatchRequest(BaseModel):
    profile: UserProfile

@app.get("/")
def read_root():
    return {"name": "YojanaMatch API", "status": "active", "total_schemes": len(SCHEMES)}

@app.post("/api/extract-profile")
async def extract_profile_endpoint(req: ExtractProfileRequest):
    """
    Gemini Call 1: Extracts structured attributes from free-text or transcribed voice input.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if not GEMINI_API_KEY:
        # Fallback profile if API key not available
        return {"profile": {}, "extracted_by": "heuristic_fallback"}

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={"temperature": 0.1, "response_mime_type": "application/json"}
        )
        prompt = f"""
        Extract user attributes into JSON from: "{req.text}"
        Schema:
        {{
          "age": integer or null,
          "gender": "female" | "male" | "transgender" | "any" | null,
          "caste_category": "sc" | "st" | "obc" | "general" | "minority" | "ews" | "any" | null,
          "state": string or null,
          "district_type": "rural" | "urban" | "semi-urban" | "any" | null,
          "business_type": "manufacturing" | "services" | "retail_shop" | "artisan_handicraft" | "agriculture_allied" | "street_vendor" | "textile_weaving" | "food_processing" | "dairy_livestock" | "fisheries" | "tech_startup" | "any" | null,
          "estimated_income": integer or null,
          "is_differently_abled": boolean or null
        }}
        """
        response = model.generate_content(prompt)
        profile_dict = json.loads(response.text)
        return {"profile": profile_dict, "extracted_by": "gemini"}
    except Exception as e:
        print(f"Extraction error: {e}")
        return {"profile": {}, "extracted_by": "fallback_error"}

@app.post("/api/match-schemes")
def match_schemes_endpoint(req: MatchRequest):
    """
    Deterministic rule-based matching engine against schemes.json.
    Pure rule matching, no LLM hallucinations.
    """
    results = match_schemes(req.profile, SCHEMES)
    return {
        "total_matches": len(results),
        "results": results
    }

@app.post("/api/explain-scheme")
async def explain_scheme_endpoint(req: ExplainSchemeRequest):
    """
    Gemini Call 2: Generates plain-language explanation (max 60 words, 6th-grade reading level).
    """
    if not GEMINI_API_KEY:
        fallback = req.scheme.hindi_short_summary if req.language == "hi" else req.scheme.short_summary
        return {"explanation": fallback}

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={"temperature": 0.4}
        )
        target_lang = "Hindi" if req.language == "hi" else "simple plain English"
        prompt = f"""
        Explain in {target_lang} (under 60 words, 6th-grade reading level) why this user is eligible for {req.scheme.name} ({req.scheme.benefit_headline}).
        User background: {req.profile.model_dump() if req.profile else 'Marginalized entrepreneur'}.
        Address the applicant directly without jargon.
        """
        response = model.generate_content(prompt)
        return {"explanation": response.text.strip()}
    except Exception as e:
        print(f"Explanation error: {e}")
        fallback = req.scheme.hindi_short_summary if req.language == "hi" else req.scheme.short_summary
        return {"explanation": fallback}

@app.post("/api/bhashini/translate", response_model=BhashiniTranslateResponse)
async def bhashini_translate_endpoint(req: BhashiniTranslateRequest):
    """
    BHASHINI API Translation Endpoint (MeitY AI for Bharat).
    Translates text between Indian languages and English using official BHASHINI ULCA API.
    Returns HTTP 503 if BHASHINI credentials are not configured in environment.
    """
    if not is_bhashini_configured():
        raise HTTPException(
            status_code=503,
            detail="BHASHINI API credentials not configured. Please set BHASHINI_USER_ID and BHASHINI_API_KEY in environment."
        )
    
    res = translate_text(
        text=req.text,
        source_lang=req.source_language,
        target_lang=req.target_language
    )
    
    if res.get("status") != "success":
        raise HTTPException(
            status_code=502,
            detail=res.get("error") or "BHASHINI translation service error"
        )
        
    return BhashiniTranslateResponse(**res)

