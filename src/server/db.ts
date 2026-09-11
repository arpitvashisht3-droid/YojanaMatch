import { 
  connectDB, 
  UserModel, 
  UserDocument, 
  EmbeddedUserProfile, 
  normalizePhoneNumber, 
  sanitizeUser as sanitizeMongoUser 
} from "yojanamatch-database";
import { UserRecord, SafeUser } from "../types";

/**
 * Format MongoDB UserDocument into API-friendly SafeUser format.
 * Flattens embedded profile properties for backward compatibility with existing UI.
 */
export function formatUserForResponse(doc: UserDocument | null): SafeUser | null {
  if (!doc) return null;
  const { password_hash, ...safeDoc } = doc;
  
  const profile = doc.profile || {};
  const onboarding = doc.onboarding || { completed: false, step: 1 };

  return {
    _id: doc._id?.toString(),
    id: doc._id?.toString(),
    name: doc.name,
    phone_number: doc.phone_number,
    role: doc.role || "user",
    preferred_language: doc.preferred_language || "en",
    onboarding_completed: onboarding.completed ?? false,
    onboarding_step: onboarding.step ?? 1,
    // Flattened profile attributes for backward compatibility
    age: profile.age ?? null,
    gender: profile.gender,
    caste_category: profile.caste_category,
    state: profile.state ?? null,
    district_type: profile.district_type,
    business_type: profile.business_type,
    estimated_income: profile.estimated_income ?? null,
    is_differently_abled: profile.is_differently_abled ?? false,
    education_level: profile.education_level,
    current_marks_percentage: profile.current_marks_percentage ?? null,
    course_type: profile.course_type,
    created_at: doc.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString(),
    updated_at: doc.updated_at ? new Date(doc.updated_at).toISOString() : new Date().toISOString(),
  } as SafeUser;
}

export function sanitizeUser(user: any): SafeUser | null {
  if (!user) return null;
  if ("profile" in user && "phone_number" in user && ("onboarding" in user || "_id" in user)) {
    return formatUserForResponse(user as UserDocument);
  }
  const { password_hash, ...safe } = user;
  return safe as SafeUser;
}

export function normalizePhone(phone: string): string {
  return normalizePhoneNumber(phone);
}

export async function findUserByPhone(rawPhone: string): Promise<UserDocument | null> {
  const cleanPhone = normalizePhoneNumber(rawPhone);
  if (!cleanPhone) return null;
  return await UserModel.findByPhone(cleanPhone);
}

export async function createUser(userData: {
  name: string;
  phone_number: string;
  password_hash?: string;
  role?: "user" | "admin";
  preferred_language?: "en" | "hi";
  profile?: EmbeddedUserProfile;
}): Promise<UserDocument> {
  return await UserModel.createUser(userData);
}

export async function updateUser(
  rawPhone: string,
  updates: any
): Promise<UserDocument | null> {
  const cleanPhone = normalizePhoneNumber(rawPhone);
  if (!cleanPhone) return null;
  
  const existing = await UserModel.findByPhone(cleanPhone);
  if (!existing || !existing._id) return null;

  // Extract root vs embedded updates
  const profileUpdates: Partial<EmbeddedUserProfile> = {};
  const rootUpdates: any = {};
  let onboardingStep: number | undefined = undefined;
  let onboardingCompleted: boolean | undefined = undefined;

  const profileKeys = [
    "age", "gender", "caste_category", "state", "district_type",
    "business_type", "estimated_income", "is_differently_abled",
    "education_level", "current_marks_percentage", "course_type"
  ];

  for (const [key, value] of Object.entries(updates)) {
    if (profileKeys.includes(key)) {
      (profileUpdates as any)[key] = value;
    } else if (key === "name" || key === "password_hash" || key === "preferred_language") {
      rootUpdates[key] = value;
    } else if (key === "onboarding_step") {
      onboardingStep = value as number;
    } else if (key === "onboarding_completed") {
      onboardingCompleted = value as boolean;
    }
  }

  let updatedDoc: UserDocument | null = existing;

  if (Object.keys(profileUpdates).length > 0) {
    updatedDoc = await UserModel.updateProfile(existing._id, profileUpdates);
  }

  if (Object.keys(rootUpdates).length > 0 && updatedDoc && updatedDoc._id) {
    updatedDoc = await UserModel.updateUser(updatedDoc._id, rootUpdates);
  }

  if ((onboardingStep !== undefined || onboardingCompleted !== undefined) && updatedDoc && updatedDoc._id) {
    const step = onboardingStep ?? updatedDoc.onboarding?.step ?? 1;
    const completed = onboardingCompleted ?? updatedDoc.onboarding?.completed ?? false;
    updatedDoc = await UserModel.updateOnboarding(updatedDoc._id, step, completed);
  }

  return updatedDoc;
}
