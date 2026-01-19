
import { describe, it, expect } from 'vitest';
import { compareRaces, deriveSeasonFromDate, type HistoryResponse } from './comparison';

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

    it('should return races sorted chronologically', () => {
        const hist1: HistoryResponse = {
            name: 'P1',
            races: [
                { date: '2024-02-01', result: '30:00', km: '5', location: 'Race2', season: '2024', category: 'Tautas' },
                { date: '2024-01-01', result: '30:00', km: '5', location: 'Race1', season: '2024', category: 'Tautas' },
                { date: '2024-03-01', result: '30:00', km: '5', location: 'Race3', season: '2024', category: 'Tautas' }
            ]
        };
        const hist2: HistoryResponse = {
            name: 'P2',
            races: [
                { date: '2024-02-01', result: '31:00', km: '5', location: 'Race2', season: '2024', category: 'Tautas' },
                { date: '2024-01-01', result: '31:00', km: '5', location: 'Race1', season: '2024', category: 'Tautas' },
                { date: '2024-03-01', result: '31:00', km: '5', location: 'Race3', season: '2024', category: 'Tautas' }
            ]
        };

        const matches = compareRaces(hist1, hist2, 'Tautas');
        expect(matches).toHaveLength(3);
        expect(matches[0].race).toBe('Race1');
        expect(matches[1].race).toBe('Race2');
        expect(matches[2].race).toBe('Race3');
    });

    it('should correctly handle multiple races on same date with different categories (bug regression)', () => {
        // This tests the bug where Map keyed only by date would overwrite races
        // when a participant has both Tautas and Sporta on the same date
        const hist1: HistoryResponse = {
            name: 'Dāvis Pazars',
            races: [
                { date: '2023-11-26', result: '52:09', km: '10.40', location: 'Smiltene', season: '2023-2024', category: 'Tautas' },
                { date: '2023-12-17', result: '47:05', km: '9.50', location: 'Ļaudona', season: '2023-2024', category: 'Tautas' },
                { date: '2024-02-11', result: '38:30', km: '9.20', location: 'Koknese', season: '2023-2024', category: 'Tautas' }
            ]
        };

        const hist2: HistoryResponse = {
            name: 'Kristaps Bērziņš',
            races: [
                // Has BOTH Tautas and Sporta on same dates
                { date: '2023-11-26', result: '41:02', km: '10.40', location: 'Smiltene', season: '2023-2024', category: 'Tautas' },
                { date: '2023-11-26', result: '39:30', km: '10.40', location: 'Smiltene', season: '2023-2024', category: 'Sporta' },
                { date: '2023-12-17', result: '41:13', km: '9.50', location: 'Ļaudona', season: '2023-2024', category: 'Tautas' },
                { date: '2023-12-17', result: '38:45', km: '9.50', location: 'Ļaudona', season: '2023-2024', category: 'Sporta' },
                { date: '2024-02-11', result: '38:00', km: '9.20', location: 'Koknese', season: '2023-2024', category: 'Tautas' },
                { date: '2024-02-11', result: '37:00', km: '9.20', location: 'Koknese', season: '2023-2024', category: 'Sporta' }
            ]
        };

        // When filtering for Tautas, should find all 3 Tautas matches
        const tautasMatches = compareRaces(hist1, hist2, 'Tautas');
        expect(tautasMatches).toHaveLength(3);

        // Verify each match is correct - should use Tautas times, not Sporta times
        const smiltene = tautasMatches.find(m => m.date === '2023-11-26');
        expect(smiltene).toBeDefined();
        expect(smiltene?.race).toBe('Smiltene');
        expect(smiltene?.p1Time).toBe('52:09');
        expect(smiltene?.p2Time).toBe('41:02'); // Should match Tautas time, not Sporta

        const laudona = tautasMatches.find(m => m.date === '2023-12-17');
        expect(laudona).toBeDefined();
        expect(laudona?.race).toBe('Ļaudona');
        expect(laudona?.p1Time).toBe('47:05');
        expect(laudona?.p2Time).toBe('41:13'); // Should match Tautas time, not Sporta

        const koknese = tautasMatches.find(m => m.date === '2024-02-11');
        expect(koknese).toBeDefined();
        expect(koknese?.race).toBe('Koknese');
        expect(koknese?.p1Time).toBe('38:30');
        expect(koknese?.p2Time).toBe('38:00'); // Should match Tautas time, not Sporta
    });

    it('should preserve season information in comparison results', () => {
        const hist1: HistoryResponse = {
            name: 'Runner A',
            races: [
                { date: '2023-11-26', result: '52:09', km: '10.40', location: 'Smiltene', season: '2023-2024', category: 'Tautas' },
                { date: '2024-11-24', result: '39:55', km: '9.40', location: 'Mālpils', season: '2024-2025', category: 'Tautas' },
                { date: '2025-11-23', result: '39:18', km: '10.20', location: 'Jaunpiebalga', season: '2025-2026', category: 'Tautas' }
            ]
        };

        const hist2: HistoryResponse = {
            name: 'Runner B',
            races: [
                { date: '2023-11-26', result: '41:02', km: '10.40', location: 'Smiltene', season: '2023-2024', category: 'Tautas' },
                { date: '2024-11-24', result: '33:50', km: '9.40', location: 'Mālpils', season: '2024-2025', category: 'Tautas' },
                { date: '2025-11-23', result: '35:00', km: '10.20', location: 'Jaunpiebalga', season: '2025-2026', category: 'Tautas' }
            ]
        };

        const matches = compareRaces(hist1, hist2, 'Tautas');

        // Should have 3 matches
        expect(matches).toHaveLength(3);

        // Each match should preserve the season
        expect(matches[0].season).toBe('2023-2024');
        expect(matches[1].season).toBe('2024-2025');
        expect(matches[2].season).toBe('2025-2026');

        // Verify all seasons are different (for color variation)
        const uniqueSeasons = [...new Set(matches.map(m => m.season))];
        expect(uniqueSeasons).toHaveLength(3);
    });

    it('should derive correct season from race dates', () => {
        // November races -> current year to next year
        expect(deriveSeasonFromDate('2023-11-26')).toBe('2023-2024');
        expect(deriveSeasonFromDate('2024-11-24')).toBe('2024-2025');

        // December races -> current year to next year
        expect(deriveSeasonFromDate('2023-12-17')).toBe('2023-2024');
        expect(deriveSeasonFromDate('2025-12-14')).toBe('2025-2026');

        // January races -> previous year to current year
        expect(deriveSeasonFromDate('2024-01-13')).toBe('2023-2024');
        expect(deriveSeasonFromDate('2025-01-11')).toBe('2024-2025');
        expect(deriveSeasonFromDate('2026-01-10')).toBe('2025-2026');

        // February races -> previous year to current year
        expect(deriveSeasonFromDate('2024-02-11')).toBe('2023-2024');
        expect(deriveSeasonFromDate('2025-02-09')).toBe('2024-2025');

        // March races -> previous year to current year
        expect(deriveSeasonFromDate('2024-03-10')).toBe('2023-2024');
        expect(deriveSeasonFromDate('2025-03-09')).toBe('2024-2025');
    });

    it('should use derived season instead of database season field', () => {
        // This tests that seasons are derived from dates, not from the participant.season field
        // which can be incorrect in the database (e.g., Kristaps Bērziņš has all Tautas races
        // assigned to season "2019-2020" in the DB, even races from 2023, 2024, 2025)
        const hist1: HistoryResponse = {
            name: 'Runner A',
            races: [
                { date: '2023-11-26', result: '52:09', km: '10.40', location: 'Smiltene', season: 'WRONG-SEASON', category: 'Tautas' },
                { date: '2024-11-24', result: '39:55', km: '9.40', location: 'Mālpils', season: 'WRONG-SEASON', category: 'Tautas' },
            ]
        };

        const hist2: HistoryResponse = {
            name: 'Runner B',
            races: [
                { date: '2023-11-26', result: '41:02', km: '10.40', location: 'Smiltene', season: 'ANOTHER-WRONG', category: 'Tautas' },
                { date: '2024-11-24', result: '33:50', km: '9.40', location: 'Mālpils', season: 'ANOTHER-WRONG', category: 'Tautas' },
            ]
        };

        const matches = compareRaces(hist1, hist2, 'Tautas');

        // Should derive correct seasons from dates, ignoring database season values
        expect(matches[0].season).toBe('2023-2024');
        expect(matches[1].season).toBe('2024-2025');

        // Verify we get different seasons (for color variation)
        const uniqueSeasons = [...new Set(matches.map(m => m.season))];
        expect(uniqueSeasons).toHaveLength(2);
    });

    it('should find Sporta distance races (Klāvs Stankevics vs Andis Sakne regression)', () => {
        // Real-world test case: These two participants have 5 common Sporta races
        // Bug: API doesn't return category field, so comparison logic defaults to 'Tautas'
        // causing Sporta races to not match when filtering by 'Sporta'
        const hist1: HistoryResponse = {
            name: 'Klāvs Stankevics',
            races: [
                { date: '2023-01-08', result: '1:14:14', km: '18.70', location: 'Salacgrīva', season: '2022-2023', category: 'Sporta' },
                { date: '2023-01-28', result: '1:15:20', km: '18.60', location: 'Koknese', season: '2022-2023', category: 'Sporta' },
                { date: '2025-11-23', result: '1:19:43', km: '20.40', location: 'Jaunpiebalga', season: '2025-2026', category: 'Sporta' },
                { date: '2025-12-14', result: '1:17:22', km: '19.80', location: 'Jaunolaine', season: '2025-2026', category: 'Sporta' },
                { date: '2026-01-10', result: '1:24:38', km: '20.20', location: 'Sigulda', season: '2025-2026', category: 'Sporta' }
            ]
        };

        const hist2: HistoryResponse = {
            name: 'Andis Sakne',
            races: [
                { date: '2023-01-08', result: '1:13:45', km: '18.70', location: 'Salacgrīva', season: '2022-2023', category: 'Sporta' },
                { date: '2023-01-28', result: '1:17:08', km: '18.60', location: 'Koknese', season: '2022-2023', category: 'Sporta' },
                { date: '2025-11-23', result: '1:20:48', km: '20.40', location: 'Jaunpiebalga', season: '2025-2026', category: 'Sporta' },
                { date: '2025-12-14', result: '1:18:17', km: '19.80', location: 'Jaunolaine', season: '2025-2026', category: 'Sporta' },
                { date: '2026-01-10', result: '1:25:14', km: '20.20', location: 'Sigulda', season: '2025-2026', category: 'Sporta' }
            ]
        };

        const matches = compareRaces(hist1, hist2, 'Sporta');

        // Should find all 5 common races
        expect(matches).toHaveLength(5);

        // Verify first match
        const salacgriva = matches.find(m => m.date === '2023-01-08');
        expect(salacgriva).toBeDefined();
        expect(salacgriva?.race).toBe('Salacgrīva');
        expect(salacgriva?.p1Time).toBe('1:14:14');
        expect(salacgriva?.p2Time).toBe('1:13:45');
    });
});

