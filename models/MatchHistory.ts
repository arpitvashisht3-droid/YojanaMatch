import { ObjectId } from "mongodb";
import { getMatchHistoriesCollection } from "../config/connection.js";
import { MatchHistoryDocument, EmbeddedUserProfile, MatchedResultItem } from "../types/index.js";

export class MatchHistoryModel {
  /**
   * Log a new scheme/scholarship match search result into MongoDB
   * FK Reference: user_id (ObjectId)
   */
  static async createMatchHistory(data: {
    user_id: ObjectId | string;
    category_type: "scheme" | "scholarship";
    input_mode: "voice" | "text" | "onboarding";
    raw_input_text?: string;
    extracted_profile_snapshot: EmbeddedUserProfile;
    results: MatchedResultItem[];
    language?: "en" | "hi";
  }): Promise<MatchHistoryDocument> {
    const userObjId = typeof data.user_id === "string" ? new ObjectId(data.user_id) : data.user_id;
    const col = getMatchHistoriesCollection();

    const newRecord: MatchHistoryDocument = {
      user_id: userObjId,
      category_type: data.category_type,
      input_mode: data.input_mode,
      raw_input_text: data.raw_input_text || "",
      extracted_profile_snapshot: data.extracted_profile_snapshot || {},
      total_matches: data.results.length,
      results: data.results,
      language: data.language || "en",
      created_at: new Date()
    };

    const result = await col.insertOne(newRecord);
    newRecord._id = result.insertedId;
    return newRecord;
  }

  /**
   * Retrieve past search histories for a specific user ordered by latest first
   */
  static async getHistoryByUserId(
    user_id: ObjectId | string,
    limit: number = 20
  ): Promise<MatchHistoryDocument[]> {
    const userObjId = typeof user_id === "string" ? new ObjectId(user_id) : user_id;
    const col = getMatchHistoriesCollection();

    return await col
      .find({ user_id: userObjId })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Find specific match history record by _id
   */
  static async getHistoryById(id: ObjectId | string): Promise<MatchHistoryDocument | null> {
    const objId = typeof id === "string" ? new ObjectId(id) : id;
    const col = getMatchHistoriesCollection();

    return await col.findOne({ _id: objId });
  }
}
