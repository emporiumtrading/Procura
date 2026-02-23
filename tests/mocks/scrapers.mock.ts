import { vi } from 'vitest';

export const scrapersMock = {
  mockSamGovHtml: `
    <html>
      <body>
        <div class="opportunity" data-id="opp-001">
          <h1>Cloud Services</h1>
          <span class="agency">DoD</span>
        </div>
      </body>
    </html>
  `,

  mockGovConHtml: `
    <html>
      <body>
        <div class="opportunity" data-id="opp-002">
          <h1>Network Modernization</h1>
          <span class="agency">DHS</span>
        </div>
      </body>
    </html>
  `,

  createSamGovClient: () => ({
    fetchHtml: vi.fn(async () => scrapersMock.mockSamGovHtml),
    parseHtml: vi.fn(async (html: string) => [
      {
        id: 'opp-001',
        title: 'Cloud Services',
        agency: 'DoD',
        source: 'sam_gov'
      }
    ])
  }),

  createGovConClient: () => ({
    fetchHtml: vi.fn(async () => scrapersMock.mockGovConHtml),
    parseHtml: vi.fn(async (html: string) => [
      {
        id: 'opp-002',
        title: 'Network Modernization',
        agency: 'DHS',
        source: 'govcon'
      }
    ])
  }),

  withRateLimiting: vi.fn(async <T>(fn: () => Promise<T>) => {
    return fn();
  })
};

