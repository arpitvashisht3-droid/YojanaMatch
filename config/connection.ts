import { MongoClient, Db, Collection } from "mongodb";
import dotenv from "dotenv";
import { UserDocument, SchemeDocument, ScholarshipDocument, MatchHistoryDocument } from "../types/index.js";

dotenv.config();

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (dbInstance) {
    return dbInstance;
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "yojanamatch";

  if (!uri || !uri.trim()) {
    throw new Error(
      "MONGODB_URI environment variable is missing or empty. Please specify a valid MongoDB connection string in .env file."
    );
  }

  try {
    console.log(`Connecting to MongoDB at ${uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@")} [DB: ${dbName}]...`);
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    await client.connect();
    dbInstance = client.db(dbName);
    console.log(`Successfully connected to MongoDB database: "${dbName}"`);
    return dbInstance;
  } catch (error: any) {
    console.error("MongoDB Connection Error:", error?.message || error);
    client = null;
    dbInstance = null;
    throw new Error(`Failed to connect to MongoDB: ${error?.message || error}`);
  }
}

export function getDB(): Db {
  if (!dbInstance) {
    throw new Error("Database not connected. Please call connectDB() before accessing the database instance.");
  }
  return dbInstance;
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    dbInstance = null;
    console.log("MongoDB connection closed.");
  }
}

// Collection Getters
export function getUsersCollection(): Collection<UserDocument> {
  return getDB().collection<UserDocument>("users");
}

export function getSchemesCollection(): Collection<SchemeDocument> {
  return getDB().collection<SchemeDocument>("schemes");
}

export function getScholarshipsCollection(): Collection<ScholarshipDocument> {
  return getDB().collection<ScholarshipDocument>("scholarships");
}

export function getMatchHistoriesCollection(): Collection<MatchHistoryDocument> {
  return getDB().collection<MatchHistoryDocument>("match_histories");
}
