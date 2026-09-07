# YojanaMatch Backend1 Microservice

**YojanaMatch Backend1** is the core Python FastAPI AI + Discovery Microservice responsible for natural-language profile extraction, government scheme and scholarship eligibility matching, and plain-language AI explanations for marginalized entrepreneurs and students across India.

---

## Key Features

* **AI Profile Extraction (`POST /api/extract-profile`)**: Analyzes free-text or transcribed voice input in **English, Hindi, and Hinglish** to extract structured profile attributes (`age`, `gender`, `caste_category`, `state`, `district_type`, `business_type`, `estimated_income`, `is_differently_abled`, `education_level`, `course_type`, `current_marks_percentage`).
* **Onboarding Data Preservation (`knownProfile`)**: Intelligent profile merging that preserves existing user onboarding attributes without overwriting them with missing or null values.
* **Live Government Catalogue**: Scheme records are fetched over HTTP from the [Open Government Data Platform India (data.gov.in)](https://data.gov.in/). There is **no** production fallback to hand-authored `schemes.json` / `scholarships.json` / `catalogue_cache.json`.
* **Deterministic Matching Engine (`POST /api/match-schemes`)**: Pure rule-based scoring engine operating over 12 criteria (Age, Gender, Social Category, Location Type, Business Sector, Income, Education Level, Marks, Stream, Disability, Priority Bonuses, State Relevance) with a strict 90% score ceiling. Runs only when the live catalogue is configured and successfully fetched.
* **Personalized AI Explanations (`POST /api/explain-scheme`)**: Generates 6th-grade reading level explanations under 60 words directly addressing applicants in English or Hindi.
* **Offline Resilience for Gemini only**: Profile extraction and explanations still degrade when `GEMINI_API_KEY` is omitted. The **scheme catalogue itself does not** silently fall back to local hardcoded records.

---

## Setup & Installation

### 1. Requirements
* Python 3.9+
* `fastapi`, `uvicorn`, `pydantic`, `google-generativeai`, `python-dotenv`

### 2. Environment Configuration

Copy the example env file and fill in keys:

```bash
cp backend/.env.example backend/.env
```

Required for a **live** government catalogue:

| Variable | Purpose |
| --- | --- |
| `DATA_GOV_IN_API_KEY` | API key from [data.gov.in](https://data.gov.in/) (register → generate API key) |
| `SCHEME_DATA_SOURCE_URL` | Full **resource API URL** for the dataset you want to use, e.g. `https://api.data.gov.in/resource/<RESOURCE_ID>?format=json&limit=100` |

Optional:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini extraction/explanations (heuristic/static fallbacks if unset) |

#### How to get a real `SCHEME_DATA_SOURCE_URL`

1. Open [https://data.gov.in/](https://data.gov.in/) and sign in / register.
2. Create an **API key** (this is `DATA_GOV_IN_API_KEY`).
3. Find a schemes/scholarships (or related) **dataset** → open its **API** / resource page.
4. Copy the resource API endpoint of the form:
   `https://api.data.gov.in/resource/<RESOURCE_ID>`
5. Set in `backend/.env`:

```bash
DATA_GOV_IN_API_KEY=your_data_gov_in_api_key
SCHEME_DATA_SOURCE_URL=https://api.data.gov.in/resource/<RESOURCE_ID>?format=json&limit=100
```

The catalogue provider performs a **real HTTP GET** to that URL, appends `api-key` if missing, parses JSON `records`, and normalizes each row into the internal `Scheme` model.

If either variable is missing:
* `GET /api/health` returns `"catalogue_live": false`
* `POST /api/match-schemes` returns **HTTP 503** with a clear configuration error
* The old local 21-record catalogue is **not** used

### 3. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

---

## Running the Server

From the project root:

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Or from `backend/`:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## Tests

Prove external JSON → normalization → matching (HTTP is mocked; no fabricated live claim):

```bash
cd backend && python -m unittest test_catalogue_pipeline.py -v
```

---

## API Endpoints Summary

### 1. Health Check
* **`GET /api/health`**
* **Response (catalogue not configured)**:
  ```json
  {
    "status": "ok",
    "catalogue_live": false,
    "catalogue_configured": false,
    "schemes_count": 0,
    "scholarships_count": 0,
    "total_catalogue_records": 0
  }
  ```
* **`catalogue_live: true` only after a successful external HTTP fetch.**

### 2. Profile Extraction
* **`POST /api/extract-profile`**
* Unchanged: Gemini when keyed; heuristic fallback otherwise.

### 3. Scheme & Scholarship Eligibility Matching
* **`POST /api/match-schemes`**
* Requires live government catalogue. Returns **503** if not configured / not live.
* Request:
  ```json
  {
    "profile": {
      "age": 28,
      "gender": "female",
      "caste_category": "sc",
      "state": "Haryana",
      "district_type": "rural",
      "business_type": "artisan_handicraft"
    },
    "category_type": "scheme"
  }
  ```

### 4. Scheme Explanation
* **`POST /api/explain-scheme`**
* Unchanged: Gemini when keyed; static summary fallback otherwise.
