import { describe, it, expect } from 'vitest';

// Mock the normalizeLatvian function from worker/index.ts
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

describe('Latvian character normalization', () => {
    it('should normalize lowercase Latvian special characters', () => {
        expect(normalizeLatvian('švilpe')).toBe('svilpe');
        expect(normalizeLatvian('bērziņš')).toBe('berzins');
        expect(normalizeLatvian('āboliņš')).toBe('abolins');
    });

    it('should normalize uppercase Latvian special characters', () => {
        // Note: /gi flag matches case-insensitively and replaces with lowercase
        expect(normalizeLatvian('Švilpe')).toBe('svilpe');
        expect(normalizeLatvian('Bērziņš')).toBe('Berzins');
        expect(normalizeLatvian('ĀBOLIŅŠ')).toBe('aBOLIns'); // Ā→a, Ņ→n, Š→s
    });

    it('should normalize mixed case Latvian special characters', () => {
        // /gi matches both cases and replaces with lowercase
        expect(normalizeLatvian('Anete Švilpe')).toBe('Anete svilpe');
        expect(normalizeLatvian('Kristaps BĒRZIŅŠ')).toBe('Kristaps BeRZIns'); // Ē→e, Ņ→n, Š→s
    });

    it('should handle strings without Latvian characters', () => {
        expect(normalizeLatvian('John Smith')).toBe('John Smith');
        expect(normalizeLatvian('test123')).toBe('test123');
    });

    it('should normalize all Latvian special characters', () => {
        const latvianChars = 'āčēģīķļņšūž ĀČĒĢĪĶĻŅŠŪŽ';
        // /gi makes all replacements lowercase
        const expected = 'acegiklnsuz acegiklnsuz';
        expect(normalizeLatvian(latvianChars)).toBe(expected);
    });
});

describe('Case-insensitive search logic', () => {
    it('should match "svilpe" to "Švilpe" after normalization', () => {
        const query = 'svilpe';
        const dbName = 'Anete Švilpe';

        const normalizedQuery = normalizeLatvian(query.toLowerCase());
        const normalizedDbName = normalizeLatvian(dbName.toLowerCase());

        expect(normalizedDbName).toContain(normalizedQuery);
    });

    it('should match "Anete svilpe" to "Anete Švilpe" after normalization', () => {
        const query = 'Anete svilpe';
        const dbName = 'Anete Švilpe';

        const normalizedQuery = normalizeLatvian(query.toLowerCase());
        const normalizedDbName = normalizeLatvian(dbName.toLowerCase());

        expect(normalizedDbName).toBe(normalizedQuery);
    });

    it('should match "berzins" to "Bērziņš" after normalization', () => {
        const query = 'berzins';
        const dbName = 'Kristaps Bērziņš';

        const normalizedQuery = normalizeLatvian(query.toLowerCase());
        const normalizedDbName = normalizeLatvian(dbName.toLowerCase());

        expect(normalizedDbName).toContain(normalizedQuery);
    });

    it('should match partial queries', () => {
        const query = 'berz';
        const dbName = 'Kristaps Bērziņš';

        const normalizedQuery = normalizeLatvian(query.toLowerCase());
        const normalizedDbName = normalizeLatvian(dbName.toLowerCase());

        expect(normalizedDbName).toContain(normalizedQuery);
    });
});

// Helper functions for duplicate merge logic tests
function countLatvianChars(name: string): number {
    const latvianChars = /[āčēģīķļņšūž]/gi;
    return (name.match(latvianChars) || []).length;
}

function hasNaturalCasing(name: string): boolean {
    return /[a-zāčēģīķļņšūž]/.test(name);
}

function selectPreferredName(names: string[]): string {
    const sorted = [...names].sort((a, b) => {
        // Prefer more Latvian characters
        const aLatvianCount = countLatvianChars(a);
        const bLatvianCount = countLatvianChars(b);
        if (aLatvianCount !== bLatvianCount) {
            return bLatvianCount - aLatvianCount;
        }

        // Prefer natural casing
        const aNatural = hasNaturalCasing(a);
        const bNatural = hasNaturalCasing(b);
        if (aNatural !== bNatural) {
            return aNatural ? -1 : 1;
        }

        // Equal priority, maintain order
        return 0;
    });

    return sorted[0];
}

describe('Latvian duplicate merge - name selection logic', () => {
    describe('should prefer names with more Latvian special characters', () => {
        it('Kristaps Bērziņš over Kristaps Berzins', () => {
            const names = ['Kristaps Berzins', 'Kristaps Bērziņš'];
            expect(selectPreferredName(names)).toBe('Kristaps Bērziņš');
        });

        it('Kristaps Bērziņš over Kristaps Bērzins (partial special chars)', () => {
            const names = ['Kristaps Bērzins', 'Kristaps Bērziņš'];
            expect(selectPreferredName(names)).toBe('Kristaps Bērziņš');
        });

        it('Māris Liepiņš over Maris Liepins', () => {
            const names = ['Maris Liepins', 'Māris Liepiņš'];
            expect(selectPreferredName(names)).toBe('Māris Liepiņš');
        });

        it('Ilze Kronberga over Ilze Kronberga (no special chars)', () => {
            // When both have same Latvian char count, should prefer natural casing
            const names = ['ILZE KRONBERGA', 'Ilze Kronberga'];
            expect(selectPreferredName(names)).toBe('Ilze Kronberga');
        });

        it('Jeļena Kopasova over Jelena Kopasova', () => {
            const names = ['Jelena Kopasova', 'Jeļena Kopasova'];
            expect(selectPreferredName(names)).toBe('Jeļena Kopasova');
        });

        it('Mārtiņš Ruttulis over Mārtinš Ruttulis', () => {
            const names = ['Mārtinš Ruttulis', 'Mārtiņš Ruttulis'];
            expect(selectPreferredName(names)).toBe('Mārtiņš Ruttulis');
        });
    });

    describe('should prefer natural casing over all-uppercase when Latvian char count is equal', () => {
        it('Ilze Kronberga over ILZE KRONBERGA', () => {
            const names = ['ILZE KRONBERGA', 'Ilze Kronberga'];
            expect(selectPreferredName(names)).toBe('Ilze Kronberga');
        });

        it('Jānis Bērziņš over JĀNIS BĒRZIŅŠ', () => {
            const names = ['JĀNIS BĒRZIŅŠ', 'Jānis Bērziņš'];
            expect(selectPreferredName(names)).toBe('Jānis Bērziņš');
        });
    });

    describe('should prioritize Latvian chars over natural casing', () => {
        it('KRISTAPS BĒRZIŅŠ over Kristaps Berzins (uppercase with special chars wins)', () => {
            const names = ['Kristaps Berzins', 'KRISTAPS BĒRZIŅŠ'];
            expect(selectPreferredName(names)).toBe('KRISTAPS BĒRZIŅŠ');
        });
    });

    describe('should handle all Latvian special character pairs', () => {
        it('ā vs a', () => {
            expect(selectPreferredName(['Martins', 'Mārtins'])).toBe('Mārtins');
        });

        it('č vs c', () => {
            expect(selectPreferredName(['Cevers', 'Čevers'])).toBe('Čevers');
        });

        it('ē vs e', () => {
            expect(selectPreferredName(['Berzins', 'Bērzins'])).toBe('Bērzins');
        });

        it('ģ vs g', () => {
            expect(selectPreferredName(['Ginters', 'Ģinters'])).toBe('Ģinters');
        });

        it('ī vs i', () => {
            expect(selectPreferredName(['Liepins', 'Līepiņš'])).toBe('Līepiņš');
        });

        it('ķ vs k', () => {
            expect(selectPreferredName(['Kalnins', 'Ķalniņš'])).toBe('Ķalniņš');
        });

        it('ļ vs l', () => {
            expect(selectPreferredName(['Jelena', 'Jeļena'])).toBe('Jeļena');
        });

        it('ņ vs n', () => {
            expect(selectPreferredName(['Berzins', 'Bērziņš'])).toBe('Bērziņš');
        });

        it('š vs s', () => {
            expect(selectPreferredName(['Svilpe', 'Švilpe'])).toBe('Švilpe');
        });

        it('ū vs u', () => {
            expect(selectPreferredName(['Purins', 'Pūriņš'])).toBe('Pūriņš');
        });

        it('ž vs z', () => {
            expect(selectPreferredName(['Zukis', 'Žukis'])).toBe('Žukis');
        });
    });
});

describe('Latvian duplicate merge - grouping logic', () => {
    interface Participant {
        id: number;
        name: string;
        season: string;
        distance: string;
        gender: string;
    }

    function findDuplicateGroups(participants: Participant[]): Map<string, Participant[]> {
        const groups = new Map<string, Participant[]>();

        for (const participant of participants) {
            const normalized = normalizeLatvian(participant.name).toLowerCase();
            // Group across all seasons - same person should have same name everywhere
            const key = `${normalized}|${participant.distance}|${participant.gender}`;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(participant);
        }

        // Filter to only groups with duplicates and different names
        const duplicates = new Map<string, Participant[]>();
        for (const [key, group] of groups.entries()) {
            if (group.length > 1) {
                const uniqueNames = new Set(group.map(p => p.name));
                if (uniqueNames.size > 1) {
                    duplicates.set(key, group);
                }
            }
        }

        return duplicates;
    }

    it('should group participants that differ only by Latvian characters', () => {
        const participants: Participant[] = [
            { id: 1, name: 'Kristaps Berzins', season: '2023-2024', distance: '10km', gender: 'M' },
            { id: 2, name: 'Kristaps Bērziņš', season: '2023-2024', distance: '10km', gender: 'M' },
        ];

        const groups = findDuplicateGroups(participants);
        expect(groups.size).toBe(1);

        const group = Array.from(groups.values())[0];
        expect(group).toHaveLength(2);
        expect(group.map(p => p.name)).toEqual(['Kristaps Berzins', 'Kristaps Bērziņš']);
    });

    it('should NOT group identical names', () => {
        const participants: Participant[] = [
            { id: 1, name: 'Terēze Stālmane', season: '2023-2024', distance: '10km', gender: 'F' },
            { id: 2, name: 'Terēze Stālmane', season: '2023-2024', distance: '10km', gender: 'F' },
        ];

        const groups = findDuplicateGroups(participants);
        expect(groups.size).toBe(0);
    });

    it('should NOT group different people in same season/distance/gender', () => {
        const participants: Participant[] = [
            { id: 1, name: 'Kristaps Bērziņš', season: '2023-2024', distance: '10km', gender: 'M' },
            { id: 2, name: 'Jānis Bērziņš', season: '2023-2024', distance: '10km', gender: 'M' },
        ];

        const groups = findDuplicateGroups(participants);
        expect(groups.size).toBe(0);
    });

    it('should group same person across different seasons with different name variants', () => {
        const participants: Participant[] = [
            { id: 1, name: 'Kristaps Berzins', season: '2023-2024', distance: '10km', gender: 'M' },
            { id: 2, name: 'Kristaps Bērziņš', season: '2024-2025', distance: '10km', gender: 'M' },
        ];

        const groups = findDuplicateGroups(participants);
        expect(groups.size).toBe(1);

        const group = Array.from(groups.values())[0];
        expect(group).toHaveLength(2);
        expect(group.map(p => p.name)).toEqual(['Kristaps Berzins', 'Kristaps Bērziņš']);
    });

    it('should NOT group same person across different distances', () => {
        const participants: Participant[] = [
            { id: 1, name: 'Kristaps Berzins', season: '2023-2024', distance: '10km', gender: 'M' },
            { id: 2, name: 'Kristaps Bērziņš', season: '2023-2024', distance: '21km', gender: 'M' },
        ];

        const groups = findDuplicateGroups(participants);
        expect(groups.size).toBe(0);
    });

    it('should NOT group same person across different genders (edge case)', () => {
        const participants: Participant[] = [
            { id: 1, name: 'Andris Bērziņš', season: '2023-2024', distance: '10km', gender: 'M' },
            { id: 2, name: 'Andris Bērziņš', season: '2023-2024', distance: '10km', gender: 'F' },
        ];

        const groups = findDuplicateGroups(participants);
        expect(groups.size).toBe(0);
    });

    it('should handle multiple duplicates for the same person', () => {
        const participants: Participant[] = [
            { id: 1, name: 'Kristaps Berzins', season: '2023-2024', distance: '10km', gender: 'M' },
            { id: 2, name: 'Kristaps Bērziņš', season: '2023-2024', distance: '10km', gender: 'M' },
            { id: 3, name: 'KRISTAPS BERZINS', season: '2023-2024', distance: '10km', gender: 'M' },
        ];

        const groups = findDuplicateGroups(participants);
        expect(groups.size).toBe(1);

        const group = Array.from(groups.values())[0];
        expect(group).toHaveLength(3);
    });

    it('should handle multiple different duplicate groups', () => {
        const participants: Participant[] = [
            { id: 1, name: 'Kristaps Berzins', season: '2023-2024', distance: '10km', gender: 'M' },
            { id: 2, name: 'Kristaps Bērziņš', season: '2023-2024', distance: '10km', gender: 'M' },
            { id: 3, name: 'Ilze Kronberga', season: '2023-2024', distance: '10km', gender: 'F' },
            { id: 4, name: 'ILZE KRONBERGA', season: '2023-2024', distance: '10km', gender: 'F' },
        ];

        const groups = findDuplicateGroups(participants);
        expect(groups.size).toBe(2);
    });
});
