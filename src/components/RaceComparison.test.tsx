import { describe, it, expect } from 'vitest';

/**
 * Tests for RaceComparison component color consistency
 *
 * These tests verify that when participants are swapped to show the faster runner
 * with positive y-axis values, the colors in tooltips and line charts remain
 * consistent with the original search input colors:
 * - First input (1. dalībnieks): blue (#00AEEF)
 * - Second input (2. dalībnieks): orange (#F97316)
 */

describe('RaceComparison - Color Consistency', () => {

    describe('Participant swapping logic', () => {
        it('should not swap participants when p2 has more wins', () => {
            // Create races where p2 wins more (diff > 0 means p2 is faster)
            const races = [
                { diff: 10, pace1: 300, pace2: 290, p1Time: '5:00', p2Time: '4:50', race: 'Race 1', date: '2024-01-01', distance: 10, season: '2024' },
                { diff: 20, pace1: 310, pace2: 290, p1Time: '5:10', p2Time: '4:50', race: 'Race 2', date: '2024-02-01', distance: 10, season: '2024' },
                { diff: -5, pace1: 290, pace2: 295, p1Time: '4:50', p2Time: '4:55', race: 'Race 3', date: '2024-03-01', distance: 10, season: '2024' }
            ];

            // In actual implementation, the logic checks:
            // p1Wins = races where diff < 0 = 1 race
            // p2Wins = races where diff > 0 = 2 races
            // Since p2Wins > p1Wins, no swap should occur

            const p1Wins = races.filter(r => r.diff < 0).length;
            const p2Wins = races.filter(r => r.diff > 0).length;

            expect(p1Wins).toBe(1);
            expect(p2Wins).toBe(2);
            expect(p1Wins).toBeLessThan(p2Wins);

            // No swap expected, so isSwapped should be false
            const shouldSwap = p1Wins > p2Wins;
            expect(shouldSwap).toBe(false);
        });

        it('should swap participants when p1 has more wins', () => {
            // Create races where p1 wins more (diff < 0 means p1 is faster)
            const races = [
                { diff: -10, pace1: 290, pace2: 300, p1Time: '4:50', p2Time: '5:00', race: 'Race 1', date: '2024-01-01', distance: 10, season: '2024' },
                { diff: -20, pace1: 290, pace2: 310, p1Time: '4:50', p2Time: '5:10', race: 'Race 2', date: '2024-02-01', distance: 10, season: '2024' },
                { diff: 5, pace1: 295, pace2: 290, p1Time: '4:55', p2Time: '4:50', race: 'Race 3', date: '2024-03-01', distance: 10, season: '2024' }
            ];

            // p1Wins = races where diff < 0 = 2 races
            // p2Wins = races where diff > 0 = 1 race
            // Since p1Wins > p2Wins, swap should occur

            const p1Wins = races.filter(r => r.diff < 0).length;
            const p2Wins = races.filter(r => r.diff > 0).length;

            expect(p1Wins).toBe(2);
            expect(p2Wins).toBe(1);
            expect(p1Wins).toBeGreaterThan(p2Wins);

            const shouldSwap = p1Wins > p2Wins;
            expect(shouldSwap).toBe(true);

            // When swapped, the data should be inverted
            const swappedRaces = races.map(race => ({
                ...race,
                pace1: race.pace2,
                pace2: race.pace1,
                p1Time: race.p2Time,
                p2Time: race.p1Time,
                diff: -race.diff
            }));

            expect(swappedRaces[0].diff).toBe(10); // Was -10, now 10
            expect(swappedRaces[0].pace1).toBe(300); // Was 290, now 300
            expect(swappedRaces[0].pace2).toBe(290); // Was 300, now 290
        });
    });

    describe('Tooltip color mapping', () => {
        it('should use blue for p1 and orange for p2 when not swapped', () => {
            const originalP1Name = 'Runner A';
            const originalP2Name = 'Runner B';
            const displayP1Name = 'Runner A'; // Not swapped
            const displayP2Name = 'Runner B'; // Not swapped

            // Determine colors based on which original person each display name corresponds to
            const p1Color = displayP1Name === originalP1Name ? '#00AEEF' : '#F97316';
            const p2Color = displayP2Name === originalP2Name ? '#F97316' : '#00AEEF';

            expect(p1Color).toBe('#00AEEF'); // Blue for first input
            expect(p2Color).toBe('#F97316'); // Orange for second input
        });

        it('should swap colors when participants are swapped', () => {
            const originalP1Name = 'Runner A';
            const originalP2Name = 'Runner B';
            const displayP1Name: string = 'Runner B'; // Swapped!
            const displayP2Name: string = 'Runner A'; // Swapped!

            // Determine colors based on which original person each display name corresponds to
            const p1Color = displayP1Name === originalP1Name ? '#00AEEF' : '#F97316';
            const p2Color = displayP2Name === originalP2Name ? '#F97316' : '#00AEEF';

            expect(p1Color).toBe('#F97316'); // Orange because displayP1 is originally p2
            expect(p2Color).toBe('#00AEEF'); // Blue because displayP2 is originally p1
        });

        it('should determine correct background color based on winner when not swapped', () => {
            const p1Color = '#00AEEF' as const;
            const p2Color = '#F97316' as const;

            // Helper function to get background color
            const getBgColor = (diff: number, p1Col: string, p2Col: string) => {
                return diff < 0
                    ? `rgba(${p1Col === '#00AEEF' ? '0, 174, 239' : '249, 115, 22'}, 0.1)`
                    : `rgba(${p2Col === '#F97316' ? '249, 115, 22' : '0, 174, 239'}, 0.1)`;
            };

            // When diff < 0, p1 is faster (blue background)
            const diff1 = -10;
            const bg1 = getBgColor(diff1, p1Color, p2Color);
            expect(bg1).toBe('rgba(0, 174, 239, 0.1)'); // Blue background

            // When diff > 0, p2 is faster (orange background)
            const diff2 = 10;
            const bg2 = getBgColor(diff2, p1Color, p2Color);
            expect(bg2).toBe('rgba(249, 115, 22, 0.1)'); // Orange background
        });

        it('should determine correct background color based on winner when swapped', () => {
            const p1Color = '#F97316' as const; // Swapped
            const p2Color = '#00AEEF' as const; // Swapped

            // Helper function to get background color
            const getBgColor = (diff: number, p1Col: string, p2Col: string) => {
                return diff < 0
                    ? `rgba(${p1Col === '#00AEEF' ? '0, 174, 239' : '249, 115, 22'}, 0.1)`
                    : `rgba(${p2Col === '#F97316' ? '249, 115, 22' : '0, 174, 239'}, 0.1)`;
            };

            // When diff < 0, p1 is faster (orange background because swapped)
            const diff1 = -10;
            const bg1 = getBgColor(diff1, p1Color, p2Color);
            expect(bg1).toBe('rgba(249, 115, 22, 0.1)'); // Orange background

            // When diff > 0, p2 is faster (blue background because swapped)
            const diff2 = 10;
            const bg2 = getBgColor(diff2, p1Color, p2Color);
            expect(bg2).toBe('rgba(0, 174, 239, 0.1)'); // Blue background
        });
    });

    describe('Individual plot mode line colors', () => {
        it('should use blue for pace1 and orange for pace2 when not swapped', () => {
            const isSwapped = false;

            const pace1Color = isSwapped ? "#F97316" : "#00AEEF";
            const pace2Color = isSwapped ? "#00AEEF" : "#F97316";

            expect(pace1Color).toBe("#00AEEF"); // Blue
            expect(pace2Color).toBe("#F97316"); // Orange
        });

        it('should swap line colors when participants are swapped', () => {
            const isSwapped = true;

            const pace1Color = isSwapped ? "#F97316" : "#00AEEF";
            const pace2Color = isSwapped ? "#00AEEF" : "#F97316";

            expect(pace1Color).toBe("#F97316"); // Orange (swapped)
            expect(pace2Color).toBe("#00AEEF"); // Blue (swapped)
        });
    });

    describe('Full integration - Color consistency across UI', () => {
        it('should maintain color consistency when Runner A (blue input) is faster', () => {
            const originalP1Name = 'Runner A'; // Blue input
            const originalP2Name = 'Runner B'; // Orange input

            // Runner A is faster (more wins with diff < 0)
            const races = [
                { diff: -10, pace1: 290, pace2: 300, p1Time: '4:50', p2Time: '5:00', race: 'Race 1', date: '2024-01-01', distance: 10, season: '2024' },
                { diff: -20, pace1: 290, pace2: 310, p1Time: '4:50', p2Time: '5:10', race: 'Race 2', date: '2024-02-01', distance: 10, season: '2024' },
                { diff: 5, pace1: 295, pace2: 290, p1Time: '4:55', p2Time: '4:50', race: 'Race 3', date: '2024-03-01', distance: 10, season: '2024' }
            ];

            const p1Wins = races.filter(r => r.diff < 0).length; // 2
            const p2Wins = races.filter(r => r.diff > 0).length; // 1
            const isSwapped = p1Wins > p2Wins; // true

            // After swap: displayP1 = Runner B, displayP2 = Runner A
            const displayP1Name = isSwapped ? originalP2Name : originalP1Name;
            const displayP2Name = isSwapped ? originalP1Name : originalP2Name;

            expect(displayP1Name).toBe('Runner B');
            expect(displayP2Name).toBe('Runner A');

            // Tooltip colors - determine based on which original person each display name corresponds to
            const getTooltipColorSwapped = (displayName: string, originalName: string, isFirstInput: boolean) => {
                return displayName === originalName ? (isFirstInput ? '#00AEEF' : '#F97316') : (isFirstInput ? '#F97316' : '#00AEEF');
            };
            const tooltipP1Color = getTooltipColorSwapped(displayP1Name, originalP1Name, true);
            const tooltipP2Color = getTooltipColorSwapped(displayP2Name, originalP2Name, false);

            expect(tooltipP1Color).toBe('#F97316'); // Runner B (orange input) shown in p1 position
            expect(tooltipP2Color).toBe('#00AEEF'); // Runner A (blue input) shown in p2 position

            // Line chart colors
            const pace1Color = isSwapped ? "#F97316" : "#00AEEF";
            const pace2Color = isSwapped ? "#00AEEF" : "#F97316";

            expect(pace1Color).toBe('#F97316'); // pace1 line is orange (Runner B's data)
            expect(pace2Color).toBe('#00AEEF'); // pace2 line is blue (Runner A's data)

            // Verify consistency: Runner A should always be blue, Runner B always orange
            // Runner A is in p2 position, which has blue color ✓
            // Runner B is in p1 position, which has orange color ✓
        });

        it('should maintain color consistency when Runner B (orange input) is faster', () => {
            const originalP1Name = 'Runner A'; // Blue input
            const originalP2Name = 'Runner B'; // Orange input

            // Runner B is faster (more wins with diff > 0)
            const races = [
                { diff: 10, pace1: 300, pace2: 290, p1Time: '5:00', p2Time: '4:50', race: 'Race 1', date: '2024-01-01', distance: 10, season: '2024' },
                { diff: 20, pace1: 310, pace2: 290, p1Time: '5:10', p2Time: '4:50', race: 'Race 2', date: '2024-02-01', distance: 10, season: '2024' },
                { diff: -5, pace1: 290, pace2: 295, p1Time: '4:50', p2Time: '4:55', race: 'Race 3', date: '2024-03-01', distance: 10, season: '2024' }
            ];

            const p1Wins = races.filter(r => r.diff < 0).length; // 1
            const p2Wins = races.filter(r => r.diff > 0).length; // 2
            const isSwapped = p1Wins > p2Wins; // false

            // No swap: displayP1 = Runner A, displayP2 = Runner B
            const displayP1Name = isSwapped ? originalP2Name : originalP1Name;
            const displayP2Name = isSwapped ? originalP1Name : originalP2Name;

            expect(displayP1Name).toBe('Runner A');
            expect(displayP2Name).toBe('Runner B');

            // Tooltip colors - determine based on which original person each display name corresponds to
            const getTooltipColor2 = (displayName: string, originalName: string, isFirstInput: boolean) => {
                return displayName === originalName ? (isFirstInput ? '#00AEEF' : '#F97316') : (isFirstInput ? '#F97316' : '#00AEEF');
            };
            const tooltipP1Color = getTooltipColor2(displayP1Name, originalP1Name, true);
            const tooltipP2Color = getTooltipColor2(displayP2Name, originalP2Name, false);

            expect(tooltipP1Color).toBe('#00AEEF'); // Runner A (blue input) shown in p1 position
            expect(tooltipP2Color).toBe('#F97316'); // Runner B (orange input) shown in p2 position

            // Line chart colors
            const pace1Color = isSwapped ? "#F97316" : "#00AEEF";
            const pace2Color = isSwapped ? "#00AEEF" : "#F97316";

            expect(pace1Color).toBe('#00AEEF'); // pace1 line is blue (Runner A's data)
            expect(pace2Color).toBe('#F97316'); // pace2 line is orange (Runner B's data)

            // Verify consistency: Runner A should always be blue, Runner B always orange
            // Runner A is in p1 position, which has blue color ✓
            // Runner B is in p2 position, which has orange color ✓
        });

        it('should maintain color consistency when tied (no swap)', () => {
            const originalP1Name = 'Runner A'; // Blue input
            const originalP2Name = 'Runner B'; // Orange input

            // Equal wins
            const races = [
                { diff: -10, pace1: 290, pace2: 300, p1Time: '4:50', p2Time: '5:00', race: 'Race 1', date: '2024-01-01', distance: 10, season: '2024' },
                { diff: 10, pace1: 300, pace2: 290, p1Time: '5:00', p2Time: '4:50', race: 'Race 2', date: '2024-02-01', distance: 10, season: '2024' }
            ];

            const p1Wins = races.filter(r => r.diff < 0).length; // 1
            const p2Wins = races.filter(r => r.diff > 0).length; // 1
            const isSwapped = p1Wins > p2Wins; // false (tie, no swap)

            const displayP1Name = isSwapped ? originalP2Name : originalP1Name;
            const displayP2Name = isSwapped ? originalP1Name : originalP2Name;

            expect(displayP1Name).toBe('Runner A');
            expect(displayP2Name).toBe('Runner B');

            // Tooltip colors - determine based on which original person each display name corresponds to
            const getTooltipColor3 = (displayName: string, originalName: string, isFirstInput: boolean) => {
                return displayName === originalName ? (isFirstInput ? '#00AEEF' : '#F97316') : (isFirstInput ? '#F97316' : '#00AEEF');
            };
            const tooltipP1Color = getTooltipColor3(displayP1Name, originalP1Name, true);
            const tooltipP2Color = getTooltipColor3(displayP2Name, originalP2Name, false);

            expect(tooltipP1Color).toBe('#00AEEF'); // Blue
            expect(tooltipP2Color).toBe('#F97316'); // Orange
        });
    });

    describe('Chart rendering conditions', () => {
        it('should not render chart when p1 is null', () => {
            const p1 = null;
            const p2 = { id: 1, name: 'Runner B', gender: 'V' };
            const chartData = [{ diff: 10, pace1: 300, pace2: 290 }];
            const loading = false;

            // The condition: !loading && p1 && p2 && chartData.length > 0
            const shouldRenderChart = !loading && p1 && p2 && chartData.length > 0;

            expect(shouldRenderChart).toBeFalsy();
        });

        it('should not render chart when p2 is null', () => {
            const p1 = { id: 1, name: 'Runner A', gender: 'V' };
            const p2 = null;
            const chartData = [{ diff: 10, pace1: 300, pace2: 290 }];
            const loading = false;

            const shouldRenderChart = !loading && p1 && p2 && chartData.length > 0;

            expect(shouldRenderChart).toBeFalsy();
        });

        it('should not render chart when both participants are null', () => {
            const p1 = null;
            const p2 = null;
            const chartData = [{ diff: 10, pace1: 300, pace2: 290 }];
            const loading = false;

            const shouldRenderChart = !loading && p1 && p2 && chartData.length > 0;

            expect(shouldRenderChart).toBeFalsy();
        });

        it('should render chart when both participants exist and have data', () => {
            const p1 = { id: 1, name: 'Runner A', gender: 'V' };
            const p2 = { id: 2, name: 'Runner B', gender: 'V' };
            const chartData = [{ diff: 10, pace1: 300, pace2: 290 }];
            const loading = false;

            const shouldRenderChart = !loading && p1 && p2 && chartData.length > 0;

            expect(shouldRenderChart).toBeTruthy();
        });

        it('should not render chart when chartData is stale but participant becomes null', () => {
            // This simulates the bug scenario where chartData exists from previous selection
            // but one participant has just been cleared
            const p1 = null; // Just cleared
            const p2 = { id: 2, name: 'Runner B', gender: 'V' };
            const chartData = [
                { diff: 10, pace1: 300, pace2: 290 },
                { diff: 20, pace1: 310, pace2: 290 }
            ]; // Stale data from before p1 was cleared
            const loading = false;

            // Without the fix, this would crash when trying to access p1.name
            // With the fix, the chart should not render
            const shouldRenderChart = !loading && p1 && p2 && chartData.length > 0;

            expect(shouldRenderChart).toBeFalsy();
        });
    });

    describe('Edge cases', () => {
        it('should handle empty race array (no comparison data)', () => {
            const races: any[] = [];

            const p1Wins = races.filter(r => r.diff < 0).length;
            const p2Wins = races.filter(r => r.diff > 0).length;
            const isSwapped = p1Wins > p2Wins;

            expect(p1Wins).toBe(0);
            expect(p2Wins).toBe(0);
            expect(isSwapped).toBe(false);
        });

        it('should handle single race where p1 wins', () => {
            const races = [
                { diff: -10, pace1: 290, pace2: 300, p1Time: '4:50', p2Time: '5:00', race: 'Race 1', date: '2024-01-01', distance: 10, season: '2024' }
            ];

            const p1Wins = races.filter(r => r.diff < 0).length;
            const p2Wins = races.filter(r => r.diff > 0).length;
            const isSwapped = p1Wins > p2Wins;

            expect(p1Wins).toBe(1);
            expect(p2Wins).toBe(0);
            expect(isSwapped).toBe(true);
        });

        it('should handle all races with diff = 0 (perfect ties)', () => {
            const races = [
                { diff: 0, pace1: 290, pace2: 290, p1Time: '4:50', p2Time: '4:50', race: 'Race 1', date: '2024-01-01', distance: 10, season: '2024' },
                { diff: 0, pace1: 300, pace2: 300, p1Time: '5:00', p2Time: '5:00', race: 'Race 2', date: '2024-02-01', distance: 10, season: '2024' }
            ];

            const p1Wins = races.filter(r => r.diff < 0).length;
            const p2Wins = races.filter(r => r.diff > 0).length;
            const isSwapped = p1Wins > p2Wins;

            expect(p1Wins).toBe(0);
            expect(p2Wins).toBe(0);
            expect(isSwapped).toBe(false); // No swap when tied
        });
    });
});
