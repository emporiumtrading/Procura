import { vi } from 'vitest';

export const externalFailureTesting = {
  mockSupabase: () => ({
    db: {
      query: vi.fn(),
      isConnected: vi.fn(),
      cancelQuery: vi.fn()
    },
    cache: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn()
    }
  }),
  mockStripe: () => ({
    paymentIntents: {
      create: vi.fn(),
      confirm: vi.fn()
    },
    subscriptions: {
      create: vi.fn(),
      cancel: vi.fn()
    },
    webhooks: {
      constructEvent: vi.fn()
    },
    plans: {
      list: vi.fn()
    }
  }),
  mockExternalScrapers: () => ({
    scrapeSamGov: vi.fn(),
    scrapeGovCon: vi.fn(),
    authenticateWithSource: vi.fn(),
    useCachedData: vi.fn(),
    useFallbackParser: vi.fn()
  }),
  mockNetwork: () => ({
    isOnline: vi.fn(),
    getConnectionType: vi.fn(),
    canReachService: vi.fn(),
    reconnectServices: vi.fn()
  }),
  mockCircuitBreaker: () => ({
    isOpen: vi.fn(),
    isClosed: vi.fn(),
    getHalfOpen: vi.fn(),
    getFailureCount: vi.fn(),
    close: vi.fn(),
    closeAll: vi.fn()
  }),
  saveOpportunity: vi.fn(async (_opportunity: any) => ({})),
  getOpportunities: vi.fn(async () => ({})),
  getOpportunitiesWithRetry: vi.fn(async () => ({})),
  getOpportunitiesWithTimeout: vi.fn(async (_timeout: number) => ({})),
  processPayment: vi.fn(async (_payment: any) => ({})),
  createSubscription: vi.fn(async (_subscription: any) => ({})),
  processStripeWebhook: vi.fn(async (_payload: any, _signature: string) => ({})),
  listSubscriptionPlans: vi.fn(async () => ({})),
  scrapeAllSources: vi.fn(async () => ({})),
  scrapeSamGov: vi.fn(async () => ({})),
  scrapeGovCon: vi.fn(async () => ({})),
  authenticateWithSource: vi.fn(async (_source: string) => ({})),
  performAllOperations: vi.fn(async () => ({})),
  performOperationsWithPartialConnectivity: vi.fn(async () => ({})),
  monitorNetworkRecovery: vi.fn(async () => ({})),
  scrapeWithRetry: vi.fn(async () => ({})),
  scrapeWithMaxRetries: vi.fn(async (_maxRetries: number) => ({})),
  testHalfOpenCircuit: vi.fn(async () => ({})),
  performOperationAfterRecovery: vi.fn(async () => ({}))
};
