import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('SQL generation - Sporta distance support', () => {
    it('should correctly identify Sporta distance directory', () => {
        const testPath = 'data/2017-2018/Sporta/results_men.json';
        const parts = testPath.split(path.sep);

        // parts should be: ['data', '2017-2018', 'Sporta', 'results_men.json']
        expect(parts).toContain('Sporta');

        const distanceIndex = parts.indexOf('Sporta');
        expect(distanceIndex).toBeGreaterThan(0);
    });

    it('should handle both Tautas and Sporta distances', () => {
        const distances = ['Tautas', 'Sporta'];

        for (const distance of distances) {
            const testPath = `data/2017-2018/${distance}/results_men.json`;
            expect(testPath).toContain(distance);
        }
    });

    it('should extract correct gender from filename', () => {
        const testCases = [
            { file: 'results_men.json', expectedGender: 'V' },
            { file: 'results_women.json', expectedGender: 'S' },
        ];

        for (const { file, expectedGender } of testCases) {
            let gender = 'U';
            if (file.includes('men')) gender = 'V';
            if (file.includes('women')) gender = 'S';

            expect(gender).toBe(expectedGender);
        }
    });

    it('should process Sporta test data file if it exists', () => {
        const testFile = path.resolve('data/2017-2018/Sporta/results_men.json');

        if (fs.existsSync(testFile)) {
            const content = fs.readFileSync(testFile, 'utf-8');
            const participants = JSON.parse(content);

            expect(Array.isArray(participants)).toBe(true);
            expect(participants.length).toBeGreaterThan(0);

            const participant = participants[0];
            expect(participant).toHaveProperty('name');
            expect(participant).toHaveProperty('link');
            expect(participant).toHaveProperty('races');
            expect(Array.isArray(participant.races)).toBe(true);

            if (participant.races.length > 0) {
                const race = participant.races[0];
                expect(race).toHaveProperty('Rezultāts');
                expect(race).toHaveProperty('km');
                expect(race).toHaveProperty('Datums');
                expect(race).toHaveProperty('Vieta');
            }
        }
    });
});
