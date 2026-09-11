# YojanaMatch Database (`YojanaMatch-Database`)

Production-ready MongoDB architecture module for the YojanaMatch application.

This module provides:
- A **reusable, explicit MongoDB connection** using the native `mongodb` Node.js driver
- **TypeScript type definitions** for all documents
- **Model classes** for `users`, `schemes`, `scholarships`, and `match_histories`
- **MongoDB JSON Schema validators** enforced at the database level
- **Performance indexes** for all critical query patterns
- A **safe, non-destructive upsert-based seed script** for `schemes` and `scholarships`

---

## Worktree Isolation Contract

> **CRITICAL**: This module operates under strict worktree isolation.

| Rule | Detail |
|------|--------|
| ✅ May create/modify | Files inside `YojanaMatch-Database/` only |
| ❌ Must NOT modify | `YojanaMatch`, `YojanaMatch-Frontend`, `YojanaMatch-Backend1`, `YojanaMatch-Backend2`, `YojanaMatch-Bhashini` |
| 📂 Seed data origin | `seed/data/` files are **local copies** inside this worktree; originals in other worktrees are read-only |

---

## Directory Structure

```
YojanaMatch-Database/
├── config/
│   └── connection.ts        # MongoDB connection module (connectDB, getDB, closeDB, collection getters)
├── models/
│   ├── User.ts              # UserModel — CRUD for users collection (embedded profile)
│   ├── Scheme.ts            # SchemeModel — upsert, search, find for schemes collection
│   ├── Scholarship.ts       # ScholarshipModel — upsert, search, find for scholarships collection
│   └── MatchHistory.ts      # MatchHistoryModel — create & retrieve match history records
├── types/
│   └── index.ts             # All TypeScript interfaces and document types
├── validators/
│   └── schemas.ts           # MongoDB $jsonSchema validators + index creation
├── seed/
│   ├── seed.ts              # Non-destructive seed script (upsert only)
│   └── data/
│       ├── schemes.json     # Baseline government schemes dataset (local copy)
│       └── scholarships.json # Baseline educational scholarships dataset (local copy)
├── index.ts                 # Module barrel — re-exports everything
├── package.json
├── tsconfig.json
├── .env.example             # Template for .env (never commit real .env)
└── README.md                # This file
```

---

## Collections

### 1. `users`

Stores user accounts with an **embedded profile** sub-document.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | MongoDB primary key |
| `name` | string | Min 2 chars |
| `phone_number` | string | 10-digit normalized Indian mobile — **unique index** |
| `password_hash` | string (optional) | bcrypt hash |
| `role` | `"user"` \| `"admin"` | Access level |
| `onboarding.completed` | boolean | Whether onboarding is done |
| `onboarding.step` | number | Current onboarding step |
| `profile` | object | Embedded demographic profile (see below) |
| `preferred_language` | `"en"` \| `"hi"` | UI language preference |
| `created_at` | Date | |
| `updated_at` | Date | |

**Embedded `profile` fields** (`EmbeddedUserProfile`):

| Field | Type |
|-------|------|
| `age` | number |
| `age_range` | string (e.g. `"18-25"`) |
| `gender` | `"female"` \| `"male"` \| `"transgender"` \| `"any"` |
| `caste_category` | `"sc"` \| `"st"` \| `"obc"` \| `"general"` \| `"minority"` \| `"ews"` \| `"any"` |
| `state` | string |
| `district_type` | `"rural"` \| `"urban"` \| `"semi-urban"` \| `"any"` |
| `business_situation` | `"existing"` \| `"new"` |
| `business_type` | one of 12 enum values |
| `income_range` | string |
| `estimated_income` | number |
| `is_differently_abled` | boolean |
| `education_level` | `"school"` \| `"undergraduate"` \| `"postgraduate"` \| `"diploma"` \| `"any"` |
| `current_marks_percentage` | number |
| `course_type` | `"general"` \| `"technical"` \| `"medical"` \| `"vocational"` \| `"any"` |

**Indexes on `users`:**
- `{ phone_number: 1 }` — unique
- `{ "profile.state": 1, "profile.caste_category": 1 }` — composite query index

---

### 2. `schemes`

Government welfare and entrepreneur-support schemes.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | MongoDB primary key |
| `scheme_id` | string | E.g. `"pmegp"` — **unique index** |
| `name` | string | English name |
| `hindi_name` | string | Hindi name |
| `ministry` | string | |
| `hindi_ministry` | string | |
| `benefit_headline` | string | |
| `official_link` | string | |
| `short_summary` | string | |
| `category_type` | `"scheme"` | Discriminator |
| `eligibility` | SchemeEligibility object | See types |
| `benefits` | SchemeBenefits object | |
| `applicable_states` | string[] | |
| `category_tags` | string[] | |
| `popularity_score` | number | 0–100, used for ranking |
| `is_active` | boolean | Soft-disable without deletion |
| `source` | `"curated"` \| `"data_gov_in"` | |
| `created_at` | Date | |
| `updated_at` | Date | |

**Indexes on `schemes`:**
- `{ scheme_id: 1 }` — unique
- `{ is_active: 1, popularity_score: -1 }` — active + ranked queries
- `{ applicable_states: 1 }` — state filter
- `{ "eligibility.allowed_castes": 1 }` — caste filter
- `{ "eligibility.allowed_business_types": 1 }` — business type filter

---

### 3. `scholarships`

Educational scholarship programs (separate collection due to distinct academic eligibility logic).

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | MongoDB primary key |
| `scholarship_id` | string | E.g. `"post_matric_sc"` — **unique index** |
| `name` | string | |
| `hindi_name` | string | |
| `ministry` | string | |
| `category_type` | `"scholarship"` | Discriminator |
| `eligibility` | ScholarshipEligibility | Includes academic fields |
| `benefits` | ScholarshipBenefits | |
| `applicable_states` | string[] | |
| `is_active` | boolean | |
| `created_at` / `updated_at` | Date | |

**Academic eligibility fields** (distinct from schemes):
- `education_levels` — `"school"` \| `"undergraduate"` \| `"postgraduate"` \| `"diploma"`
- `minimum_marks_percentage` — number
- `course_types` — `"general"` \| `"technical"` \| `"medical"` \| `"vocational"`

**Indexes on `scholarships`:**
- `{ scholarship_id: 1 }` — unique
- `{ is_active: 1, popularity_score: -1 }` — active + ranked queries
- `{ "eligibility.allowed_castes": 1 }` — caste filter
- `{ "eligibility.education_levels": 1 }` — education level filter

---

### 4. `match_histories`

Records of each scheme/scholarship match search performed by a user.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | MongoDB primary key |
| `user_id` | ObjectId | **FK → `users._id`** |
| `category_type` | `"scheme"` \| `"scholarship"` | |
| `input_mode` | `"voice"` \| `"text"` \| `"onboarding"` | How user provided input |
| `raw_input_text` | string | Original speech-to-text / typed text |
| `extracted_profile_snapshot` | EmbeddedUserProfile | Profile at time of search |
| `total_matches` | number | Count of matched results |
| `results` | MatchedResultItem[] | Detailed match results with scores |
| `language` | `"en"` \| `"hi"` | Language used for search |
| `created_at` | Date | |

**`MatchedResultItem` structure:**
```typescript
{
  scheme_id: string;               // String ID of matched scheme/scholarship
  scheme_name: string;
  match_score: number;             // 0–100 percentage match
  matched_criteria_count: number;
  total_criteria_checked: number;
  match_details: MatchScoreDetail[];
  ai_explanation?: string;         // English AI explanation
  hindi_ai_explanation?: string;   // Hindi AI explanation
}
```

**Indexes on `match_histories`:**
- `{ user_id: 1, created_at: -1 }` — user history lookup (most recent first)
- `{ category_type: 1 }` — filter by type

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- MongoDB 6.0+ (local or Atlas)

### Steps

```bash
# 1. Navigate to the database module
cd YojanaMatch-Database

# 2. Create your environment file
cp .env.example .env
# Edit .env with your MongoDB URI

# 3. Install dependencies
npm install

# 4. Run TypeScript validation (no build needed for seed)
npm run validate

# 5. Seed the database (non-destructive — safe to re-run)
npm run seed
```

### Or, in a single command:
```bash
npm run setup
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | ✅ Yes | — | MongoDB connection string |
| `MONGODB_DB_NAME` | No | `yojanamatch` | Database name |
| `NODE_ENV` | No | `development` | Environment mode |

> See `.env.example` for detailed examples including Atlas connection strings.

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm install` | — | Install all dependencies |
| `npm run validate` | `tsc --noEmit` | Type-check without building |
| `npm run build` | `tsc` | Compile TypeScript to `dist/` |
| `npm run seed` | `tsx seed/seed.ts` | Run database seeder (non-destructive upsert) |
| `npm run setup` | install + seed | Full setup in one command |
| `npm run check-connection` | `tsx -e ...` | Quick MongoDB connection test |

---

## Non-Destructive Seed Contract

The seed script **ONLY uses upsert operations** (`findOneAndUpdate` with `upsert: true`).

- ✅ New records are inserted
- ✅ Existing records are updated (fields refreshed from seed data)
- ❌ No records are deleted
- ❌ No collections are dropped
- ❌ No other worktree files are modified

The seed data files are maintained as **local copies** inside this worktree:
- `seed/data/schemes.json` — source: originally from `YojanaMatch-Frontend` backend data
- `seed/data/scholarships.json` — source: originally from `YojanaMatch-Frontend` backend data

If these files need updating, **copy the new data into this worktree** and do NOT modify files in other worktrees.

---

## Module Exports (`index.ts`)

```typescript
// Types
export * from "./types/index.js";         // All document types & interfaces

// Connection
export * from "./config/connection.js";   // connectDB, getDB, closeDB, collection getters

// Validators
export * from "./validators/schemas.js";  // applyCollectionValidatorsAndIndexes

// Models
export * from "./models/User.js";         // UserModel, sanitizeUser, normalizePhoneNumber
export * from "./models/Scheme.js";       // SchemeModel
export * from "./models/Scholarship.js";  // ScholarshipModel
export * from "./models/MatchHistory.js"; // MatchHistoryModel
```

---

## Architecture Decisions

| Decision | Reasoning |
|----------|-----------|
| Native `mongodb` driver (no Mongoose) | Existing project uses MongoClient + TypeScript interfaces; avoids schema duplication |
| Embedded `profile` in `users` | Profile is always read with user; no join needed; simplifies queries |
| `users._id` (ObjectId) as FK in `match_histories` | MongoDB-native reference; avoids phone number as FK |
| Separate `scholarships` collection | Distinct academic eligibility fields (`education_levels`, `minimum_marks_percentage`) differ fundamentally from business scheme eligibility |
| String `scheme_id` / `scholarship_id` preserved | Backward compat with frontend code and existing JSON data; `_id` is still the primary MongoDB key |
| `tsx` for script execution | ESM-compatible TypeScript runner; works with `"type": "module"` and `NodeNext` resolution |
| Upsert-only seeding | Safe to re-run at any time without data loss |
