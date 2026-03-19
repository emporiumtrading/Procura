import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ingestionPipeline } from '../mocks/ingestion.mock';

describe('Lead Ingestion Pipeline', () => {
  let mockExternalApi: any;
  let mockDatabase: any;

  beforeEach(() => {
    // Initialize mocks
    mockExternalApi = ingestionPipeline.mockExternalApi();
    mockDatabase = ingestionPipeline.mockDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -------------------------------------------------------
  // Deduplication Logic
  // -------------------------------------------------------

  describe('Deduplication Logic', () => {
    it('detects duplicates based on external_ref', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Cloud Infrastructure Modernization',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
        {
          external_ref: 'SAM-2025-001', // Duplicate
          title: 'Cloud Infrastructure Modernization (Updated)',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      // Should only create one record
      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 1,
        errors: 0,
      });
    });

    it('handles multiple duplicates correctly', async () => {
      const opportunities = [
        { external_ref: 'SAM-2025-001', title: 'Opportunity 1', agency: 'DoD', source: 'sam_gov' },
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity 1 Duplicate',
          agency: 'DoD',
          source: 'sam_gov',
        },
        { external_ref: 'SAM-2025-002', title: 'Opportunity 2', agency: 'DHS', source: 'sam_gov' },
        {
          external_ref: 'SAM-2025-002',
          title: 'Opportunity 2 Duplicate',
          agency: 'DHS',
          source: 'sam_gov',
        },
        { external_ref: 'SAM-2025-003', title: 'Opportunity 3', agency: 'NASA', source: 'sam_gov' },
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      // Should create 2 new records (SAM-2025-001 and SAM-2025-002 already exist)
      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1); // Only SAM-2025-003 is new
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 4, // 4 duplicates total
        errors: 0,
      });
    });

    it('handles case-insensitive external_ref duplicates', async () => {
      const opportunities = [
        { external_ref: 'SAM-2025-001', title: 'Opportunity 1', agency: 'DoD', source: 'sam_gov' },
        {
          external_ref: 'sam-2025-001',
          title: 'Opportunity 1 Duplicate',
          agency: 'DoD',
          source: 'sam_gov',
        }, // Same but different case
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 1,
        errors: 0,
      });
    });

    it('detects duplicates across different sources', async () => {
      const opportunities = [
        { external_ref: 'SAM-2025-001', title: 'Opportunity 1', agency: 'DoD', source: 'sam_gov' },
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity 1 Duplicate',
          agency: 'DoD',
          source: 'govcon',
        }, // Same external_ref, different source
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 1,
        errors: 0,
      });
    });
  });

  // -------------------------------------------------------
  // Missing Field Handling
  // -------------------------------------------------------

  describe('Missing Field Handling', () => {
    it('handles null fields gracefully', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Cloud Infrastructure Modernization',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
          description: null, // Null field
          naics_code: undefined, // Undefined field
          estimated_value: null,
        },
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 0,
        errors: 0,
      });

      // Verify that null/undefined fields are handled correctly
      const insertedOpportunity = mockDatabase.insertOpportunity.mock.calls[0][0];
      expect(insertedOpportunity.description).toBeNull();
      expect(insertedOpportunity.naics_code).toBeUndefined();
      expect(insertedOpportunity.estimated_value).toBeNull();
    });

    it('handles missing required fields with defaults', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Cloud Infrastructure Modernization',
          // Missing agency field
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 0,
        errors: 0,
      });

      const insertedOpportunity = mockDatabase.insertOpportunity.mock.calls[0][0];
      expect(insertedOpportunity.agency).toBe('Unknown Agency'); // Default value
    });

    it('handles empty strings and whitespace', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: '   ', // Whitespace only
          agency: '', // Empty string
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 0,
        errors: 0,
      });

      const insertedOpportunity = mockDatabase.insertOpportunity.mock.calls[0][0];
      expect(insertedOpportunity.title).toBe('Untitled Opportunity'); // Default for empty title
      expect(insertedOpportunity.agency).toBe('Unknown Agency'); // Default for empty agency
    });
  });

  // -------------------------------------------------------
  // Scraper Fallback Parsing
  // -------------------------------------------------------

  describe('Scraper Fallback Parsing', () => {
    it('uses primary parser first, falls back to secondary', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Primary Parser Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
        {
          external_ref: 'SAM-2025-002',
          title: 'Secondary Parser Opportunity',
          agency: 'Department of Homeland Security',
          source: 'sam_gov',
          posted_date: '2025-01-16',
          due_date: '2025-03-02',
        },
      ];

      // Mock primary parser failure for second opportunity
      mockExternalApi.scrapeOpportunity.mockImplementation((ref: string) => {
        if (ref === 'SAM-2025-002') {
          throw new Error('Primary parser failed');
        }
        return {
          title: 'Primary Parser Result',
          agency: 'DoD',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        };
      });

      // Mock secondary parser
      mockExternalApi.secondaryScrape.mockImplementation((ref: string) => {
        return {
          title: 'Secondary Parser Result',
          agency: 'DHS',
          posted_date: '2025-01-16',
          due_date: '2025-03-02',
        };
      });

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockExternalApi.scrapeOpportunity).toHaveBeenCalledTimes(2);
      expect(mockExternalApi.secondaryScrape).toHaveBeenCalledTimes(1); // Only called for second opportunity

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        created: 2,
        updated: 0,
        duplicates: 0,
        errors: 0,
      });
    });

    it('handles primary parser failure gracefully', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      // Mock primary parser failure
      mockExternalApi.scrapeOpportunity.mockRejectedValue(new Error('Parser error'));

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).not.toHaveBeenCalled();
      expect(result).toEqual({
        created: 0,
        updated: 0,
        duplicates: 0,
        errors: 1,
      });
    });

    it('uses tertiary parser if secondary also fails', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      // Mock all parsers failing
      mockExternalApi.scrapeOpportunity.mockRejectedValue(new Error('Primary failed'));
      mockExternalApi.secondaryScrape.mockRejectedValue(new Error('Secondary failed'));
      mockExternalApi.tertiaryScrape.mockResolvedValue({
        title: 'Fallback Result',
        agency: 'DoD',
        posted_date: '2025-01-15',
        due_date: '2025-03-01',
      });

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 0,
        errors: 0,
      });
    });
  });

  // -------------------------------------------------------
  // Exponential Backoff Retry
  // -------------------------------------------------------

  describe('Exponential Backoff Retry', () => {
    it('retries on transient failures with exponential backoff', async () => {
      vi.useFakeTimers();

      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      // Mock API that fails first 2 times, then succeeds
      let callCount = 0;
      mockExternalApi.scrapeOpportunity.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Transient failure');
        }
        return {
          title: 'Opportunity',
          agency: 'DoD',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        };
      });

      const startTime = Date.now();
      const result = await ingestionPipeline.processOpportunities(opportunities);
      await vi.runAllTimersAsync();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have retried 2 times (3 total calls)
      expect(mockExternalApi.scrapeOpportunity).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 0,
        errors: 0,
      });

      // Verify exponential backoff timing (roughly 1s, 2s, 4s delays)
      expect(duration).toBeGreaterThan(6000); // Total delay should be > 6 seconds
      expect(duration).toBeLessThan(8000); // But < 8 seconds
    });

    it('stops retrying after max attempts', async () => {
      vi.useFakeTimers();

      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      // Mock API that always fails
      mockExternalApi.scrapeOpportunity.mockRejectedValue(new Error('Permanent failure'));

      const startTime = Date.now();
      const result = await ingestionPipeline.processOpportunities(opportunities);
      await vi.runAllTimersAsync();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have retried max attempts (e.g., 3 times)
      expect(mockExternalApi.scrapeOpportunity).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        created: 0,
        updated: 0,
        duplicates: 0,
        errors: 1,
      });

      // Verify total retry duration
      expect(duration).toBeGreaterThan(6000); // Roughly 1s + 2s + 4s = 7s
      expect(duration).toBeLessThan(8000);
    });

    it('does not retry on permanent failures', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      // Mock API that returns permanent error
      mockExternalApi.scrapeOpportunity.mockRejectedValue(new Error('404 Not Found'));

      const result = await ingestionPipeline.processOpportunities(opportunities);

      // Should not retry on 404
      expect(mockExternalApi.scrapeOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 0,
        updated: 0,
        duplicates: 0,
        errors: 1,
      });
    });
  });

  // -------------------------------------------------------
  // Async Ingestion Race Conditions
  // -------------------------------------------------------

  describe('Async Ingestion Race Conditions', () => {
    it('handles concurrent ingestion of same opportunity', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      // Mock database insert that resolves after a delay
      mockDatabase.insertOpportunity.mockImplementation(async (opportunity: any) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { id: 'opp-001', ...opportunity };
      });

      // Simulate concurrent ingestion
      const promises = [
        ingestionPipeline.processOpportunities(opportunities),
        ingestionPipeline.processOpportunities(opportunities),
      ];

      const results = await Promise.all(promises);

      // Should only create one record, second should detect duplicate
      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(results).toEqual([
        { created: 1, updated: 0, duplicates: 0, errors: 0 },
        { created: 0, updated: 0, duplicates: 1, errors: 0 },
      ]);
    });

    it('handles concurrent updates correctly', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      // Mock database that initially has the opportunity, then gets updated
      mockDatabase.getOpportunityByExternalRef.mockResolvedValue({
        id: 'opp-001',
        external_ref: 'SAM-2025-001',
        title: 'Old Title',
        agency: 'DoD',
        source: 'sam_gov',
        posted_date: '2025-01-15',
        due_date: '2025-03-01',
      });

      mockDatabase.updateOpportunity.mockImplementation(async (id: string, updates: any) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { id, ...updates };
      });

      // Simulate concurrent updates
      const promises = [
        ingestionPipeline.processOpportunities(opportunities),
        ingestionPipeline.processOpportunities(opportunities),
      ];

      const results = await Promise.all(promises);

      // Should update the opportunity once
      expect(mockDatabase.updateOpportunity).toHaveBeenCalledTimes(1);
      expect(results).toEqual([
        { created: 0, updated: 1, duplicates: 0, errors: 0 },
        { created: 0, updated: 0, duplicates: 0, errors: 0 }, // Second sees it's being updated
      ]);
    });

    it('handles simultaneous ingestion from different sources', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity from SAM.gov',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity from GovCon',
          agency: 'Department of Defense',
          source: 'govcon',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
        },
      ];

      const promises = [
        ingestionPipeline.processOpportunities([opportunities[0]]),
        ingestionPipeline.processOpportunities([opportunities[1]]),
      ];

      const results = await Promise.all(promises);

      // Should handle both, but only create one record
      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(results).toEqual([
        { created: 1, updated: 0, duplicates: 0, errors: 0 },
        { created: 0, updated: 0, duplicates: 1, errors: 0 },
      ]);
    });
  });

  // -------------------------------------------------------
  // Data Validation and Sanitization
  // -------------------------------------------------------

  describe('Data Validation and Sanitization', () => {
    it('sanitizes HTML in description fields', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
          description: '<script>alert("XSS")</script> <b>Important</b> opportunity',
        },
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 0,
        errors: 0,
      });

      const insertedOpportunity = mockDatabase.insertOpportunity.mock.calls[0][0];
      expect(insertedOpportunity.description).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt; <b>Important</b> opportunity'
      );
      // Script tags should be escaped, but allowed HTML like <b> should remain
    });

    it('validates date formats', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: 'invalid-date', // Invalid date
          due_date: '2025-03-01',
        },
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 0,
        errors: 0,
      });

      const insertedOpportunity = mockDatabase.insertOpportunity.mock.calls[0][0];
      expect(insertedOpportunity.posted_date).toBeNull(); // Invalid dates become null
    });

    it('validates numeric fields', async () => {
      const opportunities = [
        {
          external_ref: 'SAM-2025-001',
          title: 'Opportunity',
          agency: 'Department of Defense',
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01',
          estimated_value: 'invalid-number', // Invalid number
        },
      ];

      const result = await ingestionPipeline.processOpportunities(opportunities);

      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        created: 1,
        updated: 0,
        duplicates: 0,
        errors: 0,
      });

      const insertedOpportunity = mockDatabase.insertOpportunity.mock.calls[0][0];
      expect(insertedOpportunity.estimated_value).toBeNull(); // Invalid numbers become null
    });
  });

  // Meta-cognitive debug protocol tags used:
  // [DATA_CORRUPTION] - Data validation and sanitization
  // [RACE_CONDITION] - Concurrent ingestion handling
  // [EXTERNAL_DEPENDENCY] - External API mocking
  // [ASYNC_TIMING] - Exponential backoff timing
});

// Mock ingestion pipeline for testing
export const ingestionPipeline = {
  mockExternalApi: () => ({
    scrapeOpportunity: vi.fn(),
    secondaryScrape: vi.fn(),
    tertiaryScrape: vi.fn(),
  }),
  mockDatabase: () => ({
    insertOpportunity: vi.fn(),
    getOpportunityByExternalRef: vi.fn(),
    updateOpportunity: vi.fn(),
  }),
  processOpportunities: vi.fn(async (opportunities: any[]) => {
    // Implementation would be here
    return { created: opportunities.length, updated: 0, duplicates: 0, errors: 0 };
  }),
};
