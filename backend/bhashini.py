import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Tuple

# Official BHASHINI ULCA Endpoints
PIPELINE_SEARCH_URL = "https://meity-auth.bhashini.gov.in/ulca/apis/v0/model/getInferencePipeline"
DEFAULT_PIPELINE_ID = "64392f08a7b312788e67041a"


def is_bhashini_configured() -> bool:
    """
    Returns True if required BHASHINI environment variables (USER_ID and API_KEY) are set.
    """
    user_id = os.environ.get("BHASHINI_USER_ID", "").strip()
    api_key = os.environ.get("BHASHINI_API_KEY", "").strip()
    return bool(user_id and api_key)


def get_bhashini_credentials() -> Tuple[str, str, str]:
    """
    Retrieve BHASHINI API credentials from environment variables.
    """
    user_id = os.environ.get("BHASHINI_USER_ID", "").strip()
    api_key = os.environ.get("BHASHINI_API_KEY", "").strip()
    pipeline_id = os.environ.get("BHASHINI_PIPELINE_ID", "").strip() or DEFAULT_PIPELINE_ID
    return user_id, api_key, pipeline_id


def translate_text(text: str, source_lang: str = "en", target_lang: str = "hi") -> Dict[str, Any]:
    """
    Translates text using the official BHASHINI ULCA Pipeline API.
    
    Returns a dict:
      {
        "translated_text": str or None,
        "source_language": str,
        "target_language": str,
        "status": "success" | "error",
        "error": str or None
      }
    """
    if not is_bhashini_configured():
        return {
            "translated_text": None,
            "source_language": source_lang,
            "target_language": target_lang,
            "status": "error",
            "error": "BHASHINI API credentials not configured. Please set BHASHINI_USER_ID and BHASHINI_API_KEY in environment."
        }

    user_id, api_key, pipeline_id = get_bhashini_credentials()

    # Step 1: Query Pipeline Config
    pipeline_payload = {
        "pipelineTasks": [
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": source_lang,
                        "targetLanguage": target_lang
                    }
                }
            }
        ],
        "pipelineRequestConfig": {
            "pipelineId": pipeline_id
        }
    }

    headers = {
        "Content-Type": "application/json",
        "userID": user_id,
        "ulcaApiKey": api_key
    }

    try:
        pipeline_req = urllib.request.Request(
            PIPELINE_SEARCH_URL,
            data=json.dumps(pipeline_payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )

        with urllib.request.urlopen(pipeline_req, timeout=10) as resp:
            pipeline_resp_data = json.loads(resp.read().decode("utf-8"))

        # Step 2: Parse callbackUrl, auth header info, and serviceId
        endpoint_info = pipeline_resp_data.get("pipelineInferenceAPIEndPoint", {})
        callback_url = endpoint_info.get("callbackUrl")
        auth_key_info = endpoint_info.get("inferenceApiKey", {})
        header_name = auth_key_info.get("name", "Authorization")
        header_value = auth_key_info.get("value")

        tasks_config = pipeline_resp_data.get("pipelineResponseConfig", [])
        service_id = None
        if tasks_config and len(tasks_config) > 0:
            config_list = tasks_config[0].get("config", [])
            if config_list and len(config_list) > 0:
                service_id = config_list[0].get("serviceId")

        if not callback_url or not header_value:
            return {
                "translated_text": None,
                "source_language": source_lang,
                "target_language": target_lang,
                "status": "error",
                "error": "BHASHINI pipeline configuration response missing callback URL or inference API key."
            }

        # Step 3: Compute Inference Call
        inference_payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": source_lang,
                            "targetLanguage": target_lang
                        },
                        "serviceId": service_id
                    }
                }
            ],
            "inputData": {
                "input": [
                    {
                        "source": text
                    }
                ]
            }
        }

        inference_headers = {
            "Content-Type": "application/json",
            header_name: header_value
        }

        inference_req = urllib.request.Request(
            callback_url,
            data=json.dumps(inference_payload).encode("utf-8"),
            headers=inference_headers,
            method="POST"
        )

        with urllib.request.urlopen(inference_req, timeout=10) as inf_resp:
            inf_resp_data = json.loads(inf_resp.read().decode("utf-8"))

        pipeline_resp = inf_resp_data.get("pipelineResponse", [])
        if pipeline_resp and len(pipeline_resp) > 0:
            output_list = pipeline_resp[0].get("output", [])
            if output_list and len(output_list) > 0:
                translated_text = output_list[0].get("target")
                return {
                    "translated_text": translated_text,
                    "source_language": source_lang,
                    "target_language": target_lang,
                    "status": "success",
                    "error": None
                }

        return {
            "translated_text": None,
            "source_language": source_lang,
            "target_language": target_lang,
            "status": "error",
            "error": "BHASHINI inference response contained no translation output."
        }

    except urllib.error.HTTPError as e:
        error_body = ""
        try:
            error_body = e.read().decode("utf-8")
        except Exception:
            pass
        return {
            "translated_text": None,
            "source_language": source_lang,
            "target_language": target_lang,
            "status": "error",
            "error": f"BHASHINI HTTP Error {e.code}: {e.reason}. {error_body}".strip()
        }
    except urllib.error.URLError as e:
        return {
            "translated_text": None,
            "source_language": source_lang,
            "target_language": target_lang,
            "status": "error",
            "error": f"BHASHINI Network URL Error: {e.reason}"
        }
    except Exception as e:
        return {
            "translated_text": None,
            "source_language": source_lang,
            "target_language": target_lang,
            "status": "error",
            "error": f"BHASHINI Request Error: {str(e)}"
        }
