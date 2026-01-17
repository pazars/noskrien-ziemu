import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Normalize Latvian characters for comparison
function normalizeLatvian(text: string): string {
    return text
        .replace(/ā/gi, 'a')
        .replace(/č/gi, 'c')
        .replace(/ē/gi, 'e')
        .replace(/ģ/gi, 'g')
        .replace(/ī/gi, 'i')
        .replace(/ķ/gi, 'k')
        .replace(/ļ/gi, 'l')
        .replace(/ņ/gi, 'n')
        .replace(/š/gi, 's')
        .replace(/ū/gi, 'u')
        .replace(/ž/gi, 'z');
}

describe('Duplicate detection logic', () => {
    it('should normalize Latvian characters correctly', () => {
        expect(normalizeLatvian('Rihards Siņicins')).toBe('Rihards Sinicins');
        expect(normalizeLatvian('Mārtiņš Purenkovs')).toBe('Martins Purenkovs');
        expect(normalizeLatvian('Anita Saulīte')).toBe('Anita Saulite');
    });

    it('should detect cross-season duplicates', () => {
        const participants = [
            { name: 'Rihards Sinicins', season: '2017-2018', distance: 'Sporta', gender: 'V' },
            { name: 'Rihards Siņicins', season: '2022-2023', distance: 'Sporta', gender: 'V' },
        ];

        const groups = new Map<string, typeof participants>();

        for (const p of participants) {
            const normalized = normalizeLatvian(p.name).toLowerCase();
            const key = `${normalized}|${p.distance}|${p.gender}`;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(p);
        }

        expect(groups.size).toBe(1);
        const group = Array.from(groups.values())[0];
        expect(group.length).toBe(2);
    });

    it('should NOT group different distances', () => {
        const participants = [
            { name: 'Rihards Sinicins', season: '2017-2018', distance: 'Sporta', gender: 'V' },
            { name: 'Rihards Siņicins', season: '2017-2018', distance: 'Tautas', gender: 'V' },
        ];

        const groups = new Map<string, typeof participants>();

        for (const p of participants) {
            const normalized = normalizeLatvian(p.name).toLowerCase();
            const key = `${normalized}|${p.distance}|${p.gender}`;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(p);
        }

        expect(groups.size).toBe(2);
    });

    it('should identify duplicates from scraped data', () => {
        const DATA_DIR = path.resolve('data');

        if (!fs.existsSync(DATA_DIR)) {
            console.log('No data directory found, skipping test');
            return;
        }

        interface ParticipantRecord {
            name: string;
            season: string;
            distance: string;
            gender: string;
        }

        const participants: ParticipantRecord[] = [];
        const seasons = fs.readdirSync(DATA_DIR).filter(f =>
            fs.statSync(path.join(DATA_DIR, f)).isDirectory()
        );

        for (const season of seasons) {
            const seasonPath = path.join(DATA_DIR, season);
            const distances = fs.readdirSync(seasonPath).filter(f =>
                fs.statSync(path.join(seasonPath, f)).isDirectory()
            );

            for (const distance of distances) {
                const distancePath = path.join(seasonPath, distance);
                const files = fs.readdirSync(distancePath).filter(f => f.endsWith('.json'));

                for (const file of files) {
                    const filePath = path.join(distancePath, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const data = JSON.parse(content);

                    const gender = file.includes('men') ? 'V' : (file.includes('women') ? 'S' : 'U');

                    for (const p of data) {
                        participants.push({
                            name: p.name,
                            season,
                            distance,
                            gender,
                        });
                    }
                }
            }
        }

        expect(participants.length).toBeGreaterThan(0);

        // Group and find duplicates
        const groups = new Map<string, ParticipantRecord[]>();

        for (const p of participants) {
            const normalized = normalizeLatvian(p.name).toLowerCase();
            const key = `${normalized}|${p.distance}|${p.gender}`;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(p);
        }

        const duplicates = new Map<string, ParticipantRecord[]>();

        for (const [key, group] of groups.entries()) {
            if (group.length > 1) {
                const uniqueNames = new Set(group.map(p => p.name));
                if (uniqueNames.size > 1) {
                    duplicates.set(key, group);
                }
            }
        }

        // We expect some duplicates from scraped data
        expect(duplicates.size).toBeGreaterThan(0);
        console.log(`Found ${duplicates.size} duplicate groups in scraped data`);
    });
});
