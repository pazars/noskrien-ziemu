# Data Pipeline Scripts

This directory contains the data pipeline scripts for the Noskrien Ziemu project. The pipeline processes race data from JSON files and imports it into the Cloudflare D1 database.

## Pipeline Overview

```
Raw JSON data → Normalize → Generate SQL → Import to D1
```

## Scripts

### 1. Normalize Data (`2-normalize-data.ts`)

Normalizes raw JSON data by:
- Merging duplicate participants with different Latvian character spellings
- Adding `normalized_name` field for search and deduplication
- Adding `season` field to races (derived from date)
- Selecting canonical names (prioritizes Latvian chars and natural casing)

**Usage:**
```bash
npm run pipeline:normalize [data-dir]
# or
npx tsx scripts/pipeline/2-normalize-data.ts [data-dir]
```

Default data directory: `data/`

### 2. Generate SQL (`3-generate-sql.ts`)

Generates idempotent SQL statements from normalized JSON files:
- UPSERT statements for participants (safe to run multiple times)
- Conditional INSERT statements for races (avoids duplicates)

**Usage:**
```bash
npm run pipeline:generate-sql [data-dir] [output-file]
# or
npx tsx scripts/pipeline/3-generate-sql.ts [data-dir] [output-file]
```

Defaults:
- Data directory: `data/`
- Output file: `import_data.sql`

### 3. Sync New Season (`sync-new-season.sh`)

End-to-end pipeline for syncing new season data to the database.

**Usage:**
```bash
npm run pipeline:sync [season]
# or
./scripts/pipeline/sync-new-season.sh [season]
```

**Example:**
```bash
./scripts/pipeline/sync-new-season.sh 2026-2027
```

**Steps:**
1. Check if season data exists (prompts to scrape if missing)
2. Normalize data (merge duplicates)
3. Generate idempotent SQL
4. Import to database (with user confirmation)
5. Verify import counts

**Notes:**
- If no season specified, processes all data
- Safe to run multiple times (idempotent)
- Prompts for confirmation before database changes

### 4. Rebuild from Scratch (`rebuild-from-scratch.sh`)

⚠️ **WARNING: Destructive operation!**

Full database rebuild from scratch.

**Usage:**
```bash
npm run pipeline:rebuild
# or
./scripts/pipeline/rebuild-from-scratch.sh
```

**Steps:**
1. Optional backup (prompts user)
2. Apply schema (drops and recreates all tables)
3. Normalize all data
4. Generate SQL
5. Import to database
6. Verify counts

**Notes:**
- Deletes ALL existing data
- Multiple confirmation prompts
- Optional backup step
- Use for schema changes or data corruption recovery

## NPM Scripts

Quick reference for all pipeline commands:

```bash
npm run pipeline:normalize      # Run normalization only
npm run pipeline:generate-sql   # Run SQL generation only
npm run pipeline:sync           # Sync new season (full pipeline)
npm run pipeline:rebuild        # Rebuild database from scratch
```

## Data Structure

Expected directory structure:

```
data/
├── 2017-2018/
│   ├── Sporta/
│   │   ├── results_men.json
│   │   └── results_women.json
│   └── Tautas/
│       ├── results_men.json
│       └── results_women.json
├── 2018-2019/
│   └── ...
└── ...
```

Each JSON file contains an array of participants:

```json
[
  {
    "name": "Jānis Bērziņš",
    "link": "https://...",
    "races": [
      {
        "Datums": "2024-01-15",
        "Rezultāts": "45:23",
        "km": "10.0",
        "Vieta": "Rīga"
      }
    ]
  }
]
```

After normalization, participants will have:
- `normalized_name`: Lowercase normalized Latvian name
- `races[].season`: Derived season (e.g., "2023-2024")

## Error Handling

All scripts include error handling:
- Exit on first error (`set -e`)
- Validate file existence
- Verify database operations
- Provide clear error messages

## Development Workflow

### Adding a new season:

1. Scrape new season data (if needed):
   ```bash
   npx tsx scripts/scrape.ts 2026-2027
   ```

2. Sync to database:
   ```bash
   npm run pipeline:sync 2026-2027
   ```

### Fixing data issues:

1. Fix the JSON files in `data/`
2. Re-run normalization and sync:
   ```bash
   npm run pipeline:sync
   ```

### Database schema changes:

1. Update `schema-v2.sql`
2. Rebuild from scratch:
   ```bash
   npm run pipeline:rebuild
   ```

## Testing

Each pipeline script has corresponding test files:
- `2-normalize-data.test.ts`
- `3-generate-sql.test.ts`

Run tests with:
```bash
npm test
```
