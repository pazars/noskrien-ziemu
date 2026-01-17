import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Database import preparation', () => {
    it('should have import_data.sql file', () => {
        const sqlFile = path.resolve('import_data.sql');
        expect(fs.existsSync(sqlFile)).toBe(true);
    });

    it('should have correct file size (approximately 3 MB)', () => {
        const sqlFile = path.resolve('import_data.sql');
        const stats = fs.statSync(sqlFile);
        const sizeMB = stats.size / (1024 * 1024);

        expect(sizeMB).toBeGreaterThan(2.5);
        expect(sizeMB).toBeLessThan(4);
    });

    it('should contain both Tautas and Sporta data', () => {
        const sqlFile = path.resolve('import_data.sql');
        const content = fs.readFileSync(sqlFile, 'utf-8');

        expect(content).toContain("'Tautas'");
        expect(content).toContain("'Sporta'");
    });

    it('should have correct number of INSERT statements', () => {
        const sqlFile = path.resolve('import_data.sql');
        const content = fs.readFileSync(sqlFile, 'utf-8');

        const participantInserts = content.match(/INSERT INTO participants/g);
        const raceInserts = content.match(/INSERT INTO races/g);

        expect(participantInserts?.length).toBe(6337);
        expect(raceInserts?.length).toBe(16245);
    });

    it('should have import script executable', () => {
        const scriptPath = path.resolve('scripts/import_to_db.sh');
        expect(fs.existsSync(scriptPath)).toBe(true);

        const stats = fs.statSync(scriptPath);
        // Check if executable bit is set (0o111 = executable by owner/group/others)
        const isExecutable = (stats.mode & 0o100) !== 0;
        expect(isExecutable).toBe(true);
    });

    it('should have both gender codes in data', () => {
        const sqlFile = path.resolve('import_data.sql');
        const content = fs.readFileSync(sqlFile, 'utf-8');

        // V = men (Vīrieši), S = women (Sievietes)
        expect(content).toContain("'V')");
        expect(content).toContain("'S')");
    });

    it('should include data from all seasons', () => {
        const sqlFile = path.resolve('import_data.sql');
        const content = fs.readFileSync(sqlFile, 'utf-8');

        const seasons = [
            '2017-2018',
            '2018-2019',
            '2019-2020',
            '2022-2023',
            '2023-2024',
            '2024-2025',
            '2025-2026',
        ];

        for (const season of seasons) {
            expect(content).toContain(`'${season}'`);
        }
    });
});
