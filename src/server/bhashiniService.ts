import process from "node:process";

const PIPELINE_SEARCH_URL = "https://meity-auth.bhashini.gov.in/ulca/apis/v0/model/getInferencePipeline";
const DEFAULT_PIPELINE_ID = "64392f08a7b312788e67041a";

export interface BhashiniTranslationResult {
  translated_text: string | null;
  source_language: string;
  target_language: string;
  status: "success" | "error";
  error: string | null;
}

/**
 * Returns true if both BHASHINI_USER_ID and BHASHINI_API_KEY environment variables are present.
 */
export function isBhashiniConfigured(): boolean {
  const userId = (process.env.BHASHINI_USER_ID || "").trim();
  const apiKey = (process.env.BHASHINI_API_KEY || "").trim();
  return Boolean(userId && apiKey);
}

/**
 * Retrieve BHASHINI credentials safely from environment variables.
 */
export function getBhashiniCredentials(): { userId: string; apiKey: string; pipelineId: string } {
  const userId = (process.env.BHASHINI_USER_ID || "").trim();
  const apiKey = (process.env.BHASHINI_API_KEY || "").trim();
  const pipelineId = (process.env.BHASHINI_PIPELINE_ID || "").trim() || DEFAULT_PIPELINE_ID;
  return { userId, apiKey, pipelineId };
}

/**
 * Performs translation using official BHASHINI ULCA Pipeline API (MeitY AI for Bharat).
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
      error: "BHASHINI API credentials not configured. Please set BHASHINI_USER_ID and BHASHINI_API_KEY in environment.",
    };
  }

  const { userId, apiKey, pipelineId } = getBhashiniCredentials();

  try {
    // Step 1: Query Pipeline Config
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const pipelineRes = await fetch(PIPELINE_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        userID: userId,
        ulcaApiKey: apiKey,
      },
      body: JSON.stringify(pipelinePayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!pipelineRes.ok) {
      const errorText = await pipelineRes.text().catch(() => "");
      return {
        translated_text: null,
        source_language: sourceLang,
        target_language: targetLang,
        status: "error",
        error: `BHASHINI Pipeline Search HTTP ${pipelineRes.status}: ${errorText}`.trim(),
      };
    }

    const pipelineData: any = await pipelineRes.json();

    // Step 2: Parse callbackUrl, auth header info, and serviceId
    const endpointInfo = pipelineData?.pipelineInferenceAPIEndPoint || {};
    const callbackUrl = endpointInfo.callbackUrl;
    const authKeyInfo = endpointInfo.inferenceApiKey || {};
    const headerName = authKeyInfo.name || "Authorization";
    const headerValue = authKeyInfo.value;

    const tasksConfig = pipelineData?.pipelineResponseConfig || [];
    let serviceId: string | null = null;
    if (tasksConfig.length > 0 && tasksConfig[0]?.config?.length > 0) {
      serviceId = tasksConfig[0].config[0].serviceId;
    }

    if (!callbackUrl || !headerValue) {
      return {
        translated_text: null,
        source_language: sourceLang,
        target_language: targetLang,
        status: "error",
        error: "BHASHINI pipeline configuration response missing callback URL or inference API key.",
      };
    }

    // Step 3: Compute Inference Call
    const inferencePayload = {
      pipelineTasks: [
        {
          taskType: "translation",
          config: {
            language: {
              sourceLanguage: sourceLang,
              targetLanguage: targetLang,
            },
            serviceId: serviceId,
          },
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
    const infTimeoutId = setTimeout(() => infController.abort(), 10000);

    const inferenceRes = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [headerName]: headerValue,
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
    if (pipelineResp.length > 0) {
      const outputList = pipelineResp[0]?.output || [];
      if (outputList.length > 0 && outputList[0]?.target) {
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
      error: isAbort ? "BHASHINI API request timed out (10s limit)" : `BHASHINI Request Error: ${err?.message || err}`,
    };
  }
}
