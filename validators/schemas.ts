import { Db } from "mongodb";

/**
 * MongoDB JSON Schema Validation definitions & Indexes
 * Enforces strict document validation and performance index creation.
 */

export const userJsonSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["name", "phone_number", "onboarding", "profile", "created_at", "updated_at"],
    properties: {
      _id: { bsonType: "objectId" },
      name: { bsonType: "string", minLength: 2, description: "Must be a string of at least 2 characters" },
      phone_number: {
        bsonType: "string",
        pattern: "^[0-9]{10}$",
        description: "Must be a 10-digit clean Indian mobile number"
      },
      password_hash: { bsonType: "string", description: "Bcrypt password hash string" },
      role: { enum: ["user", "admin"], description: "User access level role" },
      onboarding: {
        bsonType: "object",
        required: ["completed", "step"],
        properties: {
          completed: { bsonType: "bool" },
          step: { bsonType: ["int", "double"], minimum: 1 }
        }
      },
      profile: {
        bsonType: "object",
        description: "Embedded user demographic and business attributes"
      },
      preferred_language: { enum: ["en", "hi"] },
      created_at: { bsonType: "date" },
      updated_at: { bsonType: "date" }
    }
  }
};

export const schemeJsonSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["scheme_id", "name", "hindi_name", "ministry", "official_link", "short_summary", "eligibility", "benefits", "is_active", "source"],
    properties: {
      _id: { bsonType: "objectId" },
      scheme_id: { bsonType: "string", minLength: 1, description: "Unique string identifier for scheme e.g. pmegp" },
      name: { bsonType: "string" },
      hindi_name: { bsonType: "string" },
      ministry: { bsonType: "string" },
      official_link: { bsonType: "string" },
      short_summary: { bsonType: "string" },
      category_type: { enum: ["scheme"] },
      eligibility: { bsonType: "object" },
      benefits: { bsonType: "object" },
      applicable_states: { bsonType: "array", items: { bsonType: "string" } },
      category_tags: { bsonType: "array", items: { bsonType: "string" } },
      popularity_score: { bsonType: ["int", "double"] },
      is_active: { bsonType: "bool" },
      source: { enum: ["curated", "data_gov_in"] }
    }
  }
};

export const scholarshipJsonSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["scholarship_id", "name", "hindi_name", "ministry", "official_link", "short_summary", "eligibility", "benefits", "is_active"],
    properties: {
      _id: { bsonType: "objectId" },
      scholarship_id: { bsonType: "string", minLength: 1, description: "Unique string identifier for scholarship e.g. post_matric_sc" },
      name: { bsonType: "string" },
      hindi_name: { bsonType: "string" },
      ministry: { bsonType: "string" },
      official_link: { bsonType: "string" },
      short_summary: { bsonType: "string" },
      category_type: { enum: ["scholarship"] },
      eligibility: { bsonType: "object" },
      benefits: { bsonType: "object" },
      applicable_states: { bsonType: "array", items: { bsonType: "string" } },
      category_tags: { bsonType: "array", items: { bsonType: "string" } },
      popularity_score: { bsonType: ["int", "double"] },
      is_active: { bsonType: "bool" }
    }
  }
};

export const matchHistoryJsonSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["user_id", "category_type", "input_mode", "extracted_profile_snapshot", "total_matches", "results", "language", "created_at"],
    properties: {
      _id: { bsonType: "objectId" },
      user_id: { bsonType: "objectId", description: "Reference to users._id" },
      category_type: { enum: ["scheme", "scholarship"] },
      input_mode: { enum: ["voice", "text", "onboarding"] },
      raw_input_text: { bsonType: "string" },
      extracted_profile_snapshot: { bsonType: "object" },
      total_matches: { bsonType: ["int", "double"] },
      results: { bsonType: "array" },
      language: { enum: ["en", "hi"] },
      created_at: { bsonType: "date" }
    }
  }
};

export async function applyCollectionValidatorsAndIndexes(db: Db): Promise<void> {
  console.log("Applying MongoDB collection validators & indexes...");

  // 1. Users collection
  const existingCollections = await db.listCollections().toArray();
  const collectionNames = existingCollections.map((c) => c.name);

  if (!collectionNames.includes("users")) {
    await db.createCollection("users", { validator: userJsonSchema });
  } else {
    try {
      await db.command({ collMod: "users", validator: userJsonSchema });
    } catch (e: any) {
      console.warn("Notice: collMod on users validator warning:", e?.message || e);
    }
  }
  const usersCol = db.collection("users");
  await usersCol.createIndex({ phone_number: 1 }, { unique: true });
  await usersCol.createIndex({ "profile.state": 1, "profile.caste_category": 1 });

  // 2. Schemes collection
  if (!collectionNames.includes("schemes")) {
    await db.createCollection("schemes", { validator: schemeJsonSchema });
  } else {
    try {
      await db.command({ collMod: "schemes", validator: schemeJsonSchema });
    } catch (e: any) {
      console.warn("Notice: collMod on schemes validator warning:", e?.message || e);
    }
  }
  const schemesCol = db.collection("schemes");
  await schemesCol.createIndex({ scheme_id: 1 }, { unique: true });
  await schemesCol.createIndex({ is_active: 1, popularity_score: -1 });
  await schemesCol.createIndex({ applicable_states: 1 });
  await schemesCol.createIndex({ "eligibility.allowed_castes": 1 });
  await schemesCol.createIndex({ "eligibility.allowed_business_types": 1 });

  // 3. Scholarships collection
  if (!collectionNames.includes("scholarships")) {
    await db.createCollection("scholarships", { validator: scholarshipJsonSchema });
  } else {
    try {
      await db.command({ collMod: "scholarships", validator: scholarshipJsonSchema });
    } catch (e: any) {
      console.warn("Notice: collMod on scholarships validator warning:", e?.message || e);
    }
  }
  const scholarshipsCol = db.collection("scholarships");
  await scholarshipsCol.createIndex({ scholarship_id: 1 }, { unique: true });
  await scholarshipsCol.createIndex({ is_active: 1, popularity_score: -1 });
  await scholarshipsCol.createIndex({ "eligibility.allowed_castes": 1 });
  await scholarshipsCol.createIndex({ "eligibility.education_levels": 1 });

  // 4. Match histories collection
  if (!collectionNames.includes("match_histories")) {
    await db.createCollection("match_histories", { validator: matchHistoryJsonSchema });
  } else {
    try {
      await db.command({ collMod: "match_histories", validator: matchHistoryJsonSchema });
    } catch (e: any) {
      console.warn("Notice: collMod on match_histories validator warning:", e?.message || e);
    }
  }
  const matchHistoriesCol = db.collection("match_histories");
  await matchHistoriesCol.createIndex({ user_id: 1, created_at: -1 });
  await matchHistoriesCol.createIndex({ category_type: 1 });

  console.log("Collection validators and indexes successfully applied.");
}
