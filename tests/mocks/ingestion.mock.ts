import { vi } from 'vitest';

// Mock ingestion pipeline for testing lead ingestion functionality
export const ingestionPipeline = {
  mockExternalApi: () => ({
    scrapeOpportunity: vi.fn(),
    secondaryScrape: vi.fn(),
    tertiaryScrape: vi.fn()
  }),
  mockDatabase: () => ({
    insertOpportunity: vi.fn(),
    getOpportunityByExternalRef: vi.fn(),
    updateOpportunity: vi.fn(),
    bulkInsertOpportunities: vi.fn(),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn()
  }),
  processOpportunities: vi.fn(async (opportunities: any[]) => ({
    created: opportunities.length,
    updated: 0,
    duplicates: 0,
    errors: 0,
    throughput: 0
  })),
  processBatchWithTransaction: vi.fn(async (opportunities: any[]) => ({})),
  bulkInsertWithRetry: vi.fn(async (opportunities: any[]) => ({})),
  processBatchWithVerification: vi.fn(async (opportunities: any[]) => ({})),
  updateOpportunityConcurrently: vi.fn(async (id: string, updates: any) => ({})),
  bulkUpdateOpportunities: vi.fn(async (opportunities: any[], updates: any) => ({})),
  ingestOpportunities: vi.fn(async (opportunities: any[]) => ({})),
  ingestOpportunitiesInChunks: vi.fn(async (opportunities: any[], chunkSize: number) => ({})),
  ingestOpportunitiesWithMemoryMonitoring: vi.fn(async (opportunities: any[], memoryLimit: number) => ({})),
  sanitizeHtml: vi.fn(),
  validateDate: vi.fn(),
  validateNumeric: vi.fn(),
  normalizeDataFormats: vi.fn()
};