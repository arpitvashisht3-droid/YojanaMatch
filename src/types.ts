export type Gender = 'female' | 'male' | 'transgender' | 'any';
export type CasteCategory = 'sc' | 'st' | 'obc' | 'general' | 'minority' | 'ews' | 'any';
export type DistrictType = 'rural' | 'urban' | 'semi-urban' | 'any';
export type ContentMode = 'schemes' | 'scholarships';
export type EducationLevel = 'school' | 'undergraduate' | 'postgraduate' | 'diploma' | 'any';
export type CourseType = 'general' | 'technical' | 'medical' | 'vocational' | 'any';

export type BusinessType = 
  | 'manufacturing' 
  | 'services' 
  | 'retail_shop' 
  | 'artisan_handicraft' 
  | 'agriculture_allied' 
  | 'street_vendor' 
  | 'textile_weaving' 
  | 'food_processing' 
  | 'dairy_livestock' 
  | 'fisheries' 
  | 'tech_startup' 
  | 'any';

export interface UserProfile {
  age?: number | null;
  gender?: Gender;
  caste_category?: CasteCategory;
  state?: string | null;
  district_type?: DistrictType;
  business_type?: BusinessType;
  estimated_income?: number | null; // Annual in INR
  is_differently_abled?: boolean;
  // Scholarship-specific fields
  education_level?: EducationLevel;
  current_marks_percentage?: number | null;
  course_type?: CourseType;
}

export interface SchemeEligibility {
  min_age?: number;
  max_age?: number;
  allowed_genders?: Gender[]; // includes 'any' if open to all
  allowed_castes?: CasteCategory[]; // includes 'any' if open to all
  allowed_district_types?: DistrictType[];
  allowed_business_types?: BusinessType[];
  max_income_inr?: number; // ceiling
  requires_differently_abled?: boolean;
  priority_groups?: string[]; // tags like 'Women', 'SC/ST', 'Rural', 'Artisans'
  // Education & scholarship eligibility
  education_levels?: EducationLevel[];
  minimum_marks_percentage?: number;
  course_types?: CourseType[];
}

export interface Scheme {
  id: string;
  name: string;
  hindi_name: string;
  ministry: string;
  hindi_ministry: string;
  benefit_headline: string;
  hindi_benefit_headline: string;
  official_link: string;
  short_summary: string;
  hindi_short_summary: string;
  eligibility: SchemeEligibility;
  benefits: {
    max_loan_or_grant: string;
    hindi_max_loan_or_grant: string;
    benefit_percentage: string;
    hindi_benefit_percentage: string;
    collateral_free: boolean;
  };
  popularity_score?: number;
  date_added?: string;
  applicable_states?: string[];
  category_tags?: string[];
}

export interface UserRecord {
  id?: string;
  _id?: string;
  name: string;
  phone_number: string;
  created_at: string;
  updated_at?: string;
  onboarding_completed: boolean;
  onboarding_step?: number;
  // Profile fields collected in onboarding
  age?: number | null;
  age_range?: string; // '18-25' | '26-35' | '36-45' | '46+'
  gender?: Gender;
  caste_category?: CasteCategory;
  categories?: string[];
  state?: string | null;
  district_type?: DistrictType;
  business_situation?: 'existing' | 'new';
  business_type?: BusinessType;
  business_type_custom?: string;
  business_age?: '0-1' | '1-3' | '3+';
  income_range?: string;
  estimated_income?: number | null;
  is_differently_abled?: boolean;
  // Scholarship-specific fields
  education_level?: EducationLevel;
  current_marks_percentage?: number | null;
  course_type?: CourseType;
  saved_schemes?: string[];
}

export interface MatchScoreDetail {
  criteria: string;
  hindi_criteria: string;
  matched: boolean;
  user_value: string;
  scheme_requirement: string;
}

export interface MatchedSchemeResult {
  scheme: Scheme;
  match_score: number; // 0 - 100
  matched_criteria_count: number;
  total_criteria_checked: number;
  match_details: MatchScoreDetail[];
  ai_explanation?: string;
  hindi_ai_explanation?: string;
}

export interface FollowUpQuestion {
  field: keyof UserProfile;
  question_en: string;
  question_hi: string;
  options: {
    label_en: string;
    label_hi: string;
    value: any;
  }[];
  allow_free_text?: boolean;
}

export type AppLanguage = 'en' | 'hi';
export type AppScreen = 'signup' | 'onboarding' | 'landing' | 'followup' | 'results' | 'about' | 'profile' | 'saved';
