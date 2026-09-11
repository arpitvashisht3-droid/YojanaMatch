import { ObjectId } from "mongodb";
import { getScholarshipsCollection } from "../config/connection.js";
import { ScholarshipDocument } from "../types/index.js";

export class ScholarshipModel {
  /**
   * Find scholarship by unique string identifier e.g. "post_matric_sc"
   */
  static async findByScholarshipId(scholarship_id: string): Promise<ScholarshipDocument | null> {
    const col = getScholarshipsCollection();
    return await col.findOne({ scholarship_id: scholarship_id.trim().toLowerCase() });
  }

  /**
   * Find scholarship by MongoDB ObjectId
   */
  static async findById(id: ObjectId | string): Promise<ScholarshipDocument | null> {
    const objId = typeof id === "string" ? new ObjectId(id) : id;
    const col = getScholarshipsCollection();
    return await col.findOne({ _id: objId });
  }

  /**
   * Fetch all active educational scholarships sorted by popularity score
   */
  static async getAllActiveScholarships(): Promise<ScholarshipDocument[]> {
    const col = getScholarshipsCollection();
    return await col.find({ is_active: true }).sort({ popularity_score: -1 }).toArray();
  }

  /**
   * Upsert scholarship record (insert if new, update if exists by scholarship_id)
   */
  static async upsertScholarship(scholarshipData: {
    scholarship_id: string;
    name: string;
    hindi_name: string;
    ministry: string;
    hindi_ministry: string;
    benefit_headline: string;
    hindi_benefit_headline: string;
    official_link: string;
    short_summary: string;
    hindi_short_summary: string;
    eligibility: any;
    benefits: any;
    applicable_states?: string[];
    category_tags?: string[];
    popularity_score?: number;
    is_active?: boolean;
  }): Promise<ScholarshipDocument> {
    const cleanId = scholarshipData.scholarship_id.trim().toLowerCase();
    const col = getScholarshipsCollection();
    const now = new Date();

    const updateDoc = {
      $set: {
        scholarship_id: cleanId,
        name: scholarshipData.name,
        hindi_name: scholarshipData.hindi_name,
        ministry: scholarshipData.ministry,
        hindi_ministry: scholarshipData.hindi_ministry,
        benefit_headline: scholarshipData.benefit_headline,
        hindi_benefit_headline: scholarshipData.hindi_benefit_headline,
        official_link: scholarshipData.official_link,
        short_summary: scholarshipData.short_summary,
        hindi_short_summary: scholarshipData.hindi_short_summary,
        category_type: "scholarship" as const,
        eligibility: scholarshipData.eligibility,
        benefits: scholarshipData.benefits,
        applicable_states: scholarshipData.applicable_states || ["All India"],
        category_tags: scholarshipData.category_tags || [],
        popularity_score: scholarshipData.popularity_score ?? 50,
        is_active: scholarshipData.is_active ?? true,
        updated_at: now
      },
      $setOnInsert: {
        created_at: now
      }
    };

    const result = await col.findOneAndUpdate(
      { scholarship_id: cleanId },
      updateDoc,
      { upsert: true, returnDocument: "after" }
    );

    return result!;
  }

  /**
   * Search active scholarships based on academic filters (education level, caste, course stream)
   */
  static async searchScholarshipsByFilters(filters: {
    education_level?: string;
    caste_category?: string;
    course_type?: string;
    limit?: number;
  }): Promise<ScholarshipDocument[]> {
    const col = getScholarshipsCollection();
    const query: Record<string, any> = { is_active: true };

    if (filters.caste_category) {
      query["eligibility.allowed_castes"] = { $in: ["any", filters.caste_category] };
    }

    if (filters.education_level) {
      query["eligibility.education_levels"] = { $in: ["any", filters.education_level] };
    }

    if (filters.course_type) {
      query["eligibility.course_types"] = { $in: ["any", filters.course_type] };
    }

    const limit = filters.limit || 50;
    return await col.find(query).sort({ popularity_score: -1 }).limit(limit).toArray();
  }
}
