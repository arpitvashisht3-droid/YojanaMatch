import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB, closeDB } from "../config/connection.js";
import { applyCollectionValidatorsAndIndexes } from "../validators/schemas.js";
import { SchemeModel } from "../models/Scheme.js";
import { ScholarshipModel } from "../models/Scholarship.js";

// ESM-compatible __dirname equivalent (not available in NodeNext/ESM modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedDatabase(): Promise<void> {
  console.log("==================================================");
  console.log("  YojanaMatch Non-Destructive Database Seeder");
  console.log("==================================================");
  console.log("  Strategy: Upsert only (safe for existing data)");
  console.log("  WARNING: This will NOT delete existing records.");
  console.log("==================================================");

  try {
    const db = await connectDB();

    // Step 1: Apply collection JSON schema validators and performance indexes
    await applyCollectionValidatorsAndIndexes(db);

    // Step 2: Seed Government Schemes
    const schemesFilePath = path.join(__dirname, "data", "schemes.json");
    if (!fs.existsSync(schemesFilePath)) {
      throw new Error(
        `Schemes seed file not found at: ${schemesFilePath}

  Hint: The seed data should be placed at:
    YojanaMatch-Database/seed/data/schemes.json

  This is a LOCAL COPY of the data inside this worktree.
  Do NOT edit or move the original data from other worktrees.`
      );
    }

    const rawSchemes = fs.readFileSync(schemesFilePath, "utf-8");
    const schemesList: any[] = JSON.parse(rawSchemes);
    console.log(`\nFound ${schemesList.length} schemes in baseline seed dataset.`);

    let schemesUpserted = 0;
    let schemesSkipped = 0;
    for (const item of schemesList) {
      // Support both 'id' (legacy field) and 'scheme_id' (canonical field)
      const schemeId = item.id || item.scheme_id;
      if (!schemeId) {
        console.warn("  Skipping scheme with missing id/scheme_id:", item?.name || "(unnamed)");
        schemesSkipped++;
        continue;
      }

      await SchemeModel.upsertScheme({
        scheme_id: schemeId,
        name: item.name || "",
        hindi_name: item.hindi_name || "",
        ministry: item.ministry || "",
        hindi_ministry: item.hindi_ministry || "",
        benefit_headline: item.benefit_headline || "",
        hindi_benefit_headline: item.hindi_benefit_headline || "",
        official_link: item.official_link || "",
        short_summary: item.short_summary || "",
        hindi_short_summary: item.hindi_short_summary || "",
        eligibility: item.eligibility || {},
        benefits: item.benefits || {},
        applicable_states: item.applicable_states,
        category_tags: item.category_tags,
        popularity_score: item.popularity_score,
        is_active: item.is_active ?? true,
        source: "curated"
      });
      schemesUpserted++;
    }
    console.log(`  ✓ Schemes upserted: ${schemesUpserted}`);
    if (schemesSkipped > 0) {
      console.warn(`  ⚠ Schemes skipped (missing id): ${schemesSkipped}`);
    }

    // Step 3: Seed Educational Scholarships
    const scholarshipsFilePath = path.join(__dirname, "data", "scholarships.json");
    if (!fs.existsSync(scholarshipsFilePath)) {
      throw new Error(
        `Scholarships seed file not found at: ${scholarshipsFilePath}

  Hint: The seed data should be placed at:
    YojanaMatch-Database/seed/data/scholarships.json

  This is a LOCAL COPY of the data inside this worktree.
  Do NOT edit or move the original data from other worktrees.`
      );
    }

    const rawScholarships = fs.readFileSync(scholarshipsFilePath, "utf-8");
    const scholarshipsList: any[] = JSON.parse(rawScholarships);
    console.log(`\nFound ${scholarshipsList.length} scholarships in baseline seed dataset.`);

    let scholarshipsUpserted = 0;
    let scholarshipsSkipped = 0;
    for (const item of scholarshipsList) {
      // Support both 'id' (legacy field) and 'scholarship_id' (canonical field)
      const scholarshipId = item.id || item.scholarship_id;
      if (!scholarshipId) {
        console.warn("  Skipping scholarship with missing id/scholarship_id:", item?.name || "(unnamed)");
        scholarshipsSkipped++;
        continue;
      }

      await ScholarshipModel.upsertScholarship({
        scholarship_id: scholarshipId,
        name: item.name || "",
        hindi_name: item.hindi_name || "",
        ministry: item.ministry || "",
        hindi_ministry: item.hindi_ministry || "",
        benefit_headline: item.benefit_headline || "",
        hindi_benefit_headline: item.hindi_benefit_headline || "",
        official_link: item.official_link || "",
        short_summary: item.short_summary || "",
        hindi_short_summary: item.hindi_short_summary || "",
        eligibility: item.eligibility || {},
        benefits: item.benefits || {},
        applicable_states: item.applicable_states,
        category_tags: item.category_tags,
        popularity_score: item.popularity_score,
        is_active: item.is_active ?? true
      });
      scholarshipsUpserted++;
    }
    console.log(`  ✓ Scholarships upserted: ${scholarshipsUpserted}`);
    if (scholarshipsSkipped > 0) {
      console.warn(`  ⚠ Scholarships skipped (missing id): ${scholarshipsSkipped}`);
    }

    console.log("\n==================================================");
    console.log("  Database Seeding Completed Successfully!");
    console.log("==================================================");
  } catch (error: any) {
    console.error("\n[SEED ERROR]", error?.message || error);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
}

seedDatabase();
