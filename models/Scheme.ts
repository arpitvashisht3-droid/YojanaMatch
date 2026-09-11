import { ObjectId } from "mongodb";
import { getSchemesCollection } from "../config/connection.js";
import { SchemeDocument } from "../types/index.js";

export class SchemeModel {
  /**
   * Find scheme by unique string identifier e.g. "pmegp"
   */
  static async findBySchemeId(scheme_id: string): Promise<SchemeDocument | null> {
    const col = getSchemesCollection();
    return await col.findOne({ scheme_id: scheme_id.trim().toLowerCase() });
  }

  /**
   * Find scheme by MongoDB ObjectId
   */
  static async findById(id: ObjectId | string): Promise<SchemeDocument | null> {
    const objId = typeof id === "string" ? new ObjectId(id) : id;
    const col = getSchemesCollection();
    return await col.findOne({ _id: objId });
  }

  /**
   * Fetch all active government schemes sorted by popularity score
   */
  static async getAllActiveSchemes(): Promise<SchemeDocument[]> {
    const col = getSchemesCollection();
    return await col.find({ is_active: true }).sort({ popularity_score: -1 }).toArray();
  }

  /**
   * Upsert scheme record (insert if new, update if exists by scheme_id)
   */
  static async upsertScheme(schemeData: {
    scheme_id: string;
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
    source?: "curated" | "data_gov_in";
  }): Promise<SchemeDocument> {
    const cleanSchemeId = schemeData.scheme_id.trim().toLowerCase();
    const col = getSchemesCollection();
    const now = new Date();

    const updateDoc = {
      $set: {
        scheme_id: cleanSchemeId,
        name: schemeData.name,
        hindi_name: schemeData.hindi_name,
        ministry: schemeData.ministry,
        hindi_ministry: schemeData.hindi_ministry,
        benefit_headline: schemeData.benefit_headline,
        hindi_benefit_headline: schemeData.hindi_benefit_headline,
        official_link: schemeData.official_link,
        short_summary: schemeData.short_summary,
        hindi_short_summary: schemeData.hindi_short_summary,
        category_type: "scheme" as const,
        eligibility: schemeData.eligibility,
        benefits: schemeData.benefits,
        applicable_states: schemeData.applicable_states || ["All India"],
        category_tags: schemeData.category_tags || [],
        popularity_score: schemeData.popularity_score ?? 50,
        is_active: schemeData.is_active ?? true,
        source: schemeData.source || "curated",
        updated_at: now
      },
      $setOnInsert: {
        created_at: now
      }
    };

    const result = await col.findOneAndUpdate(
      { scheme_id: cleanSchemeId },
      updateDoc,
      { upsert: true, returnDocument: "after" }
    );

    return result!;
  }

  /**
   * Search active schemes based on demographic filters (state, caste, business type)
   */
  static async searchSchemesByFilters(filters: {
    state?: string;
    caste_category?: string;
    business_type?: string;
    limit?: number;
  }): Promise<SchemeDocument[]> {
    const col = getSchemesCollection();
    const query: Record<string, any> = { is_active: true };

    if (filters.state) {
      query.applicable_states = { $in: ["All India", filters.state] };
    }

    if (filters.caste_category) {
      query["eligibility.allowed_castes"] = { $in: ["any", filters.caste_category] };
    }

    if (filters.business_type) {
      query["eligibility.allowed_business_types"] = { $in: ["any", filters.business_type] };
    }

    const limit = filters.limit || 50;
    return await col.find(query).sort({ popularity_score: -1 }).limit(limit).toArray();
  }

  /**
   * Fetch top popular schemes for home screen landing area
   */
  static async getPopularSchemes(limit: number = 6): Promise<SchemeDocument[]> {
    const col = getSchemesCollection();
    return await col.find({ is_active: true }).sort({ popularity_score: -1 }).limit(limit).toArray();
  }
}
