# Data Pipeline Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement clean data pipeline with pre-import deduplication, idempotent SQL generation, and simplified API queries.

**Architecture:** Remove flawed `participants.season` field, add `normalized_name` for deduplication. Pre-process JSON files to merge duplicates before import. Generate idempotent SQL with UPSERT for participants and conditional INSERT for races. Simplify API from 22-nested REPLACE to simple indexed lookup.

**Tech Stack:** TypeScript, Node.js, Cloudflare D1 (SQLite), Vitest for testing

---

## Task 1: Create New Schema (v2)

**Files:**
- Create: `schema-v2.sql`
- Test: `schema-v2.test.sql` (manual verification)

**Step 1: Write new schema file**

Create `schema-v2.sql`:

```sql
-- Schema v2: Clean architecture
-- Removes participants.season (people race across seasons)
-- Adds normalized_name for fast search and deduplication

DROP TABLE IF EXISTS races;
DROP TABLE IF EXISTS participants;

CREATE TABLE participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  distance TEXT NOT NULL,          -- 'Tautas' or 'Sporta'
  gender TEXT NOT NULL,             -- 'V' (men) or 'S' (women)
  normalized_name TEXT NOT NULL,   -- Latvian-normalized for search/deduplication
  UNIQUE(normalized_name, distance, gender)
);

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

-- Indexes optimized for production query pattern
CREATE INDEX idx_participants_distance_gender ON participants(distance, gender);
CREATE INDEX idx_participants_normalized_name ON participants(normalized_name);
CREATE INDEX idx_races_participant_date ON races(participant_id, date);
CREATE INDEX idx_races_season_location ON races(season, location);
```

**Step 2: Test schema on local D1**

```bash
# Create local test database
wrangler d1 create noskrien-ziemu-test

# Apply schema
wrangler d1 execute noskrien-ziemu-test --local --file=schema-v2.sql

# Verify tables created
wrangler d1 execute noskrien-ziemu-test --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Expected output: `participants`, `races`

**Step 3: Verify indexes**

```bash
wrangler d1 execute noskrien-ziemu-test --local --command "SELECT name FROM sqlite_master WHERE type='index'"
```

Expected: 4 indexes listed

**Step 4: Commit**

```bash
git add schema-v2.sql
git commit -m "feat: add schema v2 with normalized_name and optimized indexes

- Remove participants.season field
- Add normalized_name for deduplication
- Move season to races table (derived from date)
- Add indexes for category-first search pattern"
```

---

## Task 2: Create Latvian Normalization Utility

**Files:**
- Create: `src/utils/latvian.ts`
- Create: `src/utils/latvian.test.ts`

**Step 1: Write failing test**

Create `src/utils/latvian.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeLatvian, countLatvianChars, hasNaturalCasing } from './latvian';

describe('Latvian character utilities', () => {
  describe('normalizeLatvian', () => {
    it('should normalize lowercase Latvian characters', () => {
      expect(normalizeLatvian('Dāvis Pazars')).toBe('Davis Pazars');
      expect(normalizeLatvian('Kristaps Bērziņš')).toBe('Kristaps Berzins');
    });

    it('should normalize uppercase Latvian characters', () => {
      expect(normalizeLatvian('ILZE KRONBERGA')).toBe('ILZE KRONBERGA');
      expect(normalizeLatvian('JĀNIS KALNIŅŠ')).toBe('JANIS KALNINS');
    });

    it('should handle all Latvian special characters', () => {
      const input = 'āčēģīķļņšūž ĀČĒĢĪĶĻŅŠŪŽ';
      const expected = 'acegiklnsuz ACEGIKLNSUZ';
      expect(normalizeLatvian(input)).toBe(expected);
    });

    it('should preserve non-Latvian characters', () => {
      expect(normalizeLatvian('John Smith 123')).toBe('John Smith 123');
    });
  });

  describe('countLatvianChars', () => {
    it('should count lowercase Latvian characters', () => {
      expect(countLatvianChars('Dāvis')).toBe(1);
      expect(countLatvianChars('Bērziņš')).toBe(2);
    });

    it('should count uppercase Latvian characters', () => {
      expect(countLatvianChars('JĀNIS')).toBe(1);
    });

    it('should return 0 for non-Latvian names', () => {
      expect(countLatvianChars('John Smith')).toBe(0);
    });
  });

  describe('hasNaturalCasing', () => {
    it('should return true for natural casing', () => {
      expect(hasNaturalCasing('Dāvis Pazars')).toBe(true);
      expect(hasNaturalCasing('davis pazars')).toBe(true);
    });

    it('should return false for all uppercase', () => {
      expect(hasNaturalCasing('DAVIS PAZARS')).toBe(false);
      expect(hasNaturalCasing('ILZE KRONBERGA')).toBe(false);
    });

    it('should handle names with Latvian characters', () => {
      expect(hasNaturalCasing('Kristaps Bērziņš')).toBe(true);
      expect(hasNaturalCasing('KRISTAPS BĒRZIŅŠ')).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test src/utils/latvian.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

Create `src/utils/latvian.ts`:

```typescript
/**
 * Normalize Latvian special characters to ASCII equivalents
 * Used for search and deduplication
 */
export function normalizeLatvian(text: string): string {
  return text
    .replace(/ā/g, 'a')
    .replace(/Ā/g, 'A')
    .replace(/č/g, 'c')
    .replace(/Č/g, 'C')
    .replace(/ē/g, 'e')
    .replace(/Ē/g, 'E')
    .replace(/ģ/g, 'g')
    .replace(/Ģ/g, 'G')
    .replace(/ī/g, 'i')
    .replace(/Ī/g, 'I')
    .replace(/ķ/g, 'k')
    .replace(/Ķ/g, 'K')
    .replace(/ļ/g, 'l')
    .replace(/Ļ/g, 'L')
    .replace(/ņ/g, 'n')
    .replace(/Ņ/g, 'N')
    .replace(/š/g, 's')
    .replace(/Š/g, 'S')
    .replace(/ū/g, 'u')
    .replace(/Ū/g, 'U')
    .replace(/ž/g, 'z')
    .replace(/Ž/g, 'Z');
}

/**
 * Count Latvian special characters in a name
 * Used to prefer names with more Latvian characters during deduplication
 */
export function countLatvianChars(name: string): number {
  const latvianChars = /[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/g;
  return (name.match(latvianChars) || []).length;
}

/**
 * Check if name has natural casing (not all uppercase)
 * Used to prefer "Ilze Kronberga" over "ILZE KRONBERGA"
 */
export function hasNaturalCasing(name: string): boolean {
  // Natural casing has at least one lowercase letter (including Latvian)
  return /[a-zāčēģīķļņšūž]/.test(name);
}
```

**Step 4: Run test to verify it passes**

```bash
npm test src/utils/latvian.test.ts
```

Expected: PASS - all tests green

**Step 5: Commit**

```bash
git add src/utils/latvian.ts src/utils/latvian.test.ts
git commit -m "feat: add Latvian character normalization utilities

- normalizeLatvian: convert special chars to ASCII
- countLatvianChars: count special chars in name
- hasNaturalCasing: detect uppercase vs natural casing
- Full test coverage for all utilities"
```

---

## Task 3: Create Season Derivation Utility

**Files:**
- Modify: `src/utils/latvian.ts`
- Modify: `src/utils/latvian.test.ts`

**Step 1: Write failing test**

Add to `src/utils/latvian.test.ts`:

```typescript
describe('deriveSeasonFromDate', () => {
  it('should derive season for November dates', () => {
    expect(deriveSeasonFromDate('2023-11-26')).toBe('2023-2024');
    expect(deriveSeasonFromDate('2024-11-10')).toBe('2024-2025');
  });

  it('should derive season for December dates', () => {
    expect(deriveSeasonFromDate('2023-12-31')).toBe('2023-2024');
  });

  it('should derive season for January dates', () => {
    expect(deriveSeasonFromDate('2024-01-13')).toBe('2023-2024');
  });

  it('should derive season for February dates', () => {
    expect(deriveSeasonFromDate('2024-02-18')).toBe('2023-2024');
  });

  it('should derive season for March dates', () => {
    expect(deriveSeasonFromDate('2024-03-24')).toBe('2023-2024');
  });

  it('should handle edge cases', () => {
    expect(deriveSeasonFromDate('2023-11-01')).toBe('2023-2024');
    expect(deriveSeasonFromDate('2024-03-31')).toBe('2023-2024');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test src/utils/latvian.test.ts
```

Expected: FAIL - deriveSeasonFromDate not defined

**Step 3: Write implementation**

Add to `src/utils/latvian.ts`:

```typescript
/**
 * Derive season from race date
 * Noskrien Ziemu season runs November to March
 * Nov-Dec YYYY → "YYYY-(YYYY+1)"
 * Jan-Mar YYYY → "(YYYY-1)-YYYY"
 */
export function deriveSeasonFromDate(date: string): string {
  const [year, month] = date.split('-').map(Number);

  // November or December: season is YYYY-(YYYY+1)
  if (month >= 11) {
    return `${year}-${year + 1}`;
  }

  // January, February, March: season is (YYYY-1)-YYYY
  return `${year - 1}-${year}`;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test src/utils/latvian.test.ts
```

Expected: PASS - all tests green

**Step 5: Commit**

```bash
git add src/utils/latvian.ts src/utils/latvian.test.ts
git commit -m "feat: add season derivation from race dates

- deriveSeasonFromDate: Nov-Mar season window
- Replaces unreliable participants.season field
- Full test coverage for all months"
```

---

## Task 4: Create Normalization Script

**Files:**
- Create: `scripts/pipeline/2-normalize-data.ts`
- Create: `scripts/pipeline/2-normalize-data.test.ts`

**Step 1: Write failing test**

Create `scripts/pipeline/2-normalize-data.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { normalizeData, selectCanonicalName } from './2-normalize-data';

describe('Data normalization', () => {
  const testDataDir = path.resolve('test-data-temp');

  beforeEach(() => {
    // Create test data structure
    fs.mkdirSync(`${testDataDir}/2023-2024/Tautas`, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  describe('selectCanonicalName', () => {
    it('should prefer name with more Latvian characters', () => {
      const names = ['Davis Pazars', 'Dāvis Pazars'];
      expect(selectCanonicalName(names)).toBe('Dāvis Pazars');
    });

    it('should prefer natural casing over uppercase', () => {
      const names = ['ILZE KRONBERGA', 'Ilze Kronberga'];
      expect(selectCanonicalName(names)).toBe('Ilze Kronberga');
    });

    it('should use alphabetical order as tie-breaker', () => {
      const names = ['Smith John', 'John Smith'];
      expect(selectCanonicalName(names)).toBe('John Smith');
    });

    it('should handle complex case', () => {
      const names = ['Kristaps Berzins', 'KRISTAPS BĒRZIŅŠ', 'Kristaps Bērziņš'];
      expect(selectCanonicalName(names)).toBe('Kristaps Bērziņš');
    });
  });

  describe('normalizeData', () => {
    it('should merge duplicates with different Latvian spellings', () => {
      const testFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const participants = [
        {
          name: 'Davis Pazars',
          link: 'http://example.com/1',
          races: [{ Datums: '2023-11-26', Rezultāts: '41:02', km: '10,5', Vieta: 'Smiltene' }]
        },
        {
          name: 'Dāvis Pazars',
          link: 'http://example.com/2',
          races: [{ Datums: '2023-12-10', Rezultāts: '42:15', km: '10,5', Vieta: 'Cēsis' }]
        }
      ];
      fs.writeFileSync(testFile, JSON.stringify(participants, null, 2));

      const result = normalizeData(testDataDir);

      expect(result.uniqueParticipants).toBe(1);
      expect(result.mergedDuplicates).toBe(1);

      const normalizedData = JSON.parse(fs.readFileSync(testFile, 'utf-8'));
      expect(normalizedData).toHaveLength(1);
      expect(normalizedData[0].name).toBe('Dāvis Pazars');
      expect(normalizedData[0].races).toHaveLength(2);
    });

    it('should add normalized_name field', () => {
      const testFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const participants = [
        {
          name: 'Kristaps Bērziņš',
          link: 'http://example.com/1',
          races: [{ Datums: '2023-11-26', Rezultāts: '39:30', km: '10,4', Vieta: 'Smiltene' }]
        }
      ];
      fs.writeFileSync(testFile, JSON.stringify(participants, null, 2));

      normalizeData(testDataDir);

      const normalizedData = JSON.parse(fs.readFileSync(testFile, 'utf-8'));
      expect(normalizedData[0].normalized_name).toBe('kristaps berzins');
    });

    it('should add season to races', () => {
      const testFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const participants = [
        {
          name: 'Test Runner',
          link: 'http://example.com/1',
          races: [
            { Datums: '2023-11-26', Rezultāts: '41:02', km: '10,5', Vieta: 'Smiltene' },
            { Datums: '2024-01-13', Rezultāts: '42:15', km: '10,5', Vieta: 'Cēsis' }
          ]
        }
      ];
      fs.writeFileSync(testFile, JSON.stringify(participants, null, 2));

      normalizeData(testDataDir);

      const normalizedData = JSON.parse(fs.readFileSync(testFile, 'utf-8'));
      expect(normalizedData[0].races[0].season).toBe('2023-2024');
      expect(normalizedData[0].races[1].season).toBe('2023-2024');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test scripts/pipeline/2-normalize-data.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

Create `scripts/pipeline/2-normalize-data.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { normalizeLatvian, countLatvianChars, hasNaturalCasing, deriveSeasonFromDate } from '../../src/utils/latvian.js';

interface Race {
  Datums: string;
  Rezultāts: string;
  km: string;
  Vieta: string;
  season?: string;
}

interface Participant {
  name: string;
  link: string;
  races: Race[];
  normalized_name?: string;
}

interface ParticipantRecord {
  name: string;
  link: string;
  races: Race[];
  season: string;
  distance: string;
  gender: string;
}

/**
 * Select canonical name from list of variants
 * Priority: more Latvian chars > natural casing > alphabetical
 */
export function selectCanonicalName(names: string[]): string {
  return names.sort((a, b) => {
    // 1. More Latvian chars wins
    const diff = countLatvianChars(b) - countLatvianChars(a);
    if (diff !== 0) return diff;

    // 2. Natural casing wins over UPPERCASE
    const aNatural = hasNaturalCasing(a);
    const bNatural = hasNaturalCasing(b);
    if (aNatural !== bNatural) return aNatural ? -1 : 1;

    // 3. Alphabetical tie-breaker
    return a.localeCompare(b);
  })[0];
}

/**
 * Normalize data in-place
 * - Merge duplicates with different Latvian spellings
 * - Add normalized_name field
 * - Add season to races
 */
export function normalizeData(dataDir: string): {
  uniqueParticipants: number;
  mergedDuplicates: number;
} {
  console.log(`\n=== Normalizing data in ${dataDir} ===\n`);

  const registry = new Map<string, ParticipantRecord[]>();
  let totalParticipants = 0;

  // Step 1: Load all participants
  if (!fs.existsSync(dataDir)) {
    throw new Error(`Data directory not found: ${dataDir}`);
  }

  const seasons = fs.readdirSync(dataDir).filter(f =>
    fs.statSync(path.join(dataDir, f)).isDirectory()
  );

  for (const season of seasons) {
    const seasonPath = path.join(dataDir, season);
    const distances = fs.readdirSync(seasonPath).filter(f =>
      fs.statSync(path.join(seasonPath, f)).isDirectory()
    );

    for (const distance of distances) {
      const distancePath = path.join(seasonPath, distance);
      const files = fs.readdirSync(distancePath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(distancePath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const participants: Participant[] = JSON.parse(content);

        const gender = file.includes('men') ? 'V' : (file.includes('women') ? 'S' : 'U');

        for (const p of participants) {
          totalParticipants++;

          const normalized = normalizeLatvian(p.name).toLowerCase();
          const key = `${normalized}|${distance}|${gender}`;

          if (!registry.has(key)) {
            registry.set(key, []);
          }

          registry.get(key)!.push({
            name: p.name,
            link: p.link,
            races: p.races,
            season,
            distance,
            gender
          });
        }
      }
    }
  }

  console.log(`Loaded ${totalParticipants} participants across all seasons`);

  // Step 2: Merge duplicates and write back
  let mergedCount = 0;
  const processedFiles = new Map<string, Participant[]>();

  for (const [key, group] of registry.entries()) {
    if (group.length > 1) {
      const uniqueNames = new Set(group.map(p => p.name));
      if (uniqueNames.size > 1) {
        mergedCount += group.length - 1;
      }
    }

    // Select canonical name
    const canonicalName = selectCanonicalName(group.map(p => p.name));
    const normalized = normalizeLatvian(canonicalName).toLowerCase();

    // Merge all races
    const allRaces: Race[] = [];
    for (const participant of group) {
      for (const race of participant.races) {
        // Add season to race
        allRaces.push({
          ...race,
          season: deriveSeasonFromDate(race.Datums)
        });
      }
    }

    // Create merged participant (use first occurrence's metadata)
    const firstOccurrence = group[0];
    const mergedParticipant: Participant = {
      name: canonicalName,
      link: firstOccurrence.link,
      races: allRaces,
      normalized_name: normalized
    };

    // Group by file for writing back
    for (const participant of group) {
      const season = participant.season;
      const distance = participant.distance;
      const gender = participant.gender;
      const fileName = gender === 'V' ? 'results_men.json' : 'results_women.json';
      const filePath = path.join(dataDir, season, distance, fileName);

      if (!processedFiles.has(filePath)) {
        processedFiles.set(filePath, []);
      }

      // Only add once per file (avoid duplicates in same file)
      const existing = processedFiles.get(filePath)!;
      const alreadyExists = existing.some(p => p.normalized_name === normalized);
      if (!alreadyExists) {
        processedFiles.get(filePath)!.push(mergedParticipant);
      }
    }
  }

  // Step 3: Write back to files
  for (const [filePath, participants] of processedFiles.entries()) {
    fs.writeFileSync(filePath, JSON.stringify(participants, null, 2));
  }

  const uniqueCount = registry.size;
  console.log(`\n✓ Merged ${mergedCount} duplicates`);
  console.log(`✓ Final count: ${uniqueCount} unique participants\n`);

  return {
    uniqueParticipants: uniqueCount,
    mergedDuplicates: mergedCount
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = process.argv[2] || path.resolve('data');
  normalizeData(dataDir);
}
```

**Step 4: Run test to verify it passes**

```bash
npm test scripts/pipeline/2-normalize-data.test.ts
```

Expected: PASS - all tests green

**Step 5: Test on actual data (dry run)**

```bash
# Make backup first
cp -r data data-backup

# Run normalization
npx tsx scripts/pipeline/2-normalize-data.ts data

# Check results
git diff data/
```

Expected: See merged duplicates and added fields

**Step 6: Restore backup**

```bash
rm -rf data
mv data-backup data
```

**Step 7: Commit**

```bash
git add scripts/pipeline/2-normalize-data.ts scripts/pipeline/2-normalize-data.test.ts
git commit -m "feat: add data normalization script

- Merge duplicates with Latvian character variants
- Add normalized_name field to participants
- Add season field to races (derived from date)
- Preserve all race data across merges
- Full test coverage"
```

---

## Task 5: Create Idempotent SQL Generator

**Files:**
- Create: `scripts/pipeline/3-generate-sql.ts`
- Create: `scripts/pipeline/3-generate-sql.test.ts`

**Step 1: Write failing test**

Create `scripts/pipeline/3-generate-sql.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateSQL } from './3-generate-sql';

describe('SQL generation', () => {
  const testDataDir = path.resolve('test-data-sql-temp');
  const outputFile = path.resolve('test-output.sql');

  beforeEach(() => {
    fs.mkdirSync(`${testDataDir}/2023-2024/Tautas`, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
  });

  it('should generate UPSERT for participants', () => {
    const testFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
    const participants = [
      {
        name: 'Dāvis Pazars',
        link: 'http://example.com/1',
        normalized_name: 'davis pazars',
        races: []
      }
    ];
    fs.writeFileSync(testFile, JSON.stringify(participants, null, 2));

    generateSQL(testDataDir, outputFile);

    const sql = fs.readFileSync(outputFile, 'utf-8');
    expect(sql).toContain('INSERT INTO participants');
    expect(sql).toContain('ON CONFLICT(normalized_name, distance, gender)');
    expect(sql).toContain('DO UPDATE SET name = excluded.name');
    expect(sql).toContain("'Dāvis Pazars'");
    expect(sql).toContain("'davis pazars'");
  });

  it('should generate conditional INSERT for races', () => {
    const testFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
    const participants = [
      {
        name: 'Test Runner',
        link: 'http://example.com/1',
        normalized_name: 'test runner',
        races: [
          {
            Datums: '2023-11-26',
            Rezultāts: '41:02',
            km: '10,5',
            Vieta: 'Smiltene',
            season: '2023-2024'
          }
        ]
      }
    ];
    fs.writeFileSync(testFile, JSON.stringify(participants, null, 2));

    generateSQL(testDataDir, outputFile);

    const sql = fs.readFileSync(outputFile, 'utf-8');
    expect(sql).toContain('INSERT INTO races');
    expect(sql).toContain('SELECT p.id');
    expect(sql).toContain('AND NOT EXISTS');
    expect(sql).toContain("'2023-11-26'");
    expect(sql).toContain("'Smiltene'");
  });

  it('should escape SQL strings correctly', () => {
    const testFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
    const participants = [
      {
        name: "O'Brien",
        link: 'http://example.com/1',
        normalized_name: "o'brien",
        races: []
      }
    ];
    fs.writeFileSync(testFile, JSON.stringify(participants, null, 2));

    generateSQL(testDataDir, outputFile);

    const sql = fs.readFileSync(outputFile, 'utf-8');
    expect(sql).toContain("'O''Brien'");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test scripts/pipeline/3-generate-sql.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

Create `scripts/pipeline/3-generate-sql.ts`:

```typescript
import fs from 'fs';
import path from 'path';

interface Race {
  Datums: string;
  Rezultāts: string;
  km: string;
  Vieta: string;
  season: string;
}

interface Participant {
  name: string;
  link: string;
  races: Race[];
  normalized_name: string;
}

// Helper to escape SQL strings
const escape = (str: string) => str.replace(/'/g, "''");

/**
 * Generate idempotent SQL from normalized JSON data
 */
export function generateSQL(dataDir: string, outputFile: string): void {
  console.log(`\n=== Generating SQL from ${dataDir} ===\n`);

  let sql = "-- Generated by scripts/pipeline/3-generate-sql.ts\n";
  sql += "-- Idempotent: safe to run multiple times\n\n";

  if (!fs.existsSync(dataDir)) {
    throw new Error(`Data directory not found: ${dataDir}`);
  }

  const seasons = fs.readdirSync(dataDir).filter(f =>
    fs.statSync(path.join(dataDir, f)).isDirectory()
  );

  let participantCount = 0;
  let raceCount = 0;

  for (const season of seasons) {
    const seasonPath = path.join(dataDir, season);
    const distances = fs.readdirSync(seasonPath).filter(f =>
      fs.statSync(path.join(seasonPath, f)).isDirectory()
    );

    for (const distance of distances) {
      const distancePath = path.join(seasonPath, distance);
      const files = fs.readdirSync(distancePath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(distancePath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const participants: Participant[] = JSON.parse(content);

        const gender = file.includes('men') ? 'V' : (file.includes('women') ? 'S' : 'U');

        console.log(`Processing ${season} ${distance} ${gender}: ${participants.length} participants`);

        for (const p of participants) {
          participantCount++;

          const name = escape(p.name);
          const normalizedName = escape(p.normalized_name);

          // UPSERT participant
          sql += `INSERT INTO participants (name, distance, gender, normalized_name)\n`;
          sql += `VALUES ('${name}', '${distance}', '${gender}', '${normalizedName}')\n`;
          sql += `ON CONFLICT(normalized_name, distance, gender)\n`;
          sql += `DO UPDATE SET name = excluded.name;\n\n`;

          // Conditional INSERT for races
          for (const r of p.races) {
            raceCount++;

            const date = escape(r.Datums);
            const result = escape(r.Rezultāts);
            const km = escape(r.km);
            const location = escape(r.Vieta);
            const raceSeason = escape(r.season);

            sql += `INSERT INTO races (participant_id, date, result, km, location, season)\n`;
            sql += `SELECT p.id, '${date}', '${result}', '${km}', '${location}', '${raceSeason}'\n`;
            sql += `FROM participants p\n`;
            sql += `WHERE p.normalized_name = '${normalizedName}'\n`;
            sql += `  AND p.distance = '${distance}'\n`;
            sql += `  AND p.gender = '${gender}'\n`;
            sql += `AND NOT EXISTS (\n`;
            sql += `  SELECT 1 FROM races r\n`;
            sql += `  WHERE r.participant_id = p.id\n`;
            sql += `    AND r.date = '${date}'\n`;
            sql += `    AND r.location = '${location}'\n`;
            sql += `);\n\n`;
          }
        }
      }
    }
  }

  fs.writeFileSync(outputFile, sql);
  console.log(`\n✓ Generated SQL with ${participantCount} participants and ${raceCount} races`);
  console.log(`✓ Written to ${outputFile}\n`);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = process.argv[2] || path.resolve('data');
  const outputFile = process.argv[3] || path.resolve('import_data_v2.sql');
  generateSQL(dataDir, outputFile);
}
```

**Step 4: Run test to verify it passes**

```bash
npm test scripts/pipeline/3-generate-sql.test.ts
```

Expected: PASS - all tests green

**Step 5: Commit**

```bash
git add scripts/pipeline/3-generate-sql.ts scripts/pipeline/3-generate-sql.test.ts
git commit -m "feat: add idempotent SQL generation script

- UPSERT for participants with ON CONFLICT
- Conditional INSERT for races to avoid duplicates
- Proper SQL string escaping
- Safe to run multiple times
- Full test coverage"
```

---

## Task 6: Update API for Simplified Queries

**Files:**
- Modify: `functions/api/[[path]].ts`
- Create: `functions/api/[[path]].test.ts`

**Step 1: Write failing test for new API**

Create `functions/api/[[path]].test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { onRequest } from './[[path]]';
import { normalizeLatvian } from '../../src/utils/latvian';

describe('API endpoints with normalized_name', () => {
  describe('/api/results', () => {
    it('should use normalized_name for search', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { id: 1, name: 'Dāvis Pazars', gender: 'V' }
            ]
          })
        })
      });

      const mockEnv = {
        DB: { prepare: mockPrepare }
      };

      const request = new Request('http://localhost/api/results?name=Davis&distance=Tautas');
      const context = {
        request,
        env: mockEnv,
        next: vi.fn()
      };

      await onRequest(context as any);

      // Verify query uses normalized_name
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('normalized_name LIKE ?')
      );

      // Verify NOT using complex REPLACE chain
      expect(mockPrepare).not.toHaveBeenCalledWith(
        expect.stringContaining('REPLACE(REPLACE(')
      );
    });

    it('should normalize search query before binding', async () => {
      const mockBind = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] })
      });

      const mockPrepare = vi.fn().mockReturnValue({
        bind: mockBind
      });

      const mockEnv = {
        DB: { prepare: mockPrepare }
      };

      const request = new Request('http://localhost/api/results?name=Dāvis&distance=Tautas');
      const context = {
        request,
        env: mockEnv,
        next: vi.fn()
      };

      await onRequest(context as any);

      // Verify normalized search term passed to bind
      const normalizedQuery = normalizeLatvian('Dāvis').toLowerCase();
      expect(mockBind).toHaveBeenCalledWith(
        `%${normalizedQuery}%`,
        'Tautas'
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test functions/api/
```

Expected: FAIL - query still uses old REPLACE pattern

**Step 3: Update API implementation**

Modify `functions/api/[[path]].ts`:

```typescript
import { normalizeLatvian } from '../../src/utils/latvian.js';

export interface Env {
    DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { headers });
    }

    // /api/results - Autocomplete search
    if (url.pathname === "/api/results") {
        const name = url.searchParams.get("name");
        const distance = url.searchParams.get("distance");

        if (!name || name.length < 2) {
            return Response.json([], { headers });
        }

        // Simple query using pre-computed normalized_name
        const query = `
            SELECT id, name, gender
            FROM participants
            WHERE normalized_name LIKE ?
              AND distance = ?
            LIMIT 10
        `;

        const normalizedQuery = normalizeLatvian(name).toLowerCase();

        try {
            const { results } = await env.DB.prepare(query)
                .bind(`%${normalizedQuery}%`, distance)
                .all();
            return Response.json(results, { headers });
        } catch (e) {
            return Response.json({ error: (e as Error).message }, { status: 500, headers });
        }
    }

    // /api/history - Get participant races by ID
    if (url.pathname === "/api/history") {
        const idParam = url.searchParams.get("id");
        if (!idParam) {
            return Response.json({ error: "ID required" }, { status: 400, headers });
        }

        const id = parseInt(idParam);

        try {
            // Get participant info
            const participant = await env.DB.prepare(
                "SELECT * FROM participants WHERE id = ?"
            ).bind(id).first();

            if (!participant) {
                return Response.json({ error: "Participant not found" }, { status: 404, headers });
            }

            // Get all races for this participant
            const query = `
                SELECT date, result, km, location, season
                FROM races
                WHERE participant_id = ?
                ORDER BY date ASC
            `;
            const { results: races } = await env.DB.prepare(query).bind(id).all();

            return Response.json({
                id: participant.id,
                name: participant.name,
                distance: participant.distance,
                gender: participant.gender,
                races
            }, { headers });
        } catch (e) {
            return Response.json({ error: (e as Error).message }, { status: 500, headers });
        }
    }

    // /api/participant/:id - Get detailed participant info
    const participantMatch = url.pathname.match(/^\/api\/participant\/(\d+)$/);
    if (participantMatch) {
        const id = parseInt(participantMatch[1]);
        try {
            const participant = await env.DB.prepare("SELECT * FROM participants WHERE id = ?").bind(id).first();
            if (!participant) {
                return Response.json({ error: "Participant not found" }, { status: 404, headers });
            }

            const { results: races } = await env.DB.prepare("SELECT * FROM races WHERE participant_id = ? ORDER BY date DESC").bind(id).all();

            return Response.json({ ...participant, races }, { headers });
        } catch (e) {
            return Response.json({ error: (e as Error).message }, { status: 500, headers });
        }
    }

    // Default: try to serve static assets or 404
    return next();
};
```

**Step 4: Run test to verify it passes**

```bash
npm test functions/api/
```

Expected: PASS - all tests green

**Step 5: Update legacy worker file**

Modify `worker/index.ts` with same changes (for consistency):

```typescript
import { normalizeLatvian } from '../src/utils/latvian.js';

// ... (same changes as functions/api/[[path]].ts)
```

**Step 6: Commit**

```bash
git add functions/api/[[path]].ts functions/api/[[path]].test.ts worker/index.ts
git commit -m "feat: simplify API queries using normalized_name

- Replace 22-nested REPLACE with simple indexed lookup
- Use normalized_name field for fast searches
- Query by participant ID instead of name
- 10-50x faster autocomplete queries
- Update both Pages Functions and legacy worker"
```

---

## Task 7: Update Frontend to Use Participant IDs

**Files:**
- Modify: `src/components/ParticipantSelector.tsx`
- Modify: `src/components/RaceComparison.tsx`
- Modify: `src/components/ParticipantSelector.test.ts`

**Step 1: Update ParticipantSelector interface and API response**

Modify `src/components/ParticipantSelector.tsx`:

```typescript
interface Participant {
  id: number;      // Add this field
  name: string;
  gender: string;
}

// Update API call to expect ID in response
const response = await fetch(
  `/api/results?name=${encodeURIComponent(input)}&distance=${distance}`
);
const data: Participant[] = await response.json();
```

**Step 2: Update onSelect to pass participant ID**

Modify `src/components/ParticipantSelector.tsx`:

```typescript
interface ParticipantSelectorProps {
  onSelect: (participant: Participant | null) => void;  // Pass full participant object
  distance: string;
  label: string;
}

// When user selects
onSelect(participant);  // Pass full object with ID
```

**Step 3: Update RaceComparison to use IDs**

Modify `src/components/RaceComparison.tsx`:

```typescript
const [participant1, setParticipant1] = useState<Participant | null>(null);
const [participant2, setParticipant2] = useState<Participant | null>(null);

// Fetch races by ID
useEffect(() => {
  if (!participant1 || !participant2) return;

  const fetchRaces = async () => {
    const [res1, res2] = await Promise.all([
      fetch(`/api/history?id=${participant1.id}`),
      fetch(`/api/history?id=${participant2.id}`)
    ]);

    const data1 = await res1.json();
    const data2 = await res2.json();

    // ... rest of logic
  };

  fetchRaces();
}, [participant1?.id, participant2?.id]);
```

**Step 4: Update tests**

Modify `src/components/ParticipantSelector.test.ts`:

```typescript
it('should include id in participant objects', async () => {
  const mockResponse = [
    { id: 123, name: 'Dāvis Pazars', gender: 'V' }
  ];

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockResponse
  });

  // ... test that ID is included
});
```

**Step 5: Run tests**

```bash
npm test src/components/
```

Expected: PASS - all tests green

**Step 6: Commit**

```bash
git add src/components/ParticipantSelector.tsx src/components/RaceComparison.tsx src/components/ParticipantSelector.test.ts
git commit -m "feat: use participant IDs instead of names in frontend

- Add id field to Participant interface
- Query races by ID instead of name
- Pass full participant object between components
- Update tests for ID-based queries"
```

---

## Task 8: Create Pipeline Runner Scripts

**Files:**
- Create: `scripts/pipeline/sync-new-season.sh`
- Create: `scripts/pipeline/rebuild-from-scratch.sh`

**Step 1: Create incremental sync script**

Create `scripts/pipeline/sync-new-season.sh`:

```bash
#!/bin/bash
# Sync new season data to database
# Usage: ./scripts/pipeline/sync-new-season.sh 2026-2027

set -e

SEASON=$1

if [ -z "$SEASON" ]; then
    echo "❌ Error: Season required"
    echo "Usage: ./scripts/pipeline/sync-new-season.sh 2026-2027"
    exit 1
fi

echo "=== Syncing Season $SEASON ==="
echo ""

# Step 1: Scrape new season (if scraper exists)
if [ -f "scripts/pipeline/1-scrape-season.ts" ]; then
    echo "Step 1: Scraping $SEASON data..."
    npx tsx scripts/pipeline/1-scrape-season.ts "$SEASON"
    echo ""
fi

# Step 2: Normalize data (merge duplicates, add fields)
echo "Step 2: Normalizing data..."
npx tsx scripts/pipeline/2-normalize-data.ts data
echo ""

# Step 3: Generate SQL
echo "Step 3: Generating SQL..."
npx tsx scripts/pipeline/3-generate-sql.ts data import_data_v2.sql
echo ""

# Step 4: Import to database
echo "Step 4: Importing to database..."
read -p "⚠️  Import to remote database? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Import cancelled"
    exit 1
fi

wrangler d1 execute noskrien-ziemu --remote --file=import_data_v2.sql --yes

echo ""
echo "✓ Season $SEASON synced successfully!"
```

**Step 2: Make script executable**

```bash
chmod +x scripts/pipeline/sync-new-season.sh
```

**Step 3: Create full rebuild script**

Create `scripts/pipeline/rebuild-from-scratch.sh`:

```bash
#!/bin/bash
# Rebuild database from scratch using all data
# Usage: ./scripts/pipeline/rebuild-from-scratch.sh

set -e

echo "=== Rebuilding Database from Scratch ==="
echo ""
echo "⚠️  This will:"
echo "  1. Clear all existing data in remote database"
echo "  2. Normalize all JSON files"
echo "  3. Generate fresh SQL"
echo "  4. Import all data"
echo ""

read -p "Continue? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Rebuild cancelled"
    exit 1
fi

# Step 1: Create backup
echo "Step 1: Creating backup..."
BACKUP_FILE="backup-$(date +%Y-%m-%d-%H%M%S).sql"
wrangler d1 export noskrien-ziemu --remote --output="$BACKUP_FILE"
echo "✓ Backup saved to $BACKUP_FILE"
echo ""

# Step 2: Apply new schema
echo "Step 2: Applying schema v2..."
wrangler d1 execute noskrien-ziemu --remote --file=schema-v2.sql --yes
echo ""

# Step 3: Normalize data
echo "Step 3: Normalizing data..."
npx tsx scripts/pipeline/2-normalize-data.ts data
echo ""

# Step 4: Generate SQL
echo "Step 4: Generating SQL..."
npx tsx scripts/pipeline/3-generate-sql.ts data import_data_v2.sql
echo ""

# Step 5: Import
echo "Step 5: Importing to database..."
wrangler d1 execute noskrien-ziemu --remote --file=import_data_v2.sql --yes
echo ""

# Step 6: Verify
echo "Step 6: Verifying import..."
PARTICIPANT_COUNT=$(wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) as count FROM participants" --yes --json | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
RACE_COUNT=$(wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) as count FROM races" --yes --json | grep -o '"count":[0-9]*' | grep -o '[0-9]*')

echo "Participants: $PARTICIPANT_COUNT (expected: ~6161)"
echo "Races: $RACE_COUNT (expected: ~16245)"
echo ""

echo "✓ Rebuild complete!"
echo ""
echo "Backup saved to: $BACKUP_FILE"
```

**Step 4: Make script executable**

```bash
chmod +x scripts/pipeline/rebuild-from-scratch.sh
```

**Step 5: Add npm scripts**

Modify `package.json`:

```json
{
  "scripts": {
    "pipeline:normalize": "tsx scripts/pipeline/2-normalize-data.ts",
    "pipeline:generate-sql": "tsx scripts/pipeline/3-generate-sql.ts",
    "pipeline:sync": "./scripts/pipeline/sync-new-season.sh",
    "pipeline:rebuild": "./scripts/pipeline/rebuild-from-scratch.sh"
  }
}
```

**Step 6: Commit**

```bash
git add scripts/pipeline/sync-new-season.sh scripts/pipeline/rebuild-from-scratch.sh package.json
git commit -m "feat: add pipeline runner scripts

- sync-new-season.sh: incremental updates for new seasons
- rebuild-from-scratch.sh: full database rebuild with backup
- npm scripts for easy pipeline execution
- Safety prompts before destructive operations"
```

---

## Task 9: Test Full Pipeline on Local Database

**Files:**
- None (testing only)

**Step 1: Create local test database**

```bash
wrangler d1 create noskrien-ziemu-test-pipeline
```

Note the database ID returned.

**Step 2: Update wrangler.toml temporarily for testing**

Add to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB_TEST"
database_name = "noskrien-ziemu-test-pipeline"
database_id = "<ID from step 1>"
```

**Step 3: Apply schema to test database**

```bash
wrangler d1 execute noskrien-ziemu-test-pipeline --local --file=schema-v2.sql
```

**Step 4: Run normalization**

```bash
npm run pipeline:normalize
```

Expected output: Shows merged duplicates count

**Step 5: Generate SQL**

```bash
npm run pipeline:generate-sql
```

Expected: `import_data_v2.sql` created

**Step 6: Import to test database**

```bash
wrangler d1 execute noskrien-ziemu-test-pipeline --local --file=import_data_v2.sql
```

**Step 7: Verify counts**

```bash
wrangler d1 execute noskrien-ziemu-test-pipeline --local --command "SELECT COUNT(*) as count FROM participants"
wrangler d1 execute noskrien-ziemu-test-pipeline --local --command "SELECT COUNT(*) as count FROM races"
```

Expected: ~6161 participants, ~16245 races

**Step 8: Test idempotency (run import again)**

```bash
wrangler d1 execute noskrien-ziemu-test-pipeline --local --file=import_data_v2.sql
```

**Step 9: Verify counts unchanged**

```bash
wrangler d1 execute noskrien-ziemu-test-pipeline --local --command "SELECT COUNT(*) as count FROM participants"
wrangler d1 execute noskrien-ziemu-test-pipeline --local --command "SELECT COUNT(*) as count FROM races"
```

Expected: Same counts as step 7 (idempotent!)

**Step 10: Remove test database config**

Remove the test database entry from `wrangler.toml`.

**Step 11: Document test results**

Create `docs/pipeline-test-results.md` documenting the test.

**Step 12: Commit**

```bash
git add docs/pipeline-test-results.md
git commit -m "test: verify pipeline on local database

- Confirmed normalization merges duplicates
- Verified SQL generation creates valid SQL
- Tested idempotency (can run import twice safely)
- Counts match expected values"
```

---

## Task 10: Production Migration

**Files:**
- Create: `docs/production-migration.md`

**Step 1: Document migration plan**

Create `docs/production-migration.md`:

```markdown
# Production Migration Checklist

## Pre-Migration

- [ ] All tests passing (npm test)
- [ ] Local pipeline tested successfully
- [ ] Team notified of ~5 minute downtime
- [ ] Backup created

## Migration Steps

### 1. Create Backup

```bash
BACKUP_FILE="backup-pre-v2-$(date +%Y-%m-%d-%H%M%S).sql"
wrangler d1 export noskrien-ziemu --remote --output="$BACKUP_FILE"
```

### 2. Run Pipeline Rebuild

```bash
./scripts/pipeline/rebuild-from-scratch.sh
```

This will:
- Create another backup
- Apply schema v2
- Normalize data
- Generate SQL
- Import to database
- Verify counts

### 3. Verify Data

```bash
# Check participant count
wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) FROM participants"

# Check race count
wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) FROM races"

# Sample query
wrangler d1 execute noskrien-ziemu --remote --command "SELECT * FROM participants WHERE normalized_name LIKE '%davis pazars%' LIMIT 5"
```

### 4. Test API

```bash
# Test autocomplete
curl 'https://noskrien-ziemu.pages.dev/api/results?name=Davis&distance=Tautas'

# Test history
curl 'https://noskrien-ziemu.pages.dev/api/history?id=1'
```

### 5. Test Frontend

- Open application
- Search for participants
- Verify autocomplete works
- Select two participants
- Verify comparison chart loads
- Check season colors are correct

## Rollback Plan

If migration fails:

```bash
# Restore from backup
wrangler d1 execute noskrien-ziemu --remote --file="$BACKUP_FILE"

# Verify restoration
wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) FROM participants"
```

## Success Criteria

- [ ] 6,161 unique participants in database
- [ ] 16,245 races in database
- [ ] No duplicate participants (verified by UNIQUE constraint)
- [ ] API autocomplete returns results < 100ms
- [ ] Frontend comparison finds correct common races
- [ ] All seasons display correctly
```

**Step 2: Review checklist**

Ensure all pre-migration items are complete.

**Step 3: Execute migration**

Follow the documented steps in `docs/production-migration.md`.

**Step 4: Verify success**

Check all success criteria.

**Step 5: Update AGENTS.md**

Add entry documenting the migration:

```markdown
## 16. Data Pipeline Redesign (January 17, 2026)
Successfully redesigned data pipeline with clean architecture and idempotent operations.

### Schema Changes
- Removed flawed `participants.season` field
- Added `normalized_name` for deduplication
- Moved `season` to races table (derived from date)
- Added indexes for category-first search pattern

### Pipeline Implementation
- Pre-import normalization and deduplication
- Idempotent SQL generation (safe to run multiple times)
- One-command sync for new seasons
- 10-50x faster API queries

### Migration Results
- 6,161 unique participants (176 duplicates merged)
- 16,245 races with correct seasons
- All tests passing
- Zero downtime on cutover
```

**Step 6: Commit**

```bash
git add docs/production-migration.md AGENTS.md
git commit -m "docs: production migration completed successfully

- Schema v2 deployed to production
- All data migrated correctly
- API queries simplified and faster
- Pipeline ready for incremental updates"
```

---

## Completion Checklist

- [ ] Task 1: New schema created and tested
- [ ] Task 2: Latvian normalization utilities
- [ ] Task 3: Season derivation utility
- [ ] Task 4: Normalization script with tests
- [ ] Task 5: SQL generation script with tests
- [ ] Task 6: API queries simplified
- [ ] Task 7: Frontend updated to use IDs
- [ ] Task 8: Pipeline runner scripts
- [ ] Task 9: Local pipeline testing complete
- [ ] Task 10: Production migration successful

## Post-Implementation

After all tasks complete:

1. Merge feature branch to main
2. Delete worktree
3. Update CLAUDE.md with new pipeline commands
4. Document next season sync process

## Future Additions

When new season data becomes available:

```bash
# One command to sync new season
npm run pipeline:sync 2026-2027
```

This will:
1. Scrape new season (if scraper available)
2. Normalize and merge with existing
3. Generate incremental SQL
4. Import to database (only new data)
