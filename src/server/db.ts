import { MongoClient, Collection } from "mongodb";
import fs from "fs";
import path from "path";
import { UserRecord, SafeUser } from "../types";


const LOCAL_USERS_FILE = path.join(process.cwd(), "src", "data", "users.json");

let mongoClient: MongoClient | null = null;
let mongoUsersCollection: Collection<any> | null = null;
let isMongoConnecting = false;
let mongoConnected = false;

// Initialize local file fallback
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

// Lazy connect to MongoDB Atlas if MONGODB_URI is provided
async function getMongoCollection(): Promise<Collection<any> | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    return null;
  }

  if (mongoUsersCollection && mongoConnected) {
    return mongoUsersCollection;
  }

  if (isMongoConnecting) {
    // Wait briefly
    await new Promise((r) => setTimeout(r, 200));
    return mongoUsersCollection;
  }

  isMongoConnecting = true;
  try {
    console.log("Connecting to MongoDB Atlas...");
    mongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 4000,
    });
    await mongoClient.connect();
    const db = mongoClient.db("yojanamatch");
    mongoUsersCollection = db.collection("users");
    // Ensure index on phone_number
    await mongoUsersCollection.createIndex({ phone_number: 1 }, { unique: true });
    mongoConnected = true;
    console.log("Connected to MongoDB Atlas users collection");
    return mongoUsersCollection;
  } catch (err: any) {
    console.warn("MongoDB connection failed, falling back to local persistent store:", err?.message || err);
    mongoConnected = false;
    mongoUsersCollection = null;
    return null;
  } finally {
    isMongoConnecting = false;
  }
}

export function sanitizeUser(user: UserRecord | null): SafeUser | null {
  if (!user) return null;
  const { password_hash, _id, ...safe } = user;
  return safe;
}

export async function findUserByPhone(rawPhone: string): Promise<UserRecord | null> {
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone) return null;

  try {
    const col = await getMongoCollection();
    if (col) {
      const doc = await col.findOne({ phone_number: cleanPhone });
      if (doc) {
        const { _id, ...cleanDoc } = doc;
        return cleanDoc as UserRecord;
      }
    }
  } catch (err) {
    console.warn("MongoDB find error, falling back to local:", err);
  }

  const localUsers = ensureLocalStore();
  return localUsers.find((u) => u.phone_number === cleanPhone) || null;
}

export async function createUser(user: UserRecord): Promise<UserRecord> {
  const cleanPhone = normalizePhone(user.phone_number);
  const now = new Date().toISOString();
  const normalizedUser: UserRecord = {
    ...user,
    phone_number: cleanPhone,
    created_at: user.created_at || now,
    updated_at: user.updated_at || now,
    onboarding_completed: user.onboarding_completed ?? false,
    onboarding_step: user.onboarding_step ?? 1,
  };

  // Save to Mongo if available
  try {
    const col = await getMongoCollection();
    if (col) {
      await col.updateOne(
        { phone_number: cleanPhone },
        { $set: normalizedUser },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn("MongoDB create/upsert error, fallback to local:", err);
  }

  // Always sync to local store for resilience
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

  // Protect sensitive server-controlled fields from external overwrite
  const sanitizedUpdates: Partial<UserRecord> = { ...updates };
  delete sanitizedUpdates._id;
  delete sanitizedUpdates.id;
  delete sanitizedUpdates.password_hash;
  delete sanitizedUpdates.created_at;
  delete sanitizedUpdates.phone_number;

  sanitizedUpdates.updated_at = new Date().toISOString();

  let updatedUser: UserRecord | null = null;

  // Sync to Mongo
  try {
    const col = await getMongoCollection();
    if (col) {
      const res = await col.findOneAndUpdate(
        { phone_number: cleanPhone },
        { $set: sanitizedUpdates },
        { returnDocument: "after" }
      );
      if (res) {
        const { _id, ...cleanDoc } = res;
        updatedUser = cleanDoc as UserRecord;
      }
    }
  } catch (err) {
    console.warn("MongoDB update error, fallback to local:", err);
  }

  // Always sync local store
  const localUsers = ensureLocalStore();
  const existingIdx = localUsers.findIndex((u) => u.phone_number === cleanPhone);
  if (existingIdx >= 0) {
    localUsers[existingIdx] = {
      ...localUsers[existingIdx],
      ...sanitizedUpdates,
      phone_number: cleanPhone,
    };
    saveLocalStore(localUsers);
    if (!updatedUser) {
      updatedUser = localUsers[existingIdx];
    }
  }

  return updatedUser;
}


export function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  // If starts with 91 and has 12 digits, strip 91
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  // If starts with 0 and has 11 digits, strip 0
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  // If more than 10 digits, take last 10 digits
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}
