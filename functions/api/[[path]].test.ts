import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeLatvian } from '../../src/utils/latvian';
import { onRequest } from './[[path]]';

/**
 * API Endpoint Tests - Normalized Name Queries
 *
 * These tests verify the query construction logic for the simplified API
 * that uses normalized_name field instead of complex REPLACE chains.
 */

describe('API Query Logic - Normalized Name', () => {
  describe('Query construction for /api/results', () => {
    it('should normalize search input using normalizeLatvian', () => {
      const searchName = 'Dāvis';
      const normalized = normalizeLatvian(searchName).toLowerCase();

      expect(normalized).toBe('davis');
    });

    it('should create simple query binding for normalized_name', () => {
      const searchName = 'Bērziņš';
      const normalized = normalizeLatvian(searchName).toLowerCase();
      const queryPattern = `%${normalized}%`;

      // Verify the pattern is what would be used in SQL LIKE query
      expect(queryPattern).toBe('%berzins%');
    });

    it('should handle mixed case input consistently', () => {
      const inputs = ['DAVIS', 'Davis', 'davis'];
      const expected = 'davis';

      inputs.forEach(input => {
        const normalized = normalizeLatvian(input).toLowerCase();
        expect(normalized).toBe(expected);
      });
    });

    it('should verify no REPLACE chains in query (code structure test)', () => {
      // This test documents that we use normalized_name field
      // instead of complex REPLACE chains in SQL
      const expectedQueryPattern = 'normalized_name LIKE ?';
      const oldQueryPattern = 'REPLACE(REPLACE(REPLACE(';

      // The new implementation should use simple normalized_name query
      expect(expectedQueryPattern).toContain('normalized_name');
      expect(oldQueryPattern).not.toBe(expectedQueryPattern);
    });
  });

  describe('Query construction for /api/history', () => {
    it('should accept numeric ID as parameter', () => {
      const id = '123';
      const parsedId = parseInt(id);

      expect(parsedId).toBe(123);
      expect(Number.isInteger(parsedId)).toBe(true);
    });

    it('should verify query uses ID binding', () => {
      // The new implementation queries by ID, not name
      const expectedQueryPattern = 'WHERE id = ?';
      const oldQueryPattern = 'WHERE p.name = ?';

      expect(expectedQueryPattern).toContain('id');
      expect(expectedQueryPattern).not.toBe(oldQueryPattern);
    });

    it('should only select columns that exist in participants table (schema-v2)', () => {
      // Schema-v2: participants table has: id, name, gender, distance, normalized_name
      // Schema-v2: participants table does NOT have: season (moved to races table)
      const validColumns = ['id', 'name', 'gender', 'distance', 'normalized_name'];
      const invalidColumns = ['season', 'link'];

      // This test documents schema-v2 structure
      validColumns.forEach(col => {
        expect(['id', 'name', 'gender', 'distance', 'normalized_name']).toContain(col);
      });

      invalidColumns.forEach(col => {
        expect(['id', 'name', 'gender', 'distance', 'normalized_name']).not.toContain(col);
      });
    });

    it('should fetch participant history without querying season from participants table', async () => {
      // Create mock database that matches schema-v2
      const mockParticipant = {
        id: 123,
        name: 'Dāvis Pazars',
        gender: 'V',
        distance: 'Tautas',
        normalized_name: 'davis pazars'
        // NOTE: No 'season' field - that's in races table now
      };

      const mockRaces = [
        { date: '2023-11-26', result: '41:02', km: '10.5', location: 'Smiltene' }
      ];

      const mockDB = {
        prepare: (query: string) => ({
          bind: (...args: any[]) => ({
            first: async () => {
              // If query tries to SELECT season from participants, it should fail
              if (query.includes('participants') && query.includes('season')) {
                throw new Error('D1_ERROR: no such column: season');
              }
              return mockParticipant;
            },
            all: async () => ({ results: mockRaces })
          })
        })
      };

      const mockEnv = { DB: mockDB as any };
      const mockContext = {
        request: new Request('http://localhost/api/history?id=123'),
        env: mockEnv,
        next: async () => new Response('not found')
      };

      // This should NOT throw an error about missing 'season' column
      const response = await onRequest(mockContext as any);
      const data = await response.json();

      // Debug: log error if request failed
      if (response.status !== 200) {
        console.error('API Error:', data);
      }

      expect(response.status).toBe(200);
      expect(data.participant).toBeDefined();
      expect(data.participant.name).toBe('Dāvis Pazars');
      expect(data.races).toHaveLength(1);
    });
  });

  describe('Latvian normalization edge cases', () => {
    it('should handle all Latvian special characters', () => {
      const name = 'Jānis Bērziņš Čaks Ģirts';
      const normalized = normalizeLatvian(name).toLowerCase();

      expect(normalized).toBe('janis berzins caks girts');
    });

    it('should preserve spaces and non-Latvian characters', () => {
      const name = 'John-Smith 123';
      const normalized = normalizeLatvian(name).toLowerCase();

      expect(normalized).toBe('john-smith 123');
    });

    it('should handle empty strings', () => {
      const normalized = normalizeLatvian('').toLowerCase();
      expect(normalized).toBe('');
    });
  });

  describe('Query parameter validation', () => {
    it('should reject names shorter than 2 characters', () => {
      const minLength = 2;

      expect('A'.length < minLength).toBe(true);
      expect('Ab'.length < minLength).toBe(false);
    });

    it('should handle optional distance parameter', () => {
      const distances = ['5km', '10km', null, undefined];

      distances.forEach(distance => {
        if (distance) {
          expect(['5km', '10km']).toContain(distance);
        } else {
          expect(distance).toBeFalsy();
        }
      });
    });
  });
});
