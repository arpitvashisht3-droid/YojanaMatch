from typing import List, Optional, Literal
from pydantic import BaseModel, Field

GenderType = Literal["female", "male", "transgender", "any"]
CasteCategoryType = Literal["sc", "st", "obc", "general", "minority", "ews", "any"]
DistrictType = Literal["rural", "urban", "semi-urban", "any"]
BusinessType = Literal[
    "manufacturing",
    "services",
    "retail_shop",
    "artisan_handicraft",
    "agriculture_allied",
    "street_vendor",
    "textile_weaving",
    "food_processing",
    "dairy_livestock",
    "fisheries",
    "tech_startup",
    "any"
]

class UserProfile(BaseModel):
    age: Optional[int] = Field(None, description="Age of the applicant in years")
    gender: Optional[GenderType] = Field(None, description="Gender of the applicant")
    caste_category: Optional[CasteCategoryType] = Field(None, description="Social caste category")
    state: Optional[str] = Field(None, description="Indian state of residence")
    district_type: Optional[DistrictType] = Field(None, description="Rural, urban, or semi-urban")
    business_type: Optional[BusinessType] = Field(None, description="Sector or business type")
    estimated_income: Optional[int] = Field(None, description="Annual income in INR")
    is_differently_abled: Optional[bool] = Field(None, description="Differently-abled / Divyangjan status")

class SchemeEligibility(BaseModel):
    min_age: Optional[int] = 18
    max_age: Optional[int] = None
    allowed_genders: Optional[List[str]] = ["any"]
    allowed_castes: Optional[List[str]] = ["any"]
    allowed_district_types: Optional[List[str]] = ["any"]
    allowed_business_types: Optional[List[str]] = ["any"]
    max_income_inr: Optional[int] = None
    priority_groups: Optional[List[str]] = []

class SchemeBenefits(BaseModel):
    max_loan_or_grant: str
    hindi_max_loan_or_grant: str
    benefit_percentage: str
    hindi_benefit_percentage: str
    collateral_free: bool

class Scheme(BaseModel):
    id: str
    name: str
    hindi_name: str
    ministry: str
    hindi_ministry: str
    benefit_headline: str
    hindi_benefit_headline: str
    official_link: str
    short_summary: str
    hindi_short_summary: str
    eligibility: SchemeEligibility
    benefits: SchemeBenefits

class MatchScoreDetail(BaseModel):
    criteria: str
    hindi_criteria: str
    matched: bool
    user_value: str
    scheme_requirement: str

class MatchedSchemeResult(BaseModel):
    scheme: Scheme
    match_score: int
    matched_criteria_count: int
    total_criteria_checked: int
    match_details: List[MatchScoreDetail]
    ai_explanation: Optional[str] = None

class BhashiniTranslateRequest(BaseModel):
    text: str = Field(..., description="Source text to translate", min_length=1)
    source_language: str = Field("en", description="Source ISO language code (e.g. en, hi)")
    target_language: str = Field("hi", description="Target ISO language code (e.g. hi, en, ta, te)")

class BhashiniTranslateResponse(BaseModel):
    translated_text: Optional[str] = Field(None, description="Translated text returned from BHASHINI API")
    source_language: str
    target_language: str
    status: str = Field(..., description="Execution status ('success' or 'error')")
    error: Optional[str] = Field(None, description="Error message if translation failed or credentials unconfigured")

