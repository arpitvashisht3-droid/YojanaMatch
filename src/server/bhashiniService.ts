import process from "node:process";

// Official MeitY BHASHINI Udyat & Dhruva Endpoints
const PIPELINE_CONFIG_URL =
  process.env.BHASHINI_CONFIG_URL ||
  "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const DEFAULT_INFERENCE_URL =
  process.env.BHASHINI_INFERENCE_URL ||
  "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
const DEFAULT_PIPELINE_ID = "64392f96daac500b55c543cd";

export interface BhashiniTranslationResult {
  translated_text: string | null;
  source_language: string;
  target_language: string;
  status: "success" | "error";
  error: string | null;
}

export interface BhashiniTransliterationResult {
  transliterated_text: string | null;
  source_language: string;
  target_language: string;
  status: "success" | "error";
  error: string | null;
}

export interface BhashiniCredentials {
  udyatKey: string;
  inferenceKey: string;
  pipelineId: string;
  inferenceUrl: string;
  userId?: string;
  // Legacy aliases for backward compatibility
  apiKey?: string;
}

/**
 * Retrieve BHASHINI credentials safely from environment variables.
 * Adapts to BHASHINI Udyat API format:
 * - UDYAT KEY (BHASHINI_UDYAT_KEY): Used for pipeline config & ULCA model discovery
 * - INFERENCE KEY (BHASHINI_INFERENCE_KEY): Used for Dhruva inference requests
 * Supports BHASHINI_API_KEY as fallback for backwards compatibility.
 */
export function getBhashiniCredentials(): BhashiniCredentials {
  const udyatKey = (
    process.env.BHASHINI_UDYAT_KEY ||
    process.env.BHASHINI_API_KEY ||
    ""
  ).trim();

  const inferenceKey = (
    process.env.BHASHINI_INFERENCE_KEY ||
    process.env.BHASHINI_API_KEY ||
    ""
  ).trim();

  const userId = (process.env.BHASHINI_USER_ID || "").trim();
  const pipelineId =
    (process.env.BHASHINI_PIPELINE_ID || "").trim() || DEFAULT_PIPELINE_ID;
  const inferenceUrl =
    (process.env.BHASHINI_INFERENCE_URL || "").trim() || DEFAULT_INFERENCE_URL;

  return {
    udyatKey,
    inferenceKey,
    pipelineId,
    inferenceUrl,
    userId: userId || undefined,
    apiKey: udyatKey,
  };
}

/**
 * Returns true if both UDYAT KEY and INFERENCE KEY (or backward-compatible equivalents) are configured.
 */
export function isBhashiniConfigured(): boolean {
  const { udyatKey, inferenceKey } = getBhashiniCredentials();
  return Boolean(udyatKey && inferenceKey);
}

/**
 * Performs translation using official BHASHINI Udyat & Dhruva Pipeline API (MeitY AI for Bharat).
 * Flow:
 * 1. Queries the pipeline config using the UDYAT KEY (via ulcaApiKey header) to resolve active translation serviceId & endpoint.
 * 2. Executes the translation inference against Dhruva using the INFERENCE KEY (via Authorization header).
 */
export async function translateText(
  text: string,
  sourceLang: string = "en",
  targetLang: string = "hi"
): Promise<BhashiniTranslationResult> {
  if (!isBhashiniConfigured()) {
    return {
      translated_text: null,
      source_language: sourceLang,
      target_language: targetLang,
      status: "error",
      error:
        "BHASHINI API credentials not configured. Please set BHASHINI_UDYAT_KEY and BHASHINI_INFERENCE_KEY in environment.",
    };
  }

  const { udyatKey, inferenceKey, pipelineId, inferenceUrl, userId } =
    getBhashiniCredentials();

  try {
    // Step 1: Query Pipeline Config using the UDYAT KEY
    let serviceId: string | null = null;
    let callbackUrl = inferenceUrl;
    let authHeaderName = "Authorization";

    const pipelinePayload = {
      pipelineTasks: [
        {
          taskType: "translation",
          config: {
            language: {
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
            },
          },
        },
      ],
      pipelineRequestConfig: {
        pipelineId: pipelineId,
      },
    };

    const configHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ulcaApiKey: udyatKey,
    };
    if (userId) {
      configHeaders["userID"] = userId;
    }

    const configController = new AbortController();
    const configTimeoutId = setTimeout(() => configController.abort(), 10000);

    try {
      const configRes = await fetch(PIPELINE_CONFIG_URL, {
        method: "POST",
        headers: configHeaders,
        body: JSON.stringify(pipelinePayload),
        signal: configController.signal,
      });

      clearTimeout(configTimeoutId);

      if (configRes.ok) {
        const pipelineData: any = await configRes.json();

        // Extract endpoint & auth details if returned
        const endpointInfo =
          pipelineData?.pipelineInferenceAPIEndPoint || {};
        if (endpointInfo.callbackUrl) {
          callbackUrl = endpointInfo.callbackUrl;
        }
        if (endpointInfo.inferenceApiKey?.name) {
          authHeaderName = endpointInfo.inferenceApiKey.name;
        }

        // Extract serviceId for translation task
        const tasksConfig = pipelineData?.pipelineResponseConfig || [];
        for (const task of tasksConfig) {
          if (task?.taskType === "translation" && Array.isArray(task.config)) {
            const matchedConfig = task.config.find(
              (c: any) =>
                c?.language?.sourceLanguage === sourceLang &&
                c?.language?.targetLanguage === targetLang
            );
            serviceId = matchedConfig?.serviceId || task.config[0]?.serviceId || null;
            if (serviceId) break;
          }
        }
      } else {
        const errorText = await configRes.text().catch(() => "");
        console.warn(
          `[BHASHINI] Pipeline Config warning (${configRes.status}): ${errorText}. Falling back to direct inference endpoint.`
        );
      }
    } catch (configErr: any) {
      clearTimeout(configTimeoutId);
      if (configErr?.name === "AbortError") {
        console.warn(
          "[BHASHINI] Pipeline Config request timed out. Proceeding to inference endpoint."
        );
      } else {
        console.warn(
          `[BHASHINI] Pipeline Config request failed: ${configErr?.message || configErr}. Proceeding to inference endpoint.`
        );
      }
    }

    // Step 2: Compute Translation Inference Call using INFERENCE KEY
    const inferenceTaskConfig: Record<string, any> = {
      language: {
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      },
    };
    if (serviceId) {
      inferenceTaskConfig["serviceId"] = serviceId;
    }

    const inferencePayload = {
      pipelineTasks: [
        {
          taskType: "translation",
          config: inferenceTaskConfig,
        },
      ],
      inputData: {
        input: [
          {
            source: text,
          },
        ],
      },
    };

    const infController = new AbortController();
    const infTimeoutId = setTimeout(() => infController.abort(), 15000);

    const inferenceRes = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [authHeaderName]: inferenceKey,
      },
      body: JSON.stringify(inferencePayload),
      signal: infController.signal,
    });

    clearTimeout(infTimeoutId);

    if (!inferenceRes.ok) {
      const errorText = await inferenceRes.text().catch(() => "");
      return {
        translated_text: null,
        source_language: sourceLang,
        target_language: targetLang,
        status: "error",
        error: `BHASHINI Inference HTTP ${inferenceRes.status}: ${errorText}`.trim(),
      };
    }

    const inferenceData: any = await inferenceRes.json();
    const pipelineResp = inferenceData?.pipelineResponse || [];

    if (Array.isArray(pipelineResp) && pipelineResp.length > 0) {
      const transTask =
        pipelineResp.find((item: any) => item?.taskType === "translation") ||
        pipelineResp[0];
      const outputList = transTask?.output || [];
      if (Array.isArray(outputList) && outputList.length > 0 && outputList[0]?.target) {
        return {
          translated_text: outputList[0].target,
          source_language: sourceLang,
          target_language: targetLang,
          status: "success",
          error: null,
        };
      }
    }

    return {
      translated_text: null,
      source_language: sourceLang,
      target_language: targetLang,
      status: "error",
      error: "BHASHINI inference response contained no translation output.",
    };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError";
    return {
      translated_text: null,
      source_language: sourceLang,
      target_language: targetLang,
      status: "error",
      error: isAbort
        ? "BHASHINI API request timed out"
        : `BHASHINI Request Error: ${err?.message || err}`,
    };
  }
}

/**
 * Roman/Latin Indic text → native script via BHASHINI IndicXlit transliteration.
 * Used when Web Speech returns Romanized Hindi (e.g. "mai bihar ki mahila hu...")
 * instead of Devanagari. Same credentials as translation; does not change NMT.
 */
export async function transliterateText(
  text: string,
  sourceLang: string = "en",
  targetLang: string = "hi"
): Promise<BhashiniTransliterationResult> {
  if (!isBhashiniConfigured()) {
    return {
      transliterated_text: null,
      source_language: sourceLang,
      target_language: targetLang,
      status: "error",
      error:
        "BHASHINI API credentials not configured. Please set BHASHINI_UDYAT_KEY and BHASHINI_INFERENCE_KEY in environment.",
    };
  }

  const { udyatKey, inferenceKey, pipelineId, inferenceUrl, userId } =
    getBhashiniCredentials();

  try {
    let serviceId: string | null = null;
    let callbackUrl = inferenceUrl;
    let authHeaderName = "Authorization";

    const pipelinePayload = {
      pipelineTasks: [
        {
          taskType: "transliteration",
          config: {
            language: {
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
            },
          },
        },
      ],
      pipelineRequestConfig: {
        pipelineId,
      },
    };

    const configHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ulcaApiKey: udyatKey,
    };
    if (userId) {
      configHeaders["userID"] = userId;
    }

    const configController = new AbortController();
    const configTimeoutId = setTimeout(() => configController.abort(), 10000);

    try {
      const configRes = await fetch(PIPELINE_CONFIG_URL, {
        method: "POST",
        headers: configHeaders,
        body: JSON.stringify(pipelinePayload),
        signal: configController.signal,
      });

      clearTimeout(configTimeoutId);

      if (configRes.ok) {
        const pipelineData: any = await configRes.json();
        const endpointInfo = pipelineData?.pipelineInferenceAPIEndPoint || {};
        if (endpointInfo.callbackUrl) {
          callbackUrl = endpointInfo.callbackUrl;
        }
        if (endpointInfo.inferenceApiKey?.name) {
          authHeaderName = endpointInfo.inferenceApiKey.name;
        }

        const tasksConfig = pipelineData?.pipelineResponseConfig || [];
        for (const task of tasksConfig) {
          if (task?.taskType === "transliteration" && Array.isArray(task.config)) {
            const matchedConfig = task.config.find(
              (c: any) =>
                c?.language?.sourceLanguage === sourceLang &&
                c?.language?.targetLanguage === targetLang
            );
            serviceId = matchedConfig?.serviceId || task.config[0]?.serviceId || null;
            if (serviceId) break;
          }
        }
      } else {
        const errorText = await configRes.text().catch(() => "");
        console.warn(
          `[BHASHINI] Transliteration config warning (${configRes.status}): ${errorText}. Falling back to direct inference endpoint.`
        );
      }
    } catch (configErr: any) {
      clearTimeout(configTimeoutId);
      if (configErr?.name === "AbortError") {
        console.warn(
          "[BHASHINI] Transliteration config timed out. Proceeding to inference endpoint."
        );
      } else {
        console.warn(
          `[BHASHINI] Transliteration config failed: ${configErr?.message || configErr}. Proceeding to inference endpoint.`
        );
      }
    }

    const inferenceTaskConfig: Record<string, any> = {
      language: {
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      },
      isSentence: true,
      numSuggestions: 1,
    };
    if (serviceId) {
      inferenceTaskConfig["serviceId"] = serviceId;
    }

    const inferencePayload = {
      pipelineTasks: [
        {
          taskType: "transliteration",
          config: inferenceTaskConfig,
        },
      ],
      inputData: {
        input: [
          {
            source: text,
          },
        ],
      },
    };

    const infController = new AbortController();
    const infTimeoutId = setTimeout(() => infController.abort(), 15000);

    const inferenceRes = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [authHeaderName]: inferenceKey,
      },
      body: JSON.stringify(inferencePayload),
      signal: infController.signal,
    });

    clearTimeout(infTimeoutId);

    if (!inferenceRes.ok) {
      const errorText = await inferenceRes.text().catch(() => "");
      return {
        transliterated_text: null,
        source_language: sourceLang,
        target_language: targetLang,
        status: "error",
        error: `BHASHINI Transliteration HTTP ${inferenceRes.status}: ${errorText}`.trim(),
      };
    }

    const inferenceData: any = await inferenceRes.json();
    const pipelineResp = inferenceData?.pipelineResponse || [];

    if (Array.isArray(pipelineResp) && pipelineResp.length > 0) {
      const task =
        pipelineResp.find((item: any) => item?.taskType === "transliteration") ||
        pipelineResp[0];
      const outputList = task?.output || [];
      if (Array.isArray(outputList) && outputList.length > 0) {
        const rawTarget = outputList[0]?.target;
        // IndicXlit returns target as string[] of suggestions; NMT-style APIs may return a string.
        const transliterated =
          typeof rawTarget === "string"
            ? rawTarget
            : Array.isArray(rawTarget)
              ? rawTarget[0]
              : null;
        if (transliterated && String(transliterated).trim()) {
          return {
            transliterated_text: String(transliterated).trim(),
            source_language: sourceLang,
            target_language: targetLang,
            status: "success",
            error: null,
          };
        }
      }
    }

    return {
      transliterated_text: null,
      source_language: sourceLang,
      target_language: targetLang,
      status: "error",
      error: "BHASHINI inference response contained no transliteration output.",
    };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError";
    return {
      transliterated_text: null,
      source_language: sourceLang,
      target_language: targetLang,
      status: "error",
      error: isAbort
        ? "BHASHINI API request timed out"
        : `BHASHINI Request Error: ${err?.message || err}`,
    };
  }
}
