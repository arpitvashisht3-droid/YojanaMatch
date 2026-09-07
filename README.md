# YojanaMatch (योजना मैच)

> **AI-Powered Government Scheme Discovery & Eligibility-Matching Platform for Marginalized Entrepreneurs in India**
> Built for the Smart India Hackathon (SIH) MVP.

---

## 🌟 Core Problem & Solution

Marginalized entrepreneurs (SC/ST/OBC, women, rural, minorities, differently-abled) in India are eligible for substantial government benefits and collateral-free loan schemes (PMEGP, Stand-Up India, MUDRA, PM-AJAY, PM Vishwakarma, etc.), but struggle to discover them due to fragmented portals, bureaucratic jargon, and language barriers.

**YojanaMatch** provides:
1. **Zero-typing voice & plain-text discovery** in Hindi and English.
2. **AI Profile Extraction (Gemini)**: Extracts structured demographics without hallucinating eligibility.
3. **Deterministic Rule-Based Matching Engine**: Pure unit-testable code matching against 15 real Indian government schemes.
4. **Follow-up Smart Chat**: Dynamic conversational questionnaire capped at maximum 3 questions with quick-reply buttons and wildcard options ("Prefer not to say").
5. **Plain-Language Explanations & Audio TTS**: 60-word 6th-grade reading level summaries with speech playback.

---

## 🏗️ Architecture & Branching Flow

```
[Screen 1: Landing + Input]
        │
        ▼ (Voice / Text)
[Loading State: Understanding Situation]
        │
        ▼
Backend: Gemini Extracts Structured Profile {age, gender, caste, state, district_type, business_type, income}
        │
   ┌────┴────────────────────────┐
   │ Missing 1-3 fields           │ All required fields present
   ▼                              ▼
[Screen 2: Follow-up Chat]   [Loading State: Finding Schemes]
(Max 3 questions, buttons)        │
   │                              │
   └─────────────┬────────────────┘
                 ▼
Backend: Deterministic Matching Engine against schemes.json
                 │
   ┌─────────────┴────────────────┐
   │ 0 Matches Found               │ 1+ Matches Found
   ▼                              ▼
[Screen 3: Empty State]       [Screen 3: Ranked Results]
- "Modify My Answers"         - Collapsible scheme cards
- Retains user input          - 60-word plain language explanation
                              - Bhashini/Gemini TTS playback
                              - Direct "Apply Now" official links
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (or configure in your deployment dashboard):

```bash
# Google Gemini API Key (Free tier available at https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# (Optional) Bhashini API Key (https://bhashini.gov.in/ulca/user/login)
BHASHINI_API_KEY=your_bhashini_api_key_here
```

### Free-Tier API Setup Links:
- **Google AI Studio (Gemini)**: [https://aistudio.google.com/](https://aistudio.google.com/)
- **Bhashini (Govt of India AI for Bharat)**: [https://bhashini.gov.in/](https://bhashini.gov.in/)

---

## 🚀 Running Locally

### Option 1: Full-Stack Node.js (Vite + Express)
```bash
# Install dependencies
npm install

# Run dev server on port 3000
npm run dev
```

### Option 2: Python FastAPI Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
