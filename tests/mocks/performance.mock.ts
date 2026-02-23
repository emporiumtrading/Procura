import { vi } from 'vitest';

export const performanceTesting = {
  mockDatabase: () => ({
    insertOpportunity: vi.fn(),
    getOpportunityByExternalRef: vi.fn(),
    bulkInsertOpportunities: vi.fn(),
    getOpportunitiesCount: vi.fn(),
    getOpportunitiesPaginated: vi.fn(),
    getMemoryUsage: vi.fn(),
    updateOpportunity: vi.fn(),
    getOpportunityByExternalRefIndexed: vi.fn()
  }),
  mockRedis: () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn()
  }),
  mockExternalApi: () => ({
    scrapeOpportunity: vi.fn(),
    getOpportunities: vi.fn()
  }),
  ingestOpportunities: vi.fn(async (opportunities: any[]) => ({
    created: opportunities.length,
    updated: 0,
    duplicates: 0,
    errors: 0,
    throughput: 0
  })),
  ingestOpportunitiesInChunks: vi.fn(async (opportunities: any[], chunkSize: number) => ({
    created: opportunities.length,
    chunks_processed: Math.ceil(opportunities.length / chunkSize)
  })),
  ingestOpportunitiesWithMemoryMonitoring: vi.fn(async (opportunities: any[], _memoryLimit: number) => ({
    created: opportunities.length,
    memory_exceeded: 0,
    memory_reclaimed: 0
  })),
  bulkInsertOpportunities: vi.fn(async (opportunities: any[]) => ({
    inserted: opportunities.length
  })),
  insertOpportunitiesIndividually: vi.fn(async (opportunities: any[]) => ({
    inserted: opportunities.length
  })),
  findOpportunityWithoutIndex: vi.fn(async (_id: string) => ({})),
  findOpportunityWithIndex: vi.fn(async (_id: string) => ({})),
  getOpportunitiesPage: vi.fn(async (_page: number, _limit: number) => ({
    data: [],
    total: 0,
    page: 1,
    limit: 10,
    total_pages: 1
  }))
};
