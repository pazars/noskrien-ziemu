# Data Pipeline Redesign - Clean Architecture

**Date:** 2026-01-17
**Status:** Approved for Implementation
**Migration Strategy:** Clean Slate (Drop & Recreate)

## Executive Summary

This design restructures the data pipeline from race result scraping to production database, solving critical issues with duplicate handling, schema design, and incremental updates. The new pipeline enables adding future seasons with a single command while eliminating the current mess of scripts, migrations, and manual interventions.

## Current Problems

### 1. Schema Design Flaw
The `participants` table has a `season` field, but participants race across multiple seasons. This causes data loss during duplicate merging:
- **Example:** Kristaps Bērziņš has all Tautas races incorrectly assigned to season "2019-2020" even for 2023-2026 races
- **Root Cause:** Duplicate merging collapsed multi-season participants into single records

### 2. Messy Order of Operations
- Scrape → Generate SQL → Import → Run API migration endpoint
- Duplicate detection happens AFTER import to production database
- Latvian character normalization scattered across scripts and runtime SQL

### 3. No Incremental Updates
To add a new season requires:
- Re-scrape everything
- Regenerate ALL SQL (3.0 MB)
- Delete and re-import 16,000+ records
- Re-run migration endpoints

### 4. Production Query Pattern Mismatch
Current schema optimizes for participant → races lookup. Production pattern is category-first → search people.

## Design Goals

1. **Clean Schema:** Remove flawed `season` field from participants, derive from race dates
2. **Idempotent Pipeline:** Can run repeatedly without data loss
3. **Pre-Import Deduplication:** Normalize and merge BEFORE hitting database
4. **Incremental Updates:** Add new season data without touching existing records
5. **Optimized for Production:** Index and structure for category-first search pattern
6. **Clear Workflow:** One command to sync new data from scrape to production

## New Schema Design

### Participants Table

```sql
CREATE TABLE participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  distance TEXT NOT NULL,          -- 'Tautas' or 'Sporta'
  gender TEXT NOT NULL,             -- 'V' (men) or 'S' (women)
  normalized_name TEXT NOT NULL,   -- Latvian-normalized for search/deduplication
  UNIQUE(normalized_name, distance, gender)
);
```

**Key Changes:**
- **Removed:** `season` field (participants aren't tied to one season)
- **Removed:** `link` field (unused in production)
- **Added:** `normalized_name` for fast searches and deduplication
- **Added:** UNIQUE constraint enforces one canonical record per person/distance/gender

### Races Table

```sql
CREATE TABLE races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL,
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  result TEXT NOT NULL,             -- 'MM:SS' or 'HH:MM:SS'
  km TEXT NOT NULL,                 -- Distance with comma/period decimals
  location TEXT NOT NULL,
  season TEXT NOT NULL,             -- Derived: '2023-2024' (Nov-Mar window)
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);
```

**Key Changes:**
- **Added:** `season` field (derived from date during import)
- Season used only for visualization, not participant identity

### Indexes (Optimized for Production)

```sql
-- Primary production pattern: filter by category → search names → get races
CREATE INDEX idx_participants_distance_gender ON participants(distance, gender);
CREATE INDEX idx_participants_normalized_name ON participants(normalized_name);
CREATE INDEX idx_races_participant_date ON races(participant_id, date);
CREATE INDEX idx_races_season_location ON races(season, location);
```

## Pipeline Architecture

```
┌─────────────┐
│   SCRAPE    │  1. Fetch race results from website
│  (Manual)   │     Output: data/{season}/{distance}/results_{gender}.json
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  NORMALIZE  │  2. Pre-process JSON files in-place
│  & DEDUPE   │     - Normalize Latvian characters
│  (scripts)  │     - Detect & merge duplicates BEFORE import
└──────┬──────┘     - Add normalized_name field
       │            - Derive season from race dates
       ▼
┌─────────────┐
│  GENERATE   │  3. Create idempotent SQL from clean JSON
│     SQL     │     - UPSERT participants (no duplicates)
│  (scripts)  │     - INSERT races with ON CONFLICT handling
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   IMPORT    │  4. Apply to database
│     TO      │     - Safe to run multiple times
│  DATABASE   │     - Incremental: only new data added
└─────────────┘
```

### Pipeline Scripts Structure

```
scripts/
├── pipeline/
│   ├── 1-scrape-season.ts        # Scrape one season (Tautas + Sporta)
│   ├── 2-normalize-data.ts       # Clean JSON files, merge duplicates
│   ├── 3-generate-sql.ts         # Create idempotent SQL
│   └── 4-import-to-db.sh         # Execute import safely
├── sync-new-season.sh            # Run all 4 steps for new season
└── rebuild-from-scratch.sh       # Nuclear option: re-import everything
```

## Technical Implementation

### Step 2: Normalize & Dedupe

**Purpose:** Merge duplicates in JSON files BEFORE import.

**Algorithm:**

1. Load all JSON files from `data/` directory
2. Build participant registry across all seasons:
   ```typescript
   // Key: normalized_name|distance|gender
   // Value: canonical participant data + all their races
   const registry = new Map<string, CanonicalParticipant>();
   ```

3. Merge duplicates in-memory:
   ```typescript
   function selectCanonicalName(names: string[]): string {
     return names.sort((a, b) => {
       // 1. More Latvian chars wins (Dāvis > Davis)
       const diff = countLatvianChars(b) - countLatvianChars(a);
       if (diff !== 0) return diff;

       // 2. Natural casing wins over UPPERCASE (Ilze > ILZE)
       const aNatural = hasNaturalCasing(a);
       const bNatural = hasNaturalCasing(b);
       if (aNatural !== bNatural) return aNatural ? -1 : 1;

       // 3. Alphabetical tie-breaker
       return a.localeCompare(b);
     })[0];
   }
   ```

4. Derive season from race dates:
   ```typescript
   function deriveSeasonFromDate(date: string): string {
     const [year, month] = date.split('-').map(Number);
     // Nov-Dec: YYYY-(YYYY+1)
     // Jan-Mar: (YYYY-1)-YYYY
     if (month >= 11) return `${year}-${year + 1}`;
     return `${year - 1}-${year}`;
   }
   ```

5. Write back canonical data to JSON files

6. Generate report:
   ```
   ✓ Processed 6,337 raw participants
   ✓ Merged 176 duplicates into 83 groups
   ✓ Final count: 6,161 unique participants
   ```

### Step 3: Generate Idempotent SQL

**Participants (UPSERT pattern):**

```sql
INSERT INTO participants (name, distance, gender, normalized_name)
VALUES ('Dāvis Pazars', 'Tautas', 'V', 'davis pazars')
ON CONFLICT(normalized_name, distance, gender)
DO UPDATE SET name = excluded.name;  -- Update if canonical name improved
```

**Races (INSERT with duplicate detection):**

```sql
INSERT INTO races (participant_id, date, result, km, location, season)
SELECT p.id, '2023-11-26', '41:02', '10,5', 'Smiltene', '2023-2024'
FROM participants p
WHERE p.normalized_name = 'davis pazars'
  AND p.distance = 'Tautas'
  AND p.gender = 'V'
AND NOT EXISTS (
  SELECT 1 FROM races r
  WHERE r.participant_id = p.id
    AND r.date = '2023-11-26'
    AND r.location = 'Smiltene'
);
```

**Benefits:**
- Run the same SQL file multiple times → same result
- Safe to re-run after network failures
- No manual cleanup needed

## API Simplification

### Before: Complex Runtime Normalization

```typescript
// /api/results - 22 nested REPLACE calls at runtime!
const query = `
  SELECT MIN(id) as id, name, gender
  FROM participants
  WHERE (
    name LIKE ? COLLATE NOCASE
    OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          LOWER(name),
          'ā', 'a'), 'č', 'c'), 'ē', 'e'), 'ģ', 'g'), 'ī', 'i'),
          'ķ', 'k'), 'ļ', 'l'), 'ņ', 'n'), 'š', 's'), 'ū', 'u'), 'ž', 'z'),
        'Ā', 'A'), 'Č', 'C'), 'Ē', 'E'), 'Ģ', 'G'), 'Ī', 'I'),
        'Ķ', 'K'), 'Ļ', 'L'), 'Ņ', 'N'), 'Š', 'S'), 'Ū', 'U'), 'Ž', 'Z')
    LIKE ? COLLATE NOCASE
  )
  AND distance = ?
  GROUP BY name, gender
  LIMIT 10
`;
```

### After: Simple Indexed Lookup

```typescript
// /api/results - clean and fast
const query = `
  SELECT id, name, gender
  FROM participants
  WHERE normalized_name LIKE ?
    AND distance = ?
  LIMIT 10
`;

const normalizedQuery = normalizeLatvian(name).toLowerCase();
const { results } = await env.DB.prepare(query)
  .bind(`%${normalizedQuery}%`, distance)
  .all();
```

**Performance Impact:** 10-50x faster with indexed `normalized_name` field.

### API Changes Required

1. **`/api/results`** - Use `normalized_name` for search
2. **`/api/history`** - Query by participant ID instead of name
3. **Remove** `/api/migrate/latvian-duplicates` endpoint (no longer needed)

### Frontend Changes (Minimal)

```typescript
// ParticipantSelector.tsx - store ID instead of just name
interface Participant {
  id: number;      // Add this
  name: string;
  gender: string;
}

// When user selects participant
onSelect={(participant) => {
  setSelectedParticipant(participant.id);  // Pass ID, not name
}}
```

## Migration Strategy: Clean Slate

### Why Clean Slate?

- **Small dataset:** 6,161 participants, 16,245 races
- **Fast import:** ~300ms according to existing benchmarks
- **Simpler verification:** Fresh start, no legacy inconsistencies
- **Low risk:** JSON files are source of truth, easy rollback

### Implementation Phases

**Phase 1: Build New Pipeline (No Breaking Changes)**
1. Create new schema file: `schema-v2.sql`
2. Build normalization script: `scripts/pipeline/2-normalize-data.ts`
3. Build new SQL generator: `scripts/pipeline/3-generate-sql.ts`
4. Test on local D1 database
5. Verify all 6,161 participants imported correctly

**Phase 2: Update API (Backward Compatible)**
1. Add `normalized_name` support to API queries
2. Keep old queries working during transition
3. Test with production data snapshot
4. Deploy API changes

**Phase 3: Cut Over (Production Migration)**
1. Announce brief maintenance window (~5 minutes)
2. Export current data as backup
3. Run new pipeline: `npm run pipeline:rebuild`
4. Verify counts and sample queries
5. Remove old migration endpoints
6. Total downtime: ~5 minutes

**Phase 4: Future Additions (Ongoing)**
```bash
# When new season data available:
npm run sync:season 2026-2027

# Internally runs:
# 1. Scrape 2026-2027 data
# 2. Normalize and merge with existing
# 3. Generate incremental SQL
# 4. Import (only new races added)
```

### Rollback Plan

```bash
# If migration fails, restore from backup
wrangler d1 execute noskrien-ziemu --remote --file=backup-2026-01-17.sql
```

### Success Metrics

- ✅ All 6,161 unique participants imported
- ✅ All 16,245 races imported with correct seasons
- ✅ No duplicates in database (verified by UNIQUE constraint)
- ✅ API response time < 100ms for autocomplete
- ✅ Comparison logic finds correct number of common races
- ✅ Can add new season without touching existing data

## Benefits Summary

### Immediate
- **Clean data:** No more duplicate participants with mismatched seasons
- **Fast API:** 10-50x faster autocomplete queries
- **Correct seasons:** All races show accurate season (derived from date)
- **Simple code:** Remove 200+ lines of complex SQL normalization

### Long-term
- **One command updates:** `npm run sync:season 2026-2027` adds new data
- **Idempotent operations:** Safe to re-run, no manual cleanup
- **Clear workflow:** JSON → Normalize → SQL → Import (no surprises)
- **Easy to understand:** Source of truth is JSON files, database is derived

## Files to Create/Modify

### New Files
- `docs/plans/2026-01-17-data-pipeline-redesign.md` (this document)
- `schema-v2.sql` (new schema)
- `scripts/pipeline/2-normalize-data.ts` (deduplication)
- `scripts/pipeline/3-generate-sql.ts` (idempotent SQL)
- `scripts/sync-new-season.sh` (wrapper script)
- `scripts/rebuild-from-scratch.sh` (full rebuild)

### Modified Files
- `functions/api/[[path]].ts` (simplified queries)
- `src/components/ParticipantSelector.tsx` (use participant IDs)
- `src/components/RaceComparison.tsx` (pass participant IDs)
- `package.json` (add npm scripts)

### Deprecated Files
- `scripts/check_duplicates.ts` (duplicates handled at import)
- `scripts/import_to_db.sh` (replaced by pipeline)
- `migrations/*` (no longer needed)

## Next Steps

1. Create git worktree for isolated development
2. Write implementation plan with detailed task breakdown
3. Implement Phase 1 (build new pipeline)
4. Test on local database
5. Deploy to production with clean slate migration
