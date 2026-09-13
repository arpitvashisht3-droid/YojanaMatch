import { ObjectId, WithId } from "mongodb";
import { getUsersCollection } from "../config/connection.js";
import { UserDocument, SafeUser, EmbeddedUserProfile } from "../types/index.js";

// In-Memory Fallback Store when MongoDB connection is unavailable
const inMemoryUsersMap: Map<string, UserDocument> = new Map();

function getColOrNull() {
  try {
    return getUsersCollection();
  } catch (err: any) {
    if (process.env.NODE_ENV === "production" || process.env.STRICT_DB === "true") {
      throw new Error(
        "MongoDB database connection is required in Production mode. In-memory user fallback is disabled."
      );
    }
    return null;
  }
}

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

    const col = getColOrNull();
    if (col) {
      return await col.findOne({ phone_number: cleanPhone });
    }

    for (const user of inMemoryUsersMap.values()) {
      if (user.phone_number === cleanPhone) return user;
    }
    return null;
  }

  /**
   * Find user by MongoDB _id
   */
  static async findById(id: ObjectId | string): Promise<UserDocument | null> {
    const idStr = typeof id === "string" ? id : id.toString();
    const col = getColOrNull();

    if (col) {
      try {
        const objId = typeof id === "string" ? new ObjectId(id) : id;
        return await col.findOne({ _id: objId });
      } catch {
        return null;
      }
    }

    return inMemoryUsersMap.get(idStr) || null;
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
        step: 1,
      },
      profile: userData.profile || {},
      preferred_language: userData.preferred_language || "en",
      saved_schemes: [],
      created_at: now,
      updated_at: now,
    };

    const col = getColOrNull();
    if (col) {
      const result = await col.insertOne(newUser);
      newUser._id = result.insertedId;
    } else {
      const newObjId = new ObjectId();
      newUser._id = newObjId;
      inMemoryUsersMap.set(newObjId.toString(), newUser);
    }

    return newUser;
  }

  /**
   * Update embedded user profile attributes safely
   */
  static async updateProfile(
    id: ObjectId | string,
    profileUpdates: Partial<EmbeddedUserProfile>
  ): Promise<UserDocument | null> {
    const col = getColOrNull();
    if (col) {
      const objId = typeof id === "string" ? new ObjectId(id) : id;
      const setQuery: Record<string, any> = {
        updated_at: new Date(),
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

    const idStr = typeof id === "string" ? id : id.toString();
    const user = inMemoryUsersMap.get(idStr);
    if (user) {
      user.profile = { ...(user.profile || {}), ...profileUpdates };
      user.updated_at = new Date();
      return user;
    }
    return null;
  }

  /**
   * Update onboarding step and completion status
   */
  static async updateOnboarding(
    id: ObjectId | string,
    step: number,
    completed: boolean = false
  ): Promise<UserDocument | null> {
    const col = getColOrNull();
    if (col) {
      const objId = typeof id === "string" ? new ObjectId(id) : id;
      const result = await col.findOneAndUpdate(
        { _id: objId },
        {
          $set: {
            "onboarding.step": step,
            "onboarding.completed": completed,
            updated_at: new Date(),
          },
        },
        { returnDocument: "after" }
      );
      return result;
    }

    const idStr = typeof id === "string" ? id : id.toString();
    const user = inMemoryUsersMap.get(idStr);
    if (user) {
      user.onboarding = { step, completed };
      user.updated_at = new Date();
      return user;
    }
    return null;
  }

  /**
   * Update root user fields (name, preferred_language, password_hash)
   */
  static async updateUser(
    id: ObjectId | string,
    updates: Partial<Pick<UserDocument, "name" | "password_hash" | "preferred_language">>
  ): Promise<UserDocument | null> {
    const col = getColOrNull();
    if (col) {
      const objId = typeof id === "string" ? new ObjectId(id) : id;
      const setQuery: Record<string, any> = {
        updated_at: new Date(),
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

    const idStr = typeof id === "string" ? id : id.toString();
    const user = inMemoryUsersMap.get(idStr);
    if (user) {
      if (updates.name !== undefined) user.name = updates.name.trim();
      if (updates.password_hash !== undefined) user.password_hash = updates.password_hash;
      if (updates.preferred_language !== undefined) user.preferred_language = updates.preferred_language;
      user.updated_at = new Date();
      return user;
    }
    return null;
  }

  /**
   * Retrieve saved scheme IDs for authenticated user.
   * In Production or STRICT_DB mode, MongoDB is mandatory and in-memory fallback is strictly disabled.
   */
  static async getSavedSchemes(id: ObjectId | string): Promise<string[]> {
    const col = getColOrNull();
    if (col) {
      const objId = typeof id === "string" ? new ObjectId(id) : id;
      const user = await col.findOne({ _id: objId });
      return user?.saved_schemes || [];
    }

    if (process.env.NODE_ENV === "production" || process.env.STRICT_DB === "true") {
      throw new Error("MongoDB database connection is required in Production/STRICT_DB mode. In-memory fallback is disabled.");
    }

    const idStr = typeof id === "string" ? id : id.toString();
    const user = inMemoryUsersMap.get(idStr);
    return user?.saved_schemes || [];
  }

  /**
   * Save a scheme to user's saved_schemes list using $addToSet.
   * In Production or STRICT_DB mode, MongoDB is mandatory and in-memory fallback is strictly disabled.
   */
  static async saveScheme(id: ObjectId | string, schemeId: string): Promise<string[]> {
    if (!schemeId || !schemeId.trim()) {
      throw new Error("Invalid scheme ID");
    }
    const cleanSchemeId = schemeId.trim();

    const col = getColOrNull();
    if (col) {
      const objId = typeof id === "string" ? new ObjectId(id) : id;
      const result = await col.findOneAndUpdate(
        { _id: objId },
        {
          $addToSet: { saved_schemes: cleanSchemeId },
          $set: { updated_at: new Date() },
        },
        { returnDocument: "after" }
      );
      return result?.saved_schemes || [];
    }

    if (process.env.NODE_ENV === "production" || process.env.STRICT_DB === "true") {
      throw new Error("MongoDB database connection is required in Production/STRICT_DB mode. In-memory fallback is disabled.");
    }

    const idStr = typeof id === "string" ? id : id.toString();
    const user = inMemoryUsersMap.get(idStr);
    if (user) {
      if (!user.saved_schemes) {
        user.saved_schemes = [];
      }
      if (!user.saved_schemes.includes(cleanSchemeId)) {
        user.saved_schemes.push(cleanSchemeId);
      }
      user.updated_at = new Date();
      return user.saved_schemes;
    }
    return [];
  }

  /**
   * Remove a scheme from user's saved_schemes list using $pull.
   * In Production or STRICT_DB mode, MongoDB is mandatory and in-memory fallback is strictly disabled.
   */
  static async unsaveScheme(id: ObjectId | string, schemeId: string): Promise<string[]> {
    if (!schemeId || !schemeId.trim()) {
      throw new Error("Invalid scheme ID");
    }
    const cleanSchemeId = schemeId.trim();

    const col = getColOrNull();
    if (col) {
      const objId = typeof id === "string" ? new ObjectId(id) : id;
      const result = await col.findOneAndUpdate(
        { _id: objId },
        {
          $pull: { saved_schemes: cleanSchemeId },
          $set: { updated_at: new Date() },
        },
        { returnDocument: "after" }
      );
      return result?.saved_schemes || [];
    }

    if (process.env.NODE_ENV === "production" || process.env.STRICT_DB === "true") {
      throw new Error("MongoDB database connection is required in Production/STRICT_DB mode. In-memory fallback is disabled.");
    }

    const idStr = typeof id === "string" ? id : id.toString();
    const user = inMemoryUsersMap.get(idStr);
    if (user) {
      if (!user.saved_schemes) {
        user.saved_schemes = [];
      }
      user.saved_schemes = user.saved_schemes.filter((s) => s !== cleanSchemeId);
      user.updated_at = new Date();
      return user.saved_schemes;
    }
    return [];
  }
}
