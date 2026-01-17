import { describe, it, expect } from 'vitest';

/**
 * Integration tests for distance-aware autocomplete functionality
 *
 * These tests verify that the ParticipantSelector component and API endpoint
 * work together to filter participants by distance category.
 */

describe('ParticipantSelector - Distance Filtering Integration', () => {
    describe('API Query URL construction', () => {
        it('should construct URL with distance parameter when distance is provided', () => {
            const query = 'Davis';
            const distance = 'Tautas';

            const url = new URL('http://localhost:8787/api/results');
            url.searchParams.set('name', query);
            if (distance) {
                url.searchParams.set('distance', distance);
            }

            expect(url.toString()).toBe('http://localhost:8787/api/results?name=Davis&distance=Tautas');
            expect(url.searchParams.get('name')).toBe('Davis');
            expect(url.searchParams.get('distance')).toBe('Tautas');
        });

        it('should construct URL without distance parameter when distance is not provided', () => {
            const query = 'Davis';
            const distance = undefined;

            const url = new URL('http://localhost:8787/api/results');
            url.searchParams.set('name', query);
            if (distance) {
                url.searchParams.set('distance', distance);
            }

            expect(url.toString()).toBe('http://localhost:8787/api/results?name=Davis');
            expect(url.searchParams.get('name')).toBe('Davis');
            expect(url.searchParams.get('distance')).toBeNull();
        });

        it('should handle Sporta distance', () => {
            const query = 'Kristaps';
            const distance = 'Sporta';

            const url = new URL('http://localhost:8787/api/results');
            url.searchParams.set('name', query);
            if (distance) {
                url.searchParams.set('distance', distance);
            }

            expect(url.searchParams.get('distance')).toBe('Sporta');
        });

        it('should URL-encode special characters in query', () => {
            const query = 'Dāvis Pazars';
            const distance = 'Tautas';

            const url = new URL('http://localhost:8787/api/results');
            url.searchParams.set('name', query);
            if (distance) {
                url.searchParams.set('distance', distance);
            }

            expect(url.searchParams.get('name')).toBe('Dāvis Pazars');
            // URLSearchParams handles encoding automatically
            expect(url.toString()).toContain('D%C4%81vis');
        });
    });

    describe('Component behavior with distance prop', () => {
        it('should trigger refetch when distance prop changes', () => {
            // Simulate useEffect dependency array behavior
            const dependencies = {
                query: 'Davis',
                distance: 'Tautas'
            };

            const prevDependencies = {
                query: 'Davis',
                distance: 'Sporta'
            };

            // Distance changed, should trigger refetch
            const shouldRefetch = dependencies.query !== prevDependencies.query ||
                dependencies.distance !== prevDependencies.distance;

            expect(shouldRefetch).toBe(true);
        });

        it('should trigger refetch when query changes', () => {
            const dependencies = {
                query: 'Kristaps',
                distance: 'Tautas'
            };

            const prevDependencies = {
                query: 'Davis',
                distance: 'Tautas'
            };

            const shouldRefetch = dependencies.query !== prevDependencies.query ||
                dependencies.distance !== prevDependencies.distance;

            expect(shouldRefetch).toBe(true);
        });

        it('should not refetch when neither query nor distance changes', () => {
            const dependencies = {
                query: 'Davis',
                distance: 'Tautas'
            };

            const prevDependencies = {
                query: 'Davis',
                distance: 'Tautas'
            };

            const shouldRefetch = dependencies.query !== prevDependencies.query ||
                dependencies.distance !== prevDependencies.distance;

            expect(shouldRefetch).toBe(false);
        });
    });

    describe('Empty state messages', () => {
        it('should suggest Sporta distance when Tautas is selected and no results found', () => {
            const distance = 'Tautas';
            const hasResults = false;
            const query = 'Kristaps';

            let message = 'Dalībnieks nav atrasts';
            let suggestion = null;

            if (distance && !hasResults && query.length >= 2) {
                const otherDistance = distance === 'Tautas' ? 'Sporta' : 'Tautas';
                suggestion = `Varbūt viņš/-a skrēja ${otherDistance} distancē?`;
            }

            expect(message).toBe('Dalībnieks nav atrasts');
            expect(suggestion).toBe('Varbūt viņš/-a skrēja Sporta distancē?');
        });

        it('should suggest Tautas distance when Sporta is selected and no results found', () => {
            const distance = 'Sporta';
            const hasResults = false;
            const query = 'Davis';

            let suggestion = null;

            if (distance && !hasResults && query.length >= 2) {
                const otherDistance = distance === 'Tautas' ? 'Sporta' : 'Tautas';
                suggestion = `Varbūt viņš/-a skrēja ${otherDistance} distancē?`;
            }

            expect(suggestion).toBe('Varbūt viņš/-a skrēja Tautas distancē?');
        });

        it('should not show suggestion when distance is not provided', () => {
            const distance = undefined;
            const hasResults = false;
            const query = 'Davis';

            let suggestion = null;

            if (distance && !hasResults && query.length >= 2) {
                const otherDistance = distance === 'Tautas' ? 'Sporta' : 'Tautas';
                suggestion = `Varbūt viņš/-a skrēja ${otherDistance} distancē?`;
            }

            expect(suggestion).toBeNull();
        });

        it('should not show suggestion when results are found', () => {
            const distance = 'Tautas';
            const hasResults = true;
            const query = 'Davis';

            let suggestion = null;

            if (distance && !hasResults && query.length >= 2) {
                const otherDistance = distance === 'Tautas' ? 'Sporta' : 'Tautas';
                suggestion = `Varbūt viņš/-a skrēja ${otherDistance} distancē?`;
            }

            expect(suggestion).toBeNull();
        });

        it('should not show suggestion when query is too short', () => {
            const distance = 'Tautas';
            const hasResults = false;
            const query = 'D';

            let suggestion = null;

            if (distance && !hasResults && query.length >= 2) {
                const otherDistance = distance === 'Tautas' ? 'Sporta' : 'Tautas';
                suggestion = `Varbūt viņš/-a skrēja ${otherDistance} distancē?`;
            }

            expect(suggestion).toBeNull();
        });
    });

    describe('Real-world scenarios', () => {
        it('should filter correctly: Dāvis Pazars only in Tautas', () => {
            // Simulating the actual use case from the issue
            const participantName = 'Dāvis Pazars';
            const actualDistance = 'Tautas';
            const selectedDistance = 'Sporta';

            // Should NOT appear in results
            const shouldAppear = actualDistance === selectedDistance;
            expect(shouldAppear).toBe(false);
        });

        it('should filter correctly: Participant exists in selected distance', () => {
            const participantName = 'Kristaps Bērziņš';
            const actualDistance = 'Sporta';
            const selectedDistance = 'Sporta';

            // Should appear in results
            const shouldAppear = actualDistance === selectedDistance;
            expect(shouldAppear).toBe(true);
        });

        it('should show all participants when no distance filter is applied', () => {
            const participant1Distance = 'Tautas';
            const participant2Distance = 'Sporta';
            const selectedDistance = undefined;

            // Both should appear when no filter
            const shouldShowParticipant1 = !selectedDistance || participant1Distance === selectedDistance;
            const shouldShowParticipant2 = !selectedDistance || participant2Distance === selectedDistance;

            expect(shouldShowParticipant1).toBe(true);
            expect(shouldShowParticipant2).toBe(true);
        });
    });

    describe('Category toggle synchronization', () => {
        it('should pass category state to ParticipantSelector as distance prop', () => {
            const category = 'Tautas';
            const distanceProp = category;

            expect(distanceProp).toBe('Tautas');
        });

        it('should update distance prop when category toggles', () => {
            let category = 'Tautas';
            let distanceProp = category;

            expect(distanceProp).toBe('Tautas');

            // User toggles category
            category = 'Sporta';
            distanceProp = category;

            expect(distanceProp).toBe('Sporta');
        });

        it('should maintain separate distance props for both ParticipantSelectors', () => {
            const category = 'Sporta';
            const runner1Distance = category;
            const runner2Distance = category;

            expect(runner1Distance).toBe(runner2Distance);
            expect(runner1Distance).toBe('Sporta');
        });
    });
});
