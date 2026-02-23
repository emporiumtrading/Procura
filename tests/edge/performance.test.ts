import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performanceTesting } from '../mocks/performance.mock';

describe('Performance Testing - High-Volume Data Handling', () => {
  let mockDatabase: any;
  let mockRedis: any;
  let mockExternalApi: any;

  beforeEach(() => {
    mockDatabase = performanceTesting.mockDatabase();
    mockRedis = performanceTesting.mockRedis();
    mockExternalApi = performanceTesting.mockExternalApi();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -------------------------------------------------------
  // 10,000 Leads Ingestion Performance
  // -------------------------------------------------------

  describe('High-Volume Ingestion', () => {
    it('ingests 10,000 opportunities within performance limits', async () => {
      vi.useFakeTimers();
      
      // Generate 10,000 test opportunities
      const opportunities = Array.from({ length: 10000 }, (_, i) => ({
        external_ref: `SAM-${i}`,
        title: `Opportunity ${i}`,
        agency: `Agency ${i % 10}`,
        source: 'sam_gov',
        posted_date: '2025-01-15',
        due_date: '2025-03-01',
        description: `Description for opportunity ${i}`,
        naics_code: '541512',
        estimated_value: 500000 + i
      }));

      // Mock database operations with realistic timing
      let insertCount = 0;
      mockDatabase.insertOpportunity.mockImplementation(async (opportunity: any) => {
        insertCount++;
        // Simulate database insert time (average 2ms per record)
        await new Promise(resolve => setTimeout(resolve, 2));
        return { id: `opp-${insertCount}`, ...opportunity };
      });

      // Mock deduplication check
      mockDatabase.getOpportunityByExternalRef.mockImplementation(async (ref: string) => {
        // Simulate database query time (average 1ms)
        await new Promise(resolve => setTimeout(resolve, 1));
        return null; // No duplicates for this test
      });

      const startTime = Date.now();
      const result = await performanceTesting.ingestOpportunities(opportunities);
      await vi.runAllTimersAsync();
      const endTime = Date.now();

      const duration = endTime - startTime;
      
      // Performance expectations:
      // - Total time should be < 60 seconds (10,000 records at 2ms each = 20 seconds, plus overhead)
      // - Throughput should be > 100 records/second
      expect(duration).toBeLessThan(60000); // 60 seconds max
      expect(result.created).toBe(10000);
      expect(result.throughput).toBeGreaterThan(100); // Records per second
      
      // Verify database operations were called correctly
      expect(mockDatabase.insertOpportunity).toHaveBeenCalledTimes(10000);
      expect(mockDatabase.getOpportunityByExternalRef).toHaveBeenCalledTimes(10000);
    });

    it('handles 10,000 opportunities with mixed duplicates', async () => {
      vi.useFakeTimers();
      
      // Generate 10,000 opportunities with 20% duplicates
      const opportunities = [];
      for (let i = 0; i < 10000; i++) {
        const isDuplicate = i % 5 < 1; // 20% chance of duplicate
        opportunities.push({
          external_ref: isDuplicate ? `SAM-${i % 100}` : `SAM-${i}`,
          title: `Opportunity ${i}`,
          agency: `Agency ${i % 10}`,
          source: 'sam_gov',
          posted_date: '2025-01-15',
          due_date: '2025-03-01'
        });
      }

      // Mock database operations
      let insertCount = 0;
      mockDatabase.insertOpportunity.mockImplementation(async (opportunity: any) => {
        insertCount++;
        await new Promise(resolve => setTimeout(resolve, 2));
        return { id: `opp-${insertCount}`, ...opportunity };
      });

      mockDatabase.getOpportunityByExternalRef.mockImplementation(async (ref: string) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        // Simulate existing records for duplicates
        if (ref.includes('SAM-10') || ref.includes('SAM-20')) {
          return { id: 'existing', external_ref: ref };
        }
        return null;
      });

      const startTime = Date.now();
      const result = await performanceTesting.ingestOpportunities(opportunities);
      await vi.runAllTimersAsync();
      const endTime = Date.now();

      const duration = endTime - startTime;
      
      // Expect roughly 8,000 new records (20% duplicates)
      expect(result.created).toBeGreaterThan(7000);
      expect(result.created).toBeLessThan(9000);
      expect(result.duplicates).toBeGreaterThan(1000);
      expect(result.duplicates).toBeLessThan(3000);
      expect(duration).toBeLessThan(60000);
    });

    it('maintains data integrity with 10,000 records', async () => {
      // Generate 10,000 unique opportunities
      const opportunities = Array.from({ length: 10000 }, (_, i) => ({
        external_ref: `SAM-${i}`,
        title: `Opportunity ${i}`,
        agency: `Agency ${i % 10}`,
        source: 'sam_gov',
        posted_date: '2025-01-15',
        due_date: '2025-03-01'
      }));

      // Mock database with verification
      const insertedRecords = new Map();
      mockDatabase.insertOpportunity.mockImplementation(async (opportunity: any) => {
        // Simulate insertion
        const record = { id: `opp-${opportunity.external_ref}`, ...opportunity };
        insertedRecords.set(record.external_ref, record);
        return record;
      });

      mockDatabase.getOpportunityByExternalRef.mockImplementation(async (ref: string) => {
        return insertedRecords.get(ref) || null;
      });

      const result = await performanceTesting.ingestOpportunities(opportunities);
      
      // Verify all records were inserted correctly
      expect(result.created).toBe(10000);
      expect(insertedRecords.size).toBe(10000);
      
      // Verify data integrity
      for (let i = 0; i < 10000; i++) {
        const record = insertedRecords.get(`SAM-${i}`);
        expect(record).not.toBeNull();
        expect(record.external_ref).toBe(`SAM-${i}`);
        expect(record.title).toBe(`Opportunity ${i}`);
      }
    });
  });

  // -------------------------------------------------------
  // Memory Usage Under Load
  // -------------------------------------------------------

  describe('Memory Usage Testing', () => {
    it('manages memory efficiently with large datasets', async () => {
      // Test memory usage with streaming approach
      const chunkSize = 1000; // Process in chunks of 1000
      let totalProcessed = 0;
      
      // Mock streaming ingestion
      mockDatabase.insertOpportunity.mockImplementation(async (opportunity: any) => {
        totalProcessed++;
        // Simulate memory-efficient processing
        if (totalProcessed % chunkSize === 0) {
          // Simulate memory cleanup between chunks
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        return { id: `opp-${opportunity.external_ref}`, ...opportunity };
      });

      // Test with 50,000 records (5 chunks of 10,000)
      const opportunities = Array.from({ length: 50000 }, (_, i) => ({
        external_ref: `SAM-${i}`,
        title: `Opportunity ${i}`,
        agency: `Agency ${i % 10}`,
        source: 'sam_gov',
        posted_date: '2025-01-15',
        due_date: '2025-03-01'
      }));

      const result = await performanceTesting.ingestOpportunitiesInChunks(
        opportunities, 
        chunkSize
      );
      
      expect(result.created).toBe(50000);
      expect(totalProcessed).toBe(50000);
      
      // Verify chunking worked correctly
      expect(result.chunks_processed).toBe(50); // 50,000 / 1,000 = 50 chunks
    });

    it('handles memory pressure gracefully', async () => {
      // Simulate memory pressure by limiting available memory
      const memoryLimit = 100 * 1024 * 1024; // 100MB limit
      let currentMemoryUsage = 0;

      // Mock memory monitoring
      mockDatabase.getMemoryUsage.mockImplementation(() => currentMemoryUsage);
      
      // Mock opportunity processing with memory tracking
      mockDatabase.insertOpportunity.mockImplementation(async (opportunity: any) => {
        const recordSize = JSON.stringify(opportunity).length;
        currentMemoryUsage += recordSize;
        
        // Simulate memory cleanup
        if (currentMemoryUsage > memoryLimit) {
          currentMemoryUsage = 0; // Reset for test purposes
          await new Promise(resolve => setTimeout(resolve, 10)); // Simulate GC
        }
        
        return { id: `opp-${opportunity.external_ref}`, ...opportunity };
      });

      // Test with 20,000 records
      const opportunities = Array.from({ length: 20000 }, (_, i) => ({
        external_ref: `SAM-${i}`,
        title: `Opportunity ${i}`,
        agency: `Agency ${i % 10}`,
        source: 'sam_gov',
        posted_date: '2025-01-15',
        due_date: '2025-03-01'
      }));

      const result = await performanceTesting.ingestOpportunitiesWithMemoryMonitoring(
        opportunities, 
        memoryLimit
      );
      
      expect(result.created).toBe(20000);
      expect(result.memory_exceeded).toBeGreaterThan(0); // Should have exceeded at least once
      expect(result.memory_reclaimed).toBeGreaterThan(0); // Should have reclaimed memory
    });
  });

  // -------------------------------------------------------
  // Database Query Optimization
  // -------------------------------------------------------

  describe('Database Query Optimization', () => {
    it('optimizes bulk insert operations', async () => {
      // Test bulk insert vs individual inserts
      const opportunities = Array.from({ length: 1000 }, (_, i) => ({
        external_ref: `SAM-${i}`,
        title: `Opportunity ${i}`,
        agency: `Agency ${i % 10}`,
        source: 'sam_gov',
        posted_date: '2025-01-15',
        due_date: '2025-03-01'
      }));

      // Mock bulk insert
      mockDatabase.bulkInsertOpportunities.mockImplementation(async (ops: any[]) => {
        // Simulate bulk insert time (should be faster than individual inserts)
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms for 1000 records
        return ops.length;
      });

      // Mock individual insert
      let individualInsertCount = 0;
      mockDatabase.insertOpportunity.mockImplementation(async (opportunity: any) => {
        individualInsertCount++;
        await new Promise(resolve => setTimeout(resolve, 2)); // 2ms per record
        return { id: `opp-${opportunity.external_ref}`, ...opportunity };
      });

      const bulkStartTime = Date.now();
      const bulkResult = await performanceTesting.bulkInsertOpportunities(opportunities);
      const bulkDuration = Date.now() - bulkStartTime;

      const individualStartTime = Date.now();
      const individualResult = await performanceTesting.insertOpportunitiesIndividually(opportunities);
      const individualDuration = Date.now() - individualStartTime;

      // Bulk insert should be significantly faster
      expect(bulkResult.inserted).toBe(1000);
      expect(bulkDuration).toBeLessThan(individualDuration);
      expect(bulkDuration).toBeLessThan(500); // Should be < 500ms
      
      // Verify individual insert performance
      expect(individualResult.inserted).toBe(1000);
      expect(individualDuration).toBeGreaterThan(1000); // Should be > 1 second (2ms * 1000)
    });

    it('optimizes query performance with indexing', async () => {
      // Test query performance with and without indexes
      const testId = 'SAM-999999';
      
      // Mock slow query (without index)
      mockDatabase.getOpportunityByExternalRef.mockImplementation(async (ref: string) => {
        if (ref === testId) {
          // Simulate slow query (1 second without index)
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { id: 'opp-999999', external_ref: testId };
        }
        return null;
      });

      // Mock fast query (with index)
      mockDatabase.getOpportunityByExternalRefIndexed.mockImplementation(async (ref: string) => {
        if (ref === testId) {
          // Simulate fast query (1ms with index)
          await new Promise(resolve => setTimeout(resolve, 1));
          return { id: 'opp-999999', external_ref: testId };
        }
        return null;
      });

      const slowStartTime = Date.now();
      const slowResult = await performanceTesting.findOpportunityWithoutIndex(testId);
      const slowDuration = Date.now() - slowStartTime;

      const fastStartTime = Date.now();
      const fastResult = await performanceTesting.findOpportunityWithIndex(testId);
      const fastDuration = Date.now() - fastStartTime;

      // Indexed query should be significantly faster
      expect(slowResult).not.toBeNull();
      expect(fastResult).not.toBeNull();
      expect(fastDuration).toBeLessThan(slowDuration);
      expect(fastDuration).toBeLessThan(10); // Should be < 10ms
      expect(slowDuration).toBeGreaterThan(500); // Should be > 500ms
    });
  });

  // -------------------------------------------------------
  // Pagination Performance with Large Datasets
  // -------------------------------------------------------

  describe('Pagination Performance', () => {
    it('handles pagination efficiently with 100,000+ records', async () => {
      // Mock database with 100,000 records
      const totalRecords = 100000;
      const pageSize = 100;
      
      mockDatabase.getOpportunitiesCount.mockResolvedValue(totalRecords);
      
      // Mock paginated query
      mockDatabase.getOpportunitiesPaginated.mockImplementation(async (page: number, limit: number) => {
        const offset = (page - 1) * limit;
        const records = Array.from({ length: limit }, (_, i) => ({
          id: `opp-${offset + i}`,
          title: `Opportunity ${offset + i}`,
          agency: `Agency ${(offset + i) % 10}`,
          source: 'sam_gov',
          fit_score: 85
        }));
        
        // Simulate query time (should be fast with proper indexing)
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms per page
        
        return {
          data: records,
          total: totalRecords,
          page: page,
          limit: limit,
          total_pages: Math.ceil(totalRecords / limit)
        };
      });

      // Test pagination performance
      const pageTimes = [];
      const totalPages = Math.ceil(totalRecords / pageSize);
      
      for (let page = 1; page <= totalPages; page++) {
        const startTime = Date.now();
        const result = await performanceTesting.getOpportunitiesPage(page, pageSize);
        const duration = Date.now() - startTime;
        
        pageTimes.push(duration);
        
        expect(result.data.length).toBe(pageSize);
        expect(result.total).toBe(totalRecords);
        expect(result.page).toBe(page);
        expect(result.limit).toBe(pageSize);
        expect(result.total_pages).toBe(totalPages);
      }
      
      // Verify pagination performance is consistent
      const avgPageTime = pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length;
      expect(avgPageTime).toBeLessThan(100); // Average < 100ms per page
      expect(Math.max(...pageTimes)).toBeLessThan(200); // No page should take > 200ms
    });

    it('handles rapid pagination navigation', async () => {
      // Mock database with 50,000 records
      const totalRecords = 50000;
      const pageSize = 100;
      
      mockDatabase.getOpportunitiesCount.mockResolvedValue(totalRecords);
      
      // Mock paginated query with caching
      const cache = new Map();
      mockDatabase.getOpportunitiesPaginated.mockImplementation(async (page: number, limit: number) => {
        const cacheKey = `${page}-${limit}`;
        if (cache.has(cacheKey)) {
          // Return cached result immediately
          return cache.get(cacheKey);
        }
        
        const offset = (page - 1) * limit;
        const records = Array.from({ length: limit }, (_, i) => ({
          id: `opp-${offset + i}`,
          title: `Opportunity ${offset + i}`,
          agency: `Agency ${(offset + i) % 10}`,
          source: 'sam_gov',
          fit_score: 85
        }));
        
        const result = {
          data: records,
          total: totalRecords,
          page: page,
          limit: limit,
          total_pages: Math.ceil(totalRecords / limit)
        };
        
        cache.set(cacheKey, result);
        return result;
      });

      // Test rapid pagination navigation
      const navigationPattern = [1, 2, 3, 4, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
      
      for (const page of navigationPattern) {
        const startTime = Date.now();
        const result = await performanceTesting.getOpportunitiesPage(page, pageSize);
        const duration = Date.now() - startTime;
        
        // First access should be slower, subsequent should be faster
        if (page < 10) {
          expect(duration).toBeLessThan(100); // First 10 pages should be fast
        } else {
          expect(duration).toBeLessThan(50); // Subsequent pages should be faster due to caching
        }
        
        expect(result.data.length).toBe(pageSize);
      }
    });
  });

  // Meta-cognitive debug protocol tags used:
  // [PERFORMANCE] - Performance testing and optimization
  // [EXTERNAL_DEPENDENCY] - Database and external API mocking
  // [ASYNC_TIMING] - Timing and throughput measurements
  // [DATA_CORRUPTION] - Data integrity verification
});