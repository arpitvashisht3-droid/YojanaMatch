import { ObjectId } from "mongodb";

export type Gender = "female" | "male" | "transgender" | "any";
export type CasteCategory = "sc" | "st" | "obc" | "general" | "minority" | "ews" | "any";
export type DistrictType = "rural" | "urban" | "semi-urban" | "any";
export type ContentMode = "schemes" | "scholarships";
export type EducationLevel = "school" | "undergraduate" | "postgraduate" | "diploma" | "any";
export type CourseType = "general" | "technical" | "medical" | "vocational" | "any";

export type BusinessType =
  | "manufacturing"
  | "services"
  | "retail_shop"
  | "artisan_handicraft"
  | "agriculture_allied"
  | "street_vendor"
  | "textile_weaving"
  | "food_processing"
  | "dairy_livestock"
  | "fisheries"
  | "tech_startup"
  | "any";

export type UserRole = "user" | "admin";

export interface EmbeddedUserProfile {
  age?: number | null;
  age_range?: string; // '18-25' | '26-35' | '36-45' | '46+'
  gender?: Gender;
  caste_category?: CasteCategory;
  categories?: string[];
  state?: string | null;
  district_type?: DistrictType;
  business_situation?: "existing" | "new";
  business_type?: BusinessType;
  business_type_custom?: string;
  business_age?: "0-1" | "1-3" | "3+";
  income_range?: string;
  estimated_income?: number | null;
  is_differently_abled?: boolean;
  education_level?: EducationLevel;
  current_marks_percentage?: number | null;
  course_type?: CourseType;
}

export interface UserOnboardingState {
  completed: boolean;
  step: number;
}

export interface UserDocument {
  _id?: ObjectId;
  name: string;
  phone_number: string; // 10-digit normalized Indian mobile
  password_hash?: string;
  role?: UserRole;
  onboarding: UserOnboardingState;
  profile: EmbeddedUserProfile;
  preferred_language?: "en" | "hi";
  saved_schemes?: string[];
  created_at: Date;
  updated_at: Date;
}

export type SafeUser = Omit<UserDocument, "password_hash">;

export interface SchemeEligibility {
  min_age?: number;
  max_age?: number | null;
  allowed_genders?: Gender[];
  allowed_castes?: CasteCategory[];
  allowed_district_types?: DistrictType[];
  allowed_business_types?: BusinessType[];
  max_income_inr?: number | null;
  requires_differently_abled?: boolean | null;
  priority_groups?: string[];
}

export interface SchemeBenefits {
  max_loan_or_grant?: string;
  hindi_max_loan_or_grant?: string;
  collateral_free?: boolean;
  benefit_percentage?: string;
  hindi_benefit_percentage?: string;
}

export interface SchemeDocument {
  _id?: ObjectId;
  scheme_id: string; // String identifier e.g. "pmegp"
  name: string;
  hindi_name: string;
  ministry: string;
  hindi_ministry: string;
  benefit_headline: string;
  hindi_benefit_headline: string;
  official_link: string;
  short_summary: string;
  hindi_short_summary: string;
  category_type: "scheme";
  eligibility: SchemeEligibility;
  benefits: SchemeBenefits;
  applicable_states: string[];
  category_tags: string[];
  popularity_score?: number;
  is_active: boolean;
  source: "curated" | "data_gov_in";
  created_at: Date;
  updated_at: Date;
}

export interface ScholarshipEligibility {
  min_age?: number | null;
  max_age?: number | null;
  allowed_genders?: Gender[];
  allowed_castes?: CasteCategory[];
  allowed_district_types?: DistrictType[];
  education_levels?: EducationLevel[];
  minimum_marks_percentage?: number | null;
  course_types?: CourseType[];
  max_income_inr?: number | null;
  requires_differently_abled?: boolean | null;
  priority_groups?: string[];
}

export interface ScholarshipBenefits {
  scholarship_amount?: string;
  hindi_scholarship_amount?: string;
  benefit_percentage?: string;
  hindi_benefit_percentage?: string;
}

export interface ScholarshipDocument {
  _id?: ObjectId;
  scholarship_id: string; // String identifier e.g. "post_matric_sc"
  name: string;
  hindi_name: string;
  ministry: string;
  hindi_ministry: string;
  benefit_headline: string;
  hindi_benefit_headline: string;
  official_link: string;
  short_summary: string;
  hindi_short_summary: string;
  category_type: "scholarship";
  eligibility: ScholarshipEligibility;
  benefits: ScholarshipBenefits;
  applicable_states: string[];
  category_tags: string[];
  popularity_score?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MatchScoreDetail {
  criteria: string;
  hindi_criteria: string;
  matched: boolean;
  user_value: string;
  scheme_requirement: string;
}

export interface MatchedResultItem {
  scheme_id: string;
  scheme_name: string;
  match_score: number; // 0 - 100
  matched_criteria_count: number;
  total_criteria_checked: number;
  match_details: MatchScoreDetail[];
  ai_explanation?: string;
  hindi_ai_explanation?: string;
}

export interface MatchHistoryDocument {
  _id?: ObjectId;
  user_id: ObjectId; // Foreign Key referencing users._id
  category_type: "scheme" | "scholarship";
  input_mode: "voice" | "text" | "onboarding";
  raw_input_text?: string;
  extracted_profile_snapshot: EmbeddedUserProfile;
  total_matches: number;
  results: MatchedResultItem[];
  language: "en" | "hi";
  created_at: Date;
}
