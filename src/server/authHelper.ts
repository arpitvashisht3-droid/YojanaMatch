import crypto from "node:crypto";
import process from "node:process";
import { UserDocument } from "../../types/index.js";
import { UserRecord } from "../types.js";

const JWT_SECRET = process.env.JWT_SECRET || "yojanamatch-sih2026-default-dev-secret-key";

/**
 * Hash password securely using PBKDF2 with SHA-256 and salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a plaintext password against a stored hash string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
}

/**
 * Sign JWT Token with payload using HMAC SHA-256.
 */
export function signJwtToken(payload: object, expiresInSeconds = 86400 * 7): string {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signatureInput = `${b64Header}.${b64Payload}`;

  const signature = crypto.createHmac("sha256", JWT_SECRET).update(signatureInput).digest("base64url");
  return `${signatureInput}.${signature}`;
}

/**
 * Verify and decode JWT Token string.
 */
export function verifyJwtToken(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [b64Header, b64Payload, signature] = parts;
    const signatureInput = `${b64Header}.${b64Payload}`;
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(signatureInput).digest("base64url");

    if (signature !== expectedSignature) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf-8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired token
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Serialization Layer: Converts nested MongoDB UserDocument (Database branch) into flat UserRecord (Frontend branch).
 */
export function toFlatUser(userDoc: UserDocument | any): UserRecord {
  if (!userDoc) return null as any;

  const profile = userDoc.profile || {};
  const onboarding = userDoc.onboarding || { completed: false, step: 1 };
  const idStr = userDoc._id ? userDoc._id.toString() : userDoc.id || "";

  return {
    id: idStr,
    _id: idStr,
    name: userDoc.name || "",
    phone_number: userDoc.phone_number || "",
    created_at: userDoc.created_at ? new Date(userDoc.created_at).toISOString() : new Date().toISOString(),
    updated_at: userDoc.updated_at ? new Date(userDoc.updated_at).toISOString() : new Date().toISOString(),
    onboarding_completed: Boolean(onboarding.completed),
    onboarding_step: onboarding.step ?? 1,

    // Flat profile attributes expected by Frontend UI
    age: profile.age ?? undefined,
    gender: profile.gender ?? undefined,
    caste_category: profile.caste_category ?? undefined,
    state: profile.state ?? undefined,
    district_type: profile.district_type ?? undefined,
    business_type: profile.business_type ?? undefined,
    estimated_income: profile.estimated_income ?? undefined,
    is_differently_abled: profile.is_differently_abled ?? undefined,
    education_level: profile.education_level ?? undefined,
    course_type: profile.course_type ?? undefined,
    current_marks_percentage: profile.current_marks_percentage ?? undefined,
  };
}
