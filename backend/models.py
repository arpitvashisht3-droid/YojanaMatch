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
EducationLevelType = Literal["school", "undergraduate", "postgraduate", "diploma", "any"]
CourseStreamType = Literal["general", "technical", "medical", "vocational", "any"]

class UserProfile(BaseModel):
    age: Optional[int] = Field(None, description="Age of the applicant in years")
    gender: Optional[GenderType] = Field(None, description="Gender of the applicant")
    caste_category: Optional[CasteCategoryType] = Field(None, description="Social caste category")
    state: Optional[str] = Field(None, description="Indian state of residence")
    district_type: Optional[DistrictType] = Field(None, description="Rural, urban, or semi-urban")
    business_type: Optional[BusinessType] = Field(None, description="Sector or business type")
    estimated_income: Optional[int] = Field(None, description="Annual income in INR")
    is_differently_abled: Optional[bool] = Field(None, description="Differently-abled / Divyangjan status")
    education_level: Optional[EducationLevelType] = Field(None, description="Education level")
    course_type: Optional[CourseStreamType] = Field(None, description="Course stream / type")
    current_marks_percentage: Optional[int] = Field(None, description="Marks percentage in previous exam")

class SchemeEligibility(BaseModel):
    min_age: Optional[int] = 18
    max_age: Optional[int] = None
    allowed_genders: Optional[List[str]] = ["any"]
    allowed_castes: Optional[List[str]] = ["any"]
    allowed_district_types: Optional[List[str]] = ["any"]
    allowed_business_types: Optional[List[str]] = ["any"]
    max_income_inr: Optional[int] = None
    priority_groups: Optional[List[str]] = []
    education_levels: Optional[List[str]] = None
    minimum_marks_percentage: Optional[int] = None
    course_types: Optional[List[str]] = None
    requires_differently_abled: Optional[bool] = None

class SchemeBenefits(BaseModel):
    max_loan_or_grant: Optional[str] = None
    hindi_max_loan_or_grant: Optional[str] = None
    benefit_percentage: Optional[str] = None
    hindi_benefit_percentage: Optional[str] = None
    collateral_free: Optional[bool] = None
    scholarship_amount: Optional[str] = None

class Scheme(BaseModel):
    id: str
    name: str
    hindi_name: Optional[str] = None
    ministry: str
    hindi_ministry: Optional[str] = None
    benefit_headline: str
    hindi_benefit_headline: Optional[str] = None
    official_link: str
    short_summary: str
    hindi_short_summary: Optional[str] = None
    eligibility: Optional[SchemeEligibility] = None
    benefits: Optional[SchemeBenefits] = None
    category: Optional[str] = "scheme"
    applicable_states: Optional[List[str]] = []
    popularity_score: Optional[int] = None
    date_added: Optional[str] = None
    category_tags: Optional[List[str]] = []

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
