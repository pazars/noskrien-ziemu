
import { describe, it, expect } from 'vitest';
import { compareRaces, type HistoryResponse } from './comparison';

describe('compareRaces', () => {
    it('should find common races for Dāvis Pazars and Kristaps Bērziņš (mock data)', () => {
        const hist1: HistoryResponse = {
            name: 'Dāvis Pazars',
            races: [
                { date: '2023-11-26', result: '52:09', km: '10,0', location: 'Smiltene', season: '2023-2024', category: 'Tautas' },
                { date: '2023-12-17', result: '1:01:59', km: '10,0', location: 'Ļaudona', season: '2023-2024', category: 'Tautas' },
                { date: '2024-01-13', result: '41:13', km: '10,0', location: 'Kuldīga', season: '2023-2024', category: 'Tautas' },
                // Extra race only for Dāvis
                { date: '2025-12-14', result: '38:30', km: '8', location: 'Jaunolaine', season: '2025-2026', category: 'Tautas' }
            ]
        };

        const hist2: HistoryResponse = {
            name: 'Kristaps Bērziņš',
            races: [
                { date: '2023-11-26', result: '41:02', km: '10,0', location: 'Smiltene', season: '2023-2024', category: 'Tautas' },
                { date: '2023-12-17', result: '41:13', km: '10,0', location: 'Ļaudona', season: '2023-2024', category: 'Tautas' },
                { date: '2024-01-13', result: '1:08:12', km: '10,0', location: 'Kuldīga', season: '2023-2024', category: 'Tautas' },
                // Extra race only for Kristaps
                { date: '2019-12-15', result: '36:46', km: '8', location: 'Priekuļi', season: '2019-2020', category: 'Tautas' }
            ]
        };

        const matches = compareRaces(hist1, hist2, 'Tautas');

        // Should find 3 matches
        expect(matches).toHaveLength(3);

        // Verify Smiltene match
        const m1 = matches.find(m => m.date === '2023-11-26');
        expect(m1).toBeDefined();
        expect(m1?.race).toBe('Smiltene');

        // Verify diff calculation (Pace1 - Pace2)
        // Dāvis (52:09 = 3129s) / 10 = 312.9 s/km
        // Kristaps (41:02 = 2462s) / 10 = 246.2 s/km
        // Diff = 66.7 s/km (approx)
        if (m1) {
            expect(m1.diff).toBeCloseTo(312.9 - 246.2, 1);
        }
    });

    it('should NOT match if race distances differ significantly (e.g. 10km vs 20km)', () => {
        const hist1: HistoryResponse = {
            name: 'P1',
            races: [{ date: '2024-01-13', result: '41:13', km: '9,70', location: 'Kuldīga', season: '2023-2024', category: 'Tautas' }]
        };
        const hist2: HistoryResponse = {
            name: 'P2',
            races: [{ date: '2024-01-13', result: '1:08:12', km: '19,40', location: 'Kuldīga', season: '2023-2024', category: 'Tautas' }]
        };

        const matches = compareRaces(hist1, hist2, 'Tautas');
        expect(matches).toHaveLength(0);
    });

    it('should handle missing category by defaulting to Tautas', () => {
        const hist1: HistoryResponse = {
            name: 'P1',
            races: [{ date: '2023-01-01', result: '20:00', km: '5', location: 'Riga', season: '2023', category: undefined }]
        };
        const hist2: HistoryResponse = {
            name: 'P2',
            races: [{ date: '2023-01-01', result: '21:00', km: '5', location: 'Riga', season: '2023', category: undefined }]
        };

        const matches = compareRaces(hist1, hist2, 'Tautas');
        expect(matches).toHaveLength(1);
    });

    it('should NOT match if filtered category does not match', () => {
        const hist1: HistoryResponse = {
            name: 'P1',
            races: [{ date: '2023-01-01', result: '20:00', km: '5', location: 'Riga', season: '2023', category: 'Sporta' }]
        };
        const hist2: HistoryResponse = {
            name: 'P2',
            races: [{ date: '2023-01-01', result: '21:00', km: '5', location: 'Riga', season: '2023', category: 'Sporta' }]
        };

        const matches = compareRaces(hist1, hist2, 'Tautas');
        expect(matches).toHaveLength(0);
    });

    it('should NOT match if categories differ between participants (sanity check)', () => {
        // Even if on same Date/Location, if one ran Tautas and other Sporta, we shouldn't compare them under one category flag?
        // The logic `if (cat !== category)` handles this.
        const hist1: HistoryResponse = {
            name: 'P1',
            races: [{ date: '2023-01-01', result: '20:00', km: '5', location: 'Riga', season: '2023', category: 'Tautas' }]
        };
        const hist2: HistoryResponse = {
            name: 'P2',
            races: [{ date: '2023-01-01', result: '21:00', km: '5', location: 'Riga', season: '2023', category: 'Sporta' }]
        };

        // Testing searching for Tautas
        const matchesT = compareRaces(hist1, hist2, 'Tautas');
        expect(matchesT).toHaveLength(0); // P2 is filtered out
    });
});
