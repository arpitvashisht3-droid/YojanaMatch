import { SchemeModel } from "../../models/Scheme.js";
import { ScholarshipModel } from "../../models/Scholarship.js";

/**
 * Authoritative Government Data Ingestion Service
 *
 * Target Architecture:
 * Authoritative Government Source (Data.gov.in / MyScheme Open API)
 *        ↓
 * Data Ingestion / Sync Layer (DataIngestionService)
 *        ↓
 * MongoDB Collections (SchemeModel / ScholarshipModel)
 *        ↓
 * YojanaMatch Express API
 *        ↓
 * React Frontend
 */

export interface IngestionResult {
  status: "success" | "configured" | "error";
  schemes_synced: number;
  scholarships_synced: number;
  message: string;
  source?: string;
  timestamp: string;
}

export class DataIngestionService {
  /**
   * Sync authoritative government scheme data into MongoDB
   */
  static async syncGovernmentSchemes(): Promise<IngestionResult> {
    const apiUrl = process.env.GOVT_DATA_API_URL;
    const apiKey = process.env.GOVT_DATA_API_KEY;

    if (!apiUrl || !apiUrl.trim()) {
      return {
        status: "configured",
        schemes_synced: 0,
        scholarships_synced: 0,
        message: "Government Data API URL (GOVT_DATA_API_URL) is not configured. Ready to ingest from authoritative source when credentials are provided.",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      console.log(`[DataIngestionService] Fetching authoritative schemes from ${apiUrl}...`);
      const response = await fetch(apiUrl, {
        headers: {
          "Accept": "application/json",
          ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Government Data API returned HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData: any = await response.json();
      const schemesToIngest: any[] = Array.isArray(rawData) ? rawData : rawData.schemes || [];

      let syncedCount = 0;
      for (const rawScheme of schemesToIngest) {
        const schemeId = rawScheme.scheme_id || rawScheme.id;
        if (schemeId && rawScheme.name) {
          await SchemeModel.upsertScheme({
            ...rawScheme,
            scheme_id: schemeId,
          });
          syncedCount++;
        }
      }

      return {
        status: "success",
        schemes_synced: syncedCount,
        scholarships_synced: 0,
        message: `Successfully ingested ${syncedCount} authoritative government schemes into MongoDB.`,
        source: apiUrl,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("[DataIngestionService] Ingestion failed:", error?.message || error);
      return {
        status: "error",
        schemes_synced: 0,
        scholarships_synced: 0,
        message: `Ingestion failed: ${error?.message || error}`,
        source: apiUrl,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Ingest a batch of authoritative scheme documents directly into MongoDB
   */
  static async ingestSchemeBatch(schemes: any[]): Promise<number> {
    let count = 0;
    for (const scheme of schemes) {
      const schemeId = scheme.scheme_id || scheme.id;
      if (schemeId && scheme.name) {
        await SchemeModel.upsertScheme({
          ...scheme,
          scheme_id: schemeId,
        });
        count++;
      }
    }
    return count;
  }

  /**
   * Ingest a batch of authoritative scholarship documents directly into MongoDB
   */
  static async ingestScholarshipBatch(scholarships: any[]): Promise<number> {
    let count = 0;
    for (const scholarship of scholarships) {
      const scholarshipId = scholarship.scholarship_id || scholarship.id;
      if (scholarshipId && scholarship.name) {
        await ScholarshipModel.upsertScholarship({
          ...scholarship,
          scholarship_id: scholarshipId,
        });
        count++;
      }
    }
    return count;
  }
}
