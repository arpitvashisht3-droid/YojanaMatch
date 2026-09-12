/**
 * YojanaMatch Frontend Data Access Module
 * 
 * NOTE: Direct browser/client database connections to MongoDB Atlas are deprecated in favor 
 * of secure, authenticated REST API queries mediated by YojanaMatch-Backend2.
 */

import fs from "fs";
import path from "path";
import { UserRecord } from "../types";

const LOCAL_USERS_FILE = path.join(process.cwd(), "src", "data", "users.json");

function ensureLocalStore(): UserRecord[] {
  try {
    const dir = path.dirname(LOCAL_USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_USERS_FILE)) {
      fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify([], null, 2), "utf-8");
      return [];
    }
    const raw = fs.readFileSync(LOCAL_USERS_FILE, "utf-8");
    return JSON.parse(raw) as UserRecord[];
  } catch (err) {
    console.warn("Error accessing local users store:", err);
    return [];
  }
}

function saveLocalStore(users: UserRecord[]): void {
  try {
    const dir = path.dirname(LOCAL_USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write to local users file:", err);
  }
}

export function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
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

export async function findUserByPhone(rawPhone: string): Promise<UserRecord | null> {
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone) return null;

  const localUsers = ensureLocalStore();
  return localUsers.find((u) => u.phone_number === cleanPhone) || null;
}

export async function createUser(user: UserRecord): Promise<UserRecord> {
  const cleanPhone = normalizePhone(user.phone_number);
  const normalizedUser: UserRecord = {
    ...user,
    phone_number: cleanPhone,
    created_at: user.created_at || new Date().toISOString(),
    onboarding_completed: user.onboarding_completed ?? false,
    onboarding_step: user.onboarding_step ?? 1,
  };

  const localUsers = ensureLocalStore();
  const existingIdx = localUsers.findIndex((u) => u.phone_number === cleanPhone);
  if (existingIdx >= 0) {
    localUsers[existingIdx] = normalizedUser;
  } else {
    localUsers.push(normalizedUser);
  }
  saveLocalStore(localUsers);

  return normalizedUser;
}

export async function updateUser(
  rawPhone: string,
  updates: Partial<UserRecord>
): Promise<UserRecord | null> {
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone) return null;

  const localUsers = ensureLocalStore();
  const existingIdx = localUsers.findIndex((u) => u.phone_number === cleanPhone);
  if (existingIdx >= 0) {
    localUsers[existingIdx] = {
      ...localUsers[existingIdx],
      ...updates,
      phone_number: cleanPhone,
    };
    saveLocalStore(localUsers);
    return localUsers[existingIdx];
  }

  return null;
}
