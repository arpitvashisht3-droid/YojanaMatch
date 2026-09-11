import { ObjectId, WithId } from "mongodb";
import { getUsersCollection } from "../config/connection.js";
import { UserDocument, SafeUser, EmbeddedUserProfile } from "../types/index.js";

/**
 * Clean phone number normalization helper (10 digits Indian format)
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Remove sensitive credentials from user document before returning to API response
 */
export function sanitizeUser(user: UserDocument | WithId<UserDocument>): SafeUser {
  const { password_hash, ...safe } = user;
  return safe;
}

export class UserModel {
  /**
   * Find user by unique normalized 10-digit phone number
   */
  static async findByPhone(phone: string): Promise<UserDocument | null> {
    const cleanPhone = normalizePhoneNumber(phone);
    if (!cleanPhone) return null;
    const col = getUsersCollection();
    return await col.findOne({ phone_number: cleanPhone });
  }

  /**
   * Find user by MongoDB _id
   */
  static async findById(id: ObjectId | string): Promise<UserDocument | null> {
    const objId = typeof id === "string" ? new ObjectId(id) : id;
    const col = getUsersCollection();
    return await col.findOne({ _id: objId });
  }

  /**
   * Create new user record
   */
  static async createUser(userData: {
    name: string;
    phone_number: string;
    password_hash?: string;
    role?: "user" | "admin";
    preferred_language?: "en" | "hi";
    profile?: EmbeddedUserProfile;
  }): Promise<UserDocument> {
    const cleanPhone = normalizePhoneNumber(userData.phone_number);
    if (!cleanPhone || cleanPhone.length !== 10) {
      throw new Error("Invalid 10-digit Indian phone number");
    }

    const existing = await this.findByPhone(cleanPhone);
    if (existing) {
      throw new Error("User with this phone number already exists");
    }

    const now = new Date();
    const newUser: UserDocument = {
      name: userData.name.trim(),
      phone_number: cleanPhone,
      password_hash: userData.password_hash,
      role: userData.role || "user",
      onboarding: {
        completed: false,
        step: 1
      },
      profile: userData.profile || {},
      preferred_language: userData.preferred_language || "en",
      created_at: now,
      updated_at: now
    };

    const col = getUsersCollection();
    const result = await col.insertOne(newUser);
    newUser._id = result.insertedId;
    return newUser;
  }

  /**
   * Update embedded user profile attributes safely
   */
  static async updateProfile(
    id: ObjectId | string,
    profileUpdates: Partial<EmbeddedUserProfile>
  ): Promise<UserDocument | null> {
    const objId = typeof id === "string" ? new ObjectId(id) : id;
    const col = getUsersCollection();

    // Prepare dot-notation set object to update embedded profile fields atomically
    const setQuery: Record<string, any> = {
      updated_at: new Date()
    };

    for (const [key, value] of Object.entries(profileUpdates)) {
      if (value !== undefined) {
        setQuery[`profile.${key}`] = value;
      }
    }

    const result = await col.findOneAndUpdate(
      { _id: objId },
      { $set: setQuery },
      { returnDocument: "after" }
    );

    return result;
  }

  /**
   * Update onboarding step and completion status
   */
  static async updateOnboarding(
    id: ObjectId | string,
    step: number,
    completed: boolean = false
  ): Promise<UserDocument | null> {
    const objId = typeof id === "string" ? new ObjectId(id) : id;
    const col = getUsersCollection();

    const result = await col.findOneAndUpdate(
      { _id: objId },
      {
        $set: {
          "onboarding.step": step,
          "onboarding.completed": completed,
          updated_at: new Date()
        }
      },
      { returnDocument: "after" }
    );

    return result;
  }

  /**
   * Update root user fields (name, preferred_language, password_hash)
   */
  static async updateUser(
    id: ObjectId | string,
    updates: Partial<Pick<UserDocument, "name" | "password_hash" | "preferred_language">>
  ): Promise<UserDocument | null> {
    const objId = typeof id === "string" ? new ObjectId(id) : id;
    const col = getUsersCollection();

    const setQuery: Record<string, any> = {
      updated_at: new Date()
    };

    if (updates.name !== undefined) setQuery.name = updates.name.trim();
    if (updates.password_hash !== undefined) setQuery.password_hash = updates.password_hash;
    if (updates.preferred_language !== undefined) setQuery.preferred_language = updates.preferred_language;

    const result = await col.findOneAndUpdate(
      { _id: objId },
      { $set: setQuery },
      { returnDocument: "after" }
    );

    return result;
  }
}
