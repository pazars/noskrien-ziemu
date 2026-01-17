import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateSQL, escapeSQLString } from './3-generate-sql';

describe('SQL Generation', () => {
  const testDataDir = path.resolve('test-data-sql-temp');
  const outputFile = path.resolve('test-output.sql');

  beforeEach(() => {
    // Create test data structure
    fs.mkdirSync(`${testDataDir}/2023-2024/Tautas`, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
  });

  describe('escapeSQLString', () => {
    it('should escape single apostrophes', () => {
      expect(escapeSQLString("O'Brien")).toBe("O''Brien");
    });

    it('should escape multiple apostrophes', () => {
      expect(escapeSQLString("It's John's book")).toBe("It''s John''s book");
    });

    it('should handle strings without apostrophes', () => {
      expect(escapeSQLString("Normal text")).toBe("Normal text");
    });

    it('should handle empty strings', () => {
      expect(escapeSQLString("")).toBe("");
    });
  });

  describe('generateSQL', () => {
    it('should generate UPSERT for participants', () => {
      const testFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const participants = [
        {
          name: 'Dāvis Pazars',
          link: 'http://example.com/1',
          normalized_name: 'davis pazars',
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

      // Should contain participant UPSERT
      expect(sql).toContain("INSERT INTO participants (name, distance, gender, normalized_name)");
      expect(sql).toContain("VALUES ('Dāvis Pazars', 'Tautas', 'V', 'davis pazars')");
      expect(sql).toContain("ON CONFLICT(normalized_name, distance, gender)");
      expect(sql).toContain("DO UPDATE SET name = excluded.name");
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

      // Should use SELECT with NOT EXISTS
      expect(sql).toContain("INSERT INTO races (participant_id, date, result, km, location, season)");
      expect(sql).toContain("SELECT p.id, '2023-11-26', '41:02', '10,5', 'Smiltene', '2023-2024'");
      expect(sql).toContain("FROM participants p");
      expect(sql).toContain("WHERE p.normalized_name = 'test runner'");
      expect(sql).toContain("AND p.distance = 'Tautas'");
      expect(sql).toContain("AND p.gender = 'V'");
      expect(sql).toContain("AND NOT EXISTS (");
      expect(sql).toContain("SELECT 1 FROM races r");
      expect(sql).toContain("WHERE r.participant_id = p.id");
      expect(sql).toContain("AND r.date = '2023-11-26'");
      expect(sql).toContain("AND r.location = 'Smiltene'");
    });

    it('should escape apostrophes in names and locations', () => {
      const testFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const participants = [
        {
          name: "O'Brien Patrick",
          link: 'http://example.com/1',
          normalized_name: 'obrien patrick',
          races: [
            {
              Datums: '2023-11-26',
              Rezultāts: '41:02',
              km: '10,5',
              Vieta: "St. Peter's Park",
              season: '2023-2024'
            }
          ]
        }
      ];
      fs.writeFileSync(testFile, JSON.stringify(participants, null, 2));

      generateSQL(testDataDir, outputFile);

      const sql = fs.readFileSync(outputFile, 'utf-8');

      // Should have escaped apostrophes
      expect(sql).toContain("O''Brien Patrick");
      expect(sql).toContain("St. Peter''s Park");
    });

    it('should handle multiple participants and races', () => {
      const testFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const participants = [
        {
          name: 'First Runner',
          link: 'http://example.com/1',
          normalized_name: 'first runner',
          races: [
            {
              Datums: '2023-11-26',
              Rezultāts: '41:02',
              km: '10,5',
              Vieta: 'Smiltene',
              season: '2023-2024'
            },
            {
              Datums: '2023-12-10',
              Rezultāts: '42:15',
              km: '10,5',
              Vieta: 'Cēsis',
              season: '2023-2024'
            }
          ]
        },
        {
          name: 'Second Runner',
          link: 'http://example.com/2',
          normalized_name: 'second runner',
          races: [
            {
              Datums: '2023-11-26',
              Rezultāts: '45:30',
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

      // Should have 2 participant inserts and 3 race inserts
      const participantMatches = sql.match(/INSERT INTO participants/g);
      const raceMatches = sql.match(/INSERT INTO races/g);

      expect(participantMatches).toHaveLength(2);
      expect(raceMatches).toHaveLength(3);
    });

    it('should handle both men and women files', () => {
      const menFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const womenFile = `${testDataDir}/2023-2024/Tautas/results_women.json`;

      const menParticipants = [
        {
          name: 'Male Runner',
          link: 'http://example.com/1',
          normalized_name: 'male runner',
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

      const womenParticipants = [
        {
          name: 'Female Runner',
          link: 'http://example.com/2',
          normalized_name: 'female runner',
          races: [
            {
              Datums: '2023-11-26',
              Rezultāts: '45:30',
              km: '10,5',
              Vieta: 'Smiltene',
              season: '2023-2024'
            }
          ]
        }
      ];

      fs.writeFileSync(menFile, JSON.stringify(menParticipants, null, 2));
      fs.writeFileSync(womenFile, JSON.stringify(womenParticipants, null, 2));

      generateSQL(testDataDir, outputFile);

      const sql = fs.readFileSync(outputFile, 'utf-8');

      // Should have gender 'V' for men and 'S' for women
      expect(sql).toContain("'Male Runner', 'Tautas', 'V'");
      expect(sql).toContain("'Female Runner', 'Tautas', 'S'");
    });

    it('should handle multiple seasons and distances', () => {
      fs.mkdirSync(`${testDataDir}/2024-2025/Sporta`, { recursive: true });

      const file1 = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const file2 = `${testDataDir}/2024-2025/Sporta/results_women.json`;

      const participants1 = [
        {
          name: 'Tautas Runner',
          link: 'http://example.com/1',
          normalized_name: 'tautas runner',
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

      const participants2 = [
        {
          name: 'Sporta Runner',
          link: 'http://example.com/2',
          normalized_name: 'sporta runner',
          races: [
            {
              Datums: '2024-12-01',
              Rezultāts: '35:20',
              km: '8,0',
              Vieta: 'Rīga',
              season: '2024-2025'
            }
          ]
        }
      ];

      fs.writeFileSync(file1, JSON.stringify(participants1, null, 2));
      fs.writeFileSync(file2, JSON.stringify(participants2, null, 2));

      generateSQL(testDataDir, outputFile);

      const sql = fs.readFileSync(outputFile, 'utf-8');

      // Should have both distances
      expect(sql).toContain("'Tautas Runner', 'Tautas', 'V'");
      expect(sql).toContain("'Sporta Runner', 'Sporta', 'S'");

      // Should have both seasons in race data
      expect(sql).toContain("'2023-2024'");
      expect(sql).toContain("'2024-2025'");
    });

    it('should generate idempotent SQL that can be run multiple times', () => {
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

      // UPSERT pattern makes it safe to run multiple times
      expect(sql).toContain("ON CONFLICT(normalized_name, distance, gender)");
      expect(sql).toContain("DO UPDATE SET");

      // NOT EXISTS pattern prevents duplicate races
      expect(sql).toContain("AND NOT EXISTS");
    });
  });
});
