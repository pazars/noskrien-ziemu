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

    it('should keep participants in their original gender files only', () => {
      // Setup: men and women files with distinct participants
      const menFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const womenFile = `${testDataDir}/2023-2024/Tautas/results_women.json`;

      const menParticipants = [
        {
          name: 'Jānis Bērziņš',
          link: 'http://example.com/men/1',
          races: [{ Datums: '2023-11-26', Rezultāts: '35:00', km: '10,5', Vieta: 'Smiltene' }]
        }
      ];
      const womenParticipants = [
        {
          name: 'Anete Švilpe',
          link: 'http://example.com/women/1',
          races: [{ Datums: '2023-11-26', Rezultāts: '45:00', km: '10,5', Vieta: 'Smiltene' }]
        }
      ];

      fs.writeFileSync(menFile, JSON.stringify(menParticipants, null, 2));
      fs.writeFileSync(womenFile, JSON.stringify(womenParticipants, null, 2));

      normalizeData(testDataDir);

      // After normalization, men's file should only have men, women's file only women
      const normalizedMen = JSON.parse(fs.readFileSync(menFile, 'utf-8'));
      const normalizedWomen = JSON.parse(fs.readFileSync(womenFile, 'utf-8'));

      expect(normalizedMen).toHaveLength(1);
      expect(normalizedMen[0].name).toBe('Jānis Bērziņš');

      expect(normalizedWomen).toHaveLength(1);
      expect(normalizedWomen[0].name).toBe('Anete Švilpe');

      // Verify no cross-contamination
      const menNames = normalizedMen.map((p: { normalized_name: string }) => p.normalized_name);
      const womenNames = normalizedWomen.map((p: { normalized_name: string }) => p.normalized_name);

      const overlap = menNames.filter((name: string) => womenNames.includes(name));
      expect(overlap).toHaveLength(0);
    });

    it('should not write women to men files when normalizing corrupted data', () => {
      // This test simulates the bug: a woman appearing in both men's and women's files
      // After normalization, she should ONLY be in the women's file
      const menFile = `${testDataDir}/2023-2024/Tautas/results_men.json`;
      const womenFile = `${testDataDir}/2023-2024/Tautas/results_women.json`;

      // Corrupted state: Anete appears in BOTH files (this is the bug)
      const corruptedMenParticipants = [
        {
          name: 'Jānis Bērziņš',
          link: 'http://example.com/men/1',
          races: [{ Datums: '2023-11-26', Rezultāts: '35:00', km: '10,5', Vieta: 'Smiltene' }]
        },
        {
          name: 'Anete Švilpe', // BUG: woman in men's file
          link: 'http://example.com/women/1',
          races: [{ Datums: '2023-11-26', Rezultāts: '45:00', km: '10,5', Vieta: 'Smiltene' }],
          normalized_name: 'anete svilpe'
        }
      ];
      const womenParticipants = [
        {
          name: 'Anete Švilpe',
          link: 'http://example.com/women/1',
          races: [{ Datums: '2023-12-10', Rezultāts: '44:00', km: '10,5', Vieta: 'Cēsis' }],
          normalized_name: 'anete svilpe'
        }
      ];

      fs.writeFileSync(menFile, JSON.stringify(corruptedMenParticipants, null, 2));
      fs.writeFileSync(womenFile, JSON.stringify(womenParticipants, null, 2));

      normalizeData(testDataDir);

      const normalizedMen = JSON.parse(fs.readFileSync(menFile, 'utf-8'));
      const normalizedWomen = JSON.parse(fs.readFileSync(womenFile, 'utf-8'));

      // Men's file should NOT contain Anete
      const aneteInMen = normalizedMen.find((p: { name: string }) =>
        p.name.toLowerCase().includes('anete')
      );
      expect(aneteInMen).toBeUndefined();

      // Women's file should contain Anete with merged races
      const aneteInWomen = normalizedWomen.find((p: { name: string }) =>
        p.name.toLowerCase().includes('anete')
      );
      expect(aneteInWomen).toBeDefined();
      expect(aneteInWomen.races).toHaveLength(2); // Both races merged
    });
  });
});
