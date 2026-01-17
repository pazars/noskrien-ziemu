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
