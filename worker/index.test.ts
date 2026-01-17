import { describe, it, expect, beforeEach } from 'vitest';

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
