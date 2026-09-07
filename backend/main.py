import os
import re
import json
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from models import UserProfile, Scheme, MatchedSchemeResult
from matching import match_schemes
from catalogue import (
    load_catalogue,
    is_catalogue_configured,
    is_catalogue_live,
    catalogue_last_error,
)
import google.generativeai as genai

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

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

# Catalogue is loaded exclusively via data.gov.in HTTP (see catalogue.py).
# Module-level snapshot refreshed through load_catalogue(); no local JSON fallback.
SCHEMES, SCHOLARSHIPS = load_catalogue()

# Gemini configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _current_catalogue():
    """Return the in-memory live catalogue (empty when not configured / not live)."""
    global SCHEMES, SCHOLARSHIPS
    SCHEMES, SCHOLARSHIPS = load_catalogue()
    return SCHEMES, SCHOLARSHIPS


def _require_live_catalogue():
    """Reject matching when the government catalogue is not configured or not live."""
    schemes, scholarships = _current_catalogue()
    if not is_catalogue_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Government catalogue is not configured. "
                "Set DATA_GOV_IN_API_KEY and SCHEME_DATA_SOURCE_URL "
                "to a data.gov.in resource API URL."
            ),
        )
    if not is_catalogue_live() or (not schemes and not scholarships):
        raise HTTPException(
            status_code=503,
            detail=(
                catalogue_last_error()
                or "Government catalogue is configured but not live. "
                "Verify SCHEME_DATA_SOURCE_URL and DATA_GOV_IN_API_KEY."
            ),
        )
    return schemes, scholarships

class ExtractProfileRequest(BaseModel):
    text: str
    language: Optional[str] = "en"
    knownProfile: Optional[UserProfile] = None
    mode: Optional[str] = "schemes"

class ExplainSchemeRequest(BaseModel):
    scheme: Scheme
    profile: Optional[UserProfile] = None
    language: Optional[str] = "en"
    mode: Optional[str] = "schemes"

class MatchRequest(BaseModel):
    profile: UserProfile
    category_type: Optional[str] = "scheme"
    mode: Optional[str] = "schemes"


def extract_heuristic_profile(text: str, mode: str = "schemes") -> dict:
    """
    Deterministic rule-based offline heuristic profile extractor for English, Hindi, & Hinglish.
    Runs when GEMINI_API_KEY is missing or Gemini API fails/rate-limits.
    """
    lower = text.lower()
    profile = {}

    # 1. Age extraction
    age_match = re.search(r'(?:age\s*|i am\s*|meri umar\s*|umar\s*|उम्र\s*|आयु\s*)?(\b\d{2}\b)(?:\s*(?:years|yr|yo|saal|sal|वर्ष|saal ki|saal ka|साल))?', lower)
    if age_match:
        val = int(age_match.group(1))
        if 12 <= val <= 80:
            profile['age'] = val

    # 2. Gender extraction
    if any(k in lower for k in ["female", "woman", "mahila", "aurat", "girl", "lady", "stree", "beti", "ladki", "महिला", "स्त्री", "लड़की"]):
        profile['gender'] = "female"
    elif any(k in lower for k in ["male", "man", "purush", "ladka", "boy", "aadmi", "पुरुष", "आदमी", "लड़का"]):
        profile['gender'] = "male"

    # 3. Caste Category extraction
    # Use word-boundary patterns for short tokens (sc, st) to avoid false positives
    # from words like "street", "school", "second", etc.
    if re.search(r'\bsc\b', lower) or any(k in lower for k in ["scheduled caste", "dalit", "anusuchit jaati", "एससी", "अनुसूचित जाति"]):
        profile['caste_category'] = "sc"
    elif re.search(r'\bst\b', lower) or any(k in lower for k in ["scheduled tribe", "adivasi", "anusuchit janjati", "एसटी", "अनुसूचित जनजाति"]):
        profile['caste_category'] = "st"
    elif re.search(r'\bobc\b', lower) or any(k in lower for k in ["other backward", "pichhda", "pichhada", "ओबीसी", "पिछड़ा"]):
        profile['caste_category'] = "obc"
    elif any(k in lower for k in ["minority", "muslim", "alpashankhyak", "sikh", "christian", "अल्पसंख्यक"]):
        profile['caste_category'] = "minority"
    elif re.search(r'\bews\b', lower) or "economically weaker" in lower:
        profile['caste_category'] = "ews"
    elif any(k in lower for k in ["general category", "samanya", "सामान्य"]):
        profile['caste_category'] = "general"

    # 4. State extraction
    states_map = {
        "uttar pradesh": "Uttar Pradesh", "up": "Uttar Pradesh", "उत्तर प्रदेश": "Uttar Pradesh",
        "bihar": "Bihar", "बिहार": "Bihar",
        "rajasthan": "Rajasthan", "राजस्थान": "Rajasthan",
        "madhya pradesh": "Madhya Pradesh", "mp": "Madhya Pradesh", "मध्य प्रदेश": "Madhya Pradesh",
        "maharashtra": "Maharashtra", "महाराष्ट्र": "Maharashtra",
        "odisha": "Odisha", "orissa": "Odisha", "ओडिशा": "Odisha",
        "west bengal": "West Bengal", "bengal": "West Bengal", "पश्चिम बंगाल": "West Bengal",
        "delhi": "Delhi", "दिल्ली": "Delhi",
        "tamil nadu": "Tamil Nadu", "तमिलनाडु": "Tamil Nadu",
        "karnataka": "Karnataka", "कर्नाटक": "Karnataka",
        "punjab": "Punjab", "पंजाब": "Punjab",
        "haryana": "Haryana", "हरियाणा": "Haryana",
        "kerala": "Kerala", "केरल": "Kerala",
        "jharkhand": "Jharkhand", "झारखंड": "Jharkhand",
        "assam": "Assam", "असम": "Assam",
        "gujarat": "Gujarat", "गुजरात": "Gujarat",
        "telangana": "Telangana", "तेलंगाना": "Telangana",
        "andhra pradesh": "Andhra Pradesh", "आंध्र प्रदेश": "Andhra Pradesh",
        "chhattisgarh": "Chhattisgarh", "छत्तीसगढ़": "Chhattisgarh",
        "uttarakhand": "Uttarakhand", "उत्तराखंड": "Uttarakhand",
        "himachal pradesh": "Himachal Pradesh", "हिमाचल प्रदेश": "Himachal Pradesh"
    }
    for kw, st_name in states_map.items():
        pattern = r'\b' + re.escape(kw) + r'\b' if len(kw) <= 3 else re.escape(kw)
        if re.search(pattern, lower):
            profile['state'] = st_name
            break

    # 5. District / Location Type extraction
    if any(k in lower for k in ["rural", "village", "gaon", "dehat", "gramin", "ग्रामीण"]):
        profile['district_type'] = "rural"
    elif any(k in lower for k in ["urban", "city", "shahar", "metro", "nagar", "शहरी", "शहर"]):
        profile['district_type'] = "urban"
    elif any(k in lower for k in ["semi-urban", "town", "kasba", "कस्बा"]):
        profile['district_type'] = "semi-urban"

    # 6. Income extraction
    lakh_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs|लख|लाख)', lower)
    if lakh_match:
        profile['estimated_income'] = int(float(lakh_match.group(1)) * 100000)
    else:
        k_match = re.search(r'(\d+)\s*k\b', lower)
        if k_match:
            profile['estimated_income'] = int(k_match.group(1)) * 1000
        else:
            raw_inc_match = re.search(r'(?:rs\.?|inr|₹|income|aay|aai|salary|loan of|रुपये|रूपये)\s*(\d[\d,]+)', lower)
            if raw_inc_match:
                clean_digits = raw_inc_match.group(1).replace(',', '')
                if clean_digits.isdigit() and int(clean_digits) >= 5000:
                    profile['estimated_income'] = int(clean_digits)

    # 7. Differently-Abled (PwD) extraction
    if any(k in lower for k in ["disabilit", "divyang", "handicap", "pwd", "viklang", "दिव्यांग", "विकलांग"]):
        profile['is_differently_abled'] = True

    # 8. Mode-specific business / education extraction
    if mode == "scholarships":
        if any(k in lower for k in ["12th", "10th", "8th", "9th", "11th", "school", "matric", "स्कूल"]):
            profile['education_level'] = "school"
        elif any(k in lower for k in ["undergraduate", "college", "btech", "b.tech", "be", "bsc", "ba", "bcom", "degree", "graduation", "कॉलेज"]):
            profile['education_level'] = "undergraduate"
        elif any(k in lower for k in ["postgraduate", "masters", "mtech", "msc", "ma", "mba", "pg"]):
            profile['education_level'] = "postgraduate"
        elif any(k in lower for k in ["diploma", "polytechnic", "iti", "डिप्लोमा"]):
            profile['education_level'] = "diploma"

        if any(k in lower for k in ["engineer", "tech", "computer", "btech"]):
            profile['course_type'] = "technical"
        elif any(k in lower for k in ["medical", "mbbs", "nursing", "pharma"]):
            profile['course_type'] = "medical"
        elif any(k in lower for k in ["iti", "vocational", "skill"]):
            profile['course_type'] = "vocational"
        elif any(k in lower for k in ["arts", "science", "commerce"]):
            profile['course_type'] = "general"

        marks_match = re.search(r'(\b\d{2}\b)\s*(?:%|percent|pratishat|marks|प्रतिशत)', lower)
        if marks_match:
            m_val = int(marks_match.group(1))
            if 35 <= m_val <= 100:
                profile['current_marks_percentage'] = m_val
    else:
        if any(k in lower for k in ["farmer", "kisan", "krishi", "agriculture", "kheti", "crop", "farm", "किसान", "कृषि"]):
            profile['business_type'] = "agriculture_allied"
        elif any(k in lower for k in ["tailor", "darzi", "artisan", "carpenter", "potter", "handicraft", "karigar", "silai", "दर्जी", "कारीगर"]):
            profile['business_type'] = "artisan_handicraft"
        elif any(k in lower for k in ["street vendor", "vendor", "thela", "rehari", "rehri", "pheriwala", "cart", "ठेला", "फेरीवाला"]):
            profile['business_type'] = "street_vendor"
        elif any(k in lower for k in ["shop", "dukan", "kirana", "grocery", "store", "retail", "दुकान", "किराना"]):
            profile['business_type'] = "retail_shop"
        elif any(k in lower for k in ["weaving", "bunker", "bunkar", "textile", "kapda", "silk", "handloom", "बुनकर"]):
            profile['business_type'] = "textile_weaving"
        elif any(k in lower for k in ["dairy", "cow", "buffalo", "goat", "pashupalan", "milk", "doodh", "poultry", "डेयरी", "पशुपालन"]):
            profile['business_type'] = "dairy_livestock"
        elif any(k in lower for k in ["fish", "machhli", "machli", "aquaculture", "matsya", "मछली"]):
            profile['business_type'] = "fisheries"
        elif any(k in lower for k in ["food", "bakery", "pickle", "achar", "snack", "processing"]):
            profile['business_type'] = "food_processing"
        elif any(k in lower for k in ["startup", "tech", "software", "it"]):
            profile['business_type'] = "tech_startup"
        elif any(k in lower for k in ["factory", "manufacturing", "unit", "production"]):
            profile['business_type'] = "manufacturing"
        elif any(k in lower for k in ["service", "repair", "saloon", "beauty"]):
            profile['business_type'] = "services"

    return profile


def merge_profiles(known: Optional[UserProfile], extracted_dict: dict) -> UserProfile:
    """
    Safely merges extracted_dict into knownProfile without overwriting existing known attributes
    with None, null, empty strings, or unmentioned values.
    """
    base_dict = known.model_dump(exclude_unset=True, exclude_none=True) if known else {}

    valid_keys = set(UserProfile.model_fields.keys())
    for k, v in extracted_dict.items():
        if k in valid_keys and v is not None and v != "":
            base_dict[k] = v

    return UserProfile(**base_dict)


@app.get("/")
def read_root():
    schemes, scholarships = _current_catalogue()
    return {
        "name": "YojanaMatch API",
        "status": "active",
        "catalogue_live": is_catalogue_live(),
        "catalogue_configured": is_catalogue_configured(),
        "total_schemes": len(schemes),
        "total_scholarships": len(scholarships),
        "total_catalogue_records": len(schemes) + len(scholarships)
    }

@app.get("/api/health")
def health_check():
    schemes, scholarships = _current_catalogue()
    live = is_catalogue_live()
    payload = {
        "status": "ok",
        "catalogue_live": live,
        "catalogue_configured": is_catalogue_configured(),
        "schemes_count": len(schemes),
        "scholarships_count": len(scholarships),
        "total_catalogue_records": len(schemes) + len(scholarships)
    }
    if not live and catalogue_last_error():
        payload["catalogue_error"] = catalogue_last_error()
    return payload

@app.post("/api/extract-profile")
async def extract_profile_endpoint(req: ExtractProfileRequest):
    """
    Gemini Call 1: Extracts structured attributes from free-text or transcribed voice input.
    Merges with knownProfile safely and degrades to heuristic offline extractor if Gemini is unavailable.
    """
    text_clean = (req.text or "").strip()
    if not text_clean:
        fallback_profile = req.knownProfile or UserProfile()
        return {"profile": fallback_profile.model_dump(exclude_none=True), "extracted_by": "empty_input_fallback"}

    if not GEMINI_API_KEY:
        heuristic_dict = extract_heuristic_profile(text_clean, req.mode or "schemes")
        merged = merge_profiles(req.knownProfile, heuristic_dict)
        return {"profile": merged.model_dump(exclude_none=True), "extracted_by": "heuristic_fallback"}

    try:
        known_context = ""
        if req.knownProfile:
            kp = req.knownProfile
            known_context = f"""
NOTE: The user's onboarding profile already has:
Age: {kp.age or "unspecified"}
Gender: {kp.gender or "unspecified"}
Category: {kp.caste_category or "unspecified"}
State: {kp.state or "unspecified"}
District Type: {kp.district_type or "unspecified"}
Business Sector: {kp.business_type or "unspecified"}
Income: {f"₹{kp.estimated_income}" if kp.estimated_income else "unspecified"}
Education Level: {kp.education_level or "unspecified"}
Do NOT re-extract or conflict with these known attributes unless the user explicitly states a change. Focus on extracting any NEW attributes or requirements.
"""

        system_instruction = f"""You are a strict data extraction system for Indian government schemes and scholarships discovery.
Analyze the user's free-text or transcribed voice input (which may be in English, Hindi, or Hinglish).
{known_context}
Extract the following structured attributes into JSON without inferring false positives:
- age: integer or null (e.g. 28)
- gender: "female" | "male" | "transgender" | "any" | null
- caste_category: "sc" | "st" | "obc" | "general" | "minority" | "ews" | "any" | null
- state: Indian state name or null (e.g. "Haryana", "Uttar Pradesh", "Bihar")
- district_type: "rural" | "urban" | "semi-urban" | "any" | null
- business_type: "manufacturing" | "services" | "retail_shop" | "artisan_handicraft" | "agriculture_allied" | "street_vendor" | "textile_weaving" | "food_processing" | "dairy_livestock" | "fisheries" | "tech_startup" | "any" | null
- estimated_income: integer (estimated annual income or loan requirement in INR e.g. 5 lakh -> 500000) or null
- is_differently_abled: boolean or null
- education_level: "school" | "undergraduate" | "postgraduate" | "diploma" | "any" | null
- course_type: "general" | "technical" | "medical" | "vocational" | "any" | null
- current_marks_percentage: integer or null

Return ONLY accurate JSON matching the schema. Do not make up information that was not mentioned in the text."""

        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={"temperature": 0.1, "response_mime_type": "application/json"}
        )
        prompt = f"Extract user attributes into JSON from: \"{text_clean}\""
        response = model.generate_content([system_instruction, prompt])
        
        raw_text = (response.text or "").strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        data_dict = json.loads(raw_text)
        if not isinstance(data_dict, dict):
            raise ValueError("Gemini output is not a JSON object")

        valid_keys = set(UserProfile.model_fields.keys())
        filtered_dict = {k: v for k, v in data_dict.items() if k in valid_keys and v is not None and v != ""}

        merged_profile = merge_profiles(req.knownProfile, filtered_dict)
        return {"profile": merged_profile.model_dump(exclude_none=True), "extracted_by": "gemini"}

    except Exception as e:
        print(f"Extraction error (falling back to heuristic): {e}")
        heuristic_dict = extract_heuristic_profile(text_clean, req.mode or "schemes")
        merged = merge_profiles(req.knownProfile, heuristic_dict)
        return {"profile": merged.model_dump(exclude_none=True), "extracted_by": "heuristic_fallback"}

@app.post("/api/match-schemes")
def match_schemes_endpoint(req: MatchRequest):
    """
    Deterministic rule-based matching engine against the live government catalogue.
    Pure rule matching, no LLM hallucinations. Requires configured data.gov.in source.
    """
    schemes, scholarships = _require_live_catalogue()

    is_scholarship = (req.category_type == "scholarship" or req.mode == "scholarships")
    dataset = scholarships if is_scholarship else schemes
    cat_type = "scholarship" if is_scholarship else "scheme"

    results = match_schemes(req.profile, dataset, category_type=cat_type)
    return {
        "total_matches": len(results),
        "results": results
    }

@app.post("/api/explain-scheme")
async def explain_scheme_endpoint(req: ExplainSchemeRequest):
    """
    Gemini Call 2: Generates personalized, plain-language explanation (max 60 words, 6th-grade reading level).
    Degrades gracefully to static summary fallback if Gemini is missing, rate-limited, or errors out.
    """
    scheme = req.scheme
    profile = req.profile
    lang = (req.language or "en").lower()
    is_hi = (lang == "hi")
    mode = req.mode or "schemes"
    is_scholarship = (mode == "scholarships") or (scheme.eligibility and scheme.eligibility.education_levels is not None)

    # Deterministic fallback text
    fallback_text = (
        (scheme.hindi_short_summary if is_hi and scheme.hindi_short_summary else scheme.short_summary)
        or f"You are eligible for {scheme.name} ({scheme.benefit_headline})."
    )

    if not GEMINI_API_KEY:
        return {"explanation": fallback_text}

    try:
        target_lang = "Hindi (हिंदी)" if is_hi else "simple plain English"
        role_title = (
            "scholarships guidance advisor for Indian students"
            if is_scholarship
            else "advisor explaining Indian government schemes to a marginalized entrepreneur"
        )

        system_instruction = f"""You are a warm, helpful {role_title}.
Write a plain-language explanation in {target_lang} about why this {"scholarship" if is_scholarship else "scheme"} is beneficial for this applicant.
Strict constraints:
1. Maximum 60 words.
2. 6th-grade reading level (simple words, zero bureaucratic jargon).
3. Directly state the exact benefit ({"scholarship amount / financial grant" if is_scholarship else "loan amount / financial subsidy"}) and why they qualify.
4. Do NOT say 'as an AI'. Write directly to the applicant ('You can get...', 'आपको मिलेगा...')."""

        if is_scholarship:
            prompt = f"""Scholarship: {scheme.name} ({scheme.benefit_headline})
User Profile: Age {profile.age if profile and profile.age else 'unspecified'}, Gender {profile.gender if profile and profile.gender else 'unspecified'}, Category {profile.caste_category if profile and profile.caste_category else 'unspecified'}, Education {profile.education_level if profile and profile.education_level else 'unspecified'}, Marks {f"{profile.current_marks_percentage}%" if profile and profile.current_marks_percentage else 'unspecified'}, Stream {profile.course_type if profile and profile.course_type else 'unspecified'}, State {profile.state if profile and profile.state else 'unspecified'}, Income {f"₹{profile.estimated_income}" if profile and profile.estimated_income else 'unspecified'}.
Explain why they qualify and how this scholarship supports their education in under 60 words in {target_lang}."""
        else:
            prompt = f"""Scheme: {scheme.name} ({scheme.benefit_headline})
User Profile: Age {profile.age if profile and profile.age else 'unspecified'}, Gender {profile.gender if profile and profile.gender else 'unspecified'}, Category {profile.caste_category if profile and profile.caste_category else 'unspecified'}, Area {profile.district_type if profile and profile.district_type else 'unspecified'}, Business {profile.business_type if profile and profile.business_type else 'unspecified'}, Income {f"₹{profile.estimated_income}" if profile and profile.estimated_income else 'unspecified'}.
Explain why they qualify and how this scheme helps them in under 60 words in {target_lang}."""

        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={"temperature": 0.4}
        )
        response = model.generate_content([system_instruction, prompt])

        exp_text = (response.text or "").strip()
        if exp_text:
            return {"explanation": exp_text}
        else:
            return {"explanation": fallback_text}

    except Exception as e:
        print(f"Explanation error (falling back to static summary): {e}")
        return {"explanation": fallback_text}
