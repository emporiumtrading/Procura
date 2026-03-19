import { vi } from 'vitest';

type Opportunity = {
  id: string;
  external_ref: string;
  title: string;
  agency: string;
  source: string;
  fit_score: number;
};

type ApiResponse = {
  opportunities: Opportunity[];
  total: number;
};

export const goldenDataset = {
  loadCurrentParsedOpportunities: vi.fn<[], Promise<Opportunity[]>>(async () => {
    // In a real implementation this would query the current database/view.
    return [
      {
        id: 'opp-001',
        external_ref: 'SAM-001',
        title: 'Cloud Services',
        agency: 'DoD',
        source: 'sam_gov',
        fit_score: 90,
      },
    ];
  }),

  loadGoldenParsedOpportunities: vi.fn<[], Promise<Opportunity[]>>(async () => {
    // Static golden copy checked into the repo.
    return [
      {
        id: 'opp-001',
        external_ref: 'SAM-001',
        title: 'Cloud Services',
        agency: 'DoD',
        source: 'sam_gov',
        fit_score: 90,
      },
    ];
  }),

  diffOpportunities: vi.fn((current: Opportunity[], golden: Opportunity[]) => {
    const byId = (list: Opportunity[]) => new Map(list.map((o) => [o.id, o]));

    const currentMap = byId(current);
    const goldenMap = byId(golden);

    const added: Opportunity[] = [];
    const removed: Opportunity[] = [];
    const changed: { id: string; before: Opportunity; after: Opportunity }[] = [];

    for (const [id, g] of goldenMap) {
      const c = currentMap.get(id);
      if (!c) {
        removed.push(g);
      } else if (JSON.stringify(c) !== JSON.stringify(g)) {
        changed.push({ id, before: g, after: c });
      }
    }

    for (const [id, c] of currentMap) {
      if (!goldenMap.has(id)) {
        added.push(c);
      }
    }

    return { added, removed, changed };
  }),

  fetchCurrentApiResponse: vi.fn<[], Promise<ApiResponse>>(async () => {
    return {
      opportunities: await goldenDataset.loadCurrentParsedOpportunities(),
      total: 1,
    };
  }),

  validateApiSchema: vi.fn((response: ApiResponse) => {
    const errors: string[] = [];

    if (!Array.isArray(response.opportunities)) {
      errors.push('opportunities must be an array');
    }

    for (const opp of response.opportunities) {
      if (typeof opp.id !== 'string') errors.push('id must be string');
      if (typeof opp.title !== 'string') errors.push('title must be string');
      if (typeof opp.fit_score !== 'number') errors.push('fit_score must be number');
    }

    return { valid: errors.length === 0, errors };
  }),

  loadGoldenHtmlFixture: vi.fn<[], Promise<string>>(async () => {
    // Minimal representative HTML used for parser regression.
    return `
      <html>
        <body>
          <div class="opportunity" data-id="opp-001">
            <h1 class="title">Cloud Services</h1>
            <span class="agency">DoD</span>
            <span class="fit-score">90</span>
          </div>
        </body>
      </html>
    `;
  }),

  parseHtml: vi.fn(async (html: string) => {
    // Extremely simplified parser for regression purposes.
    const titleMatch = html.match(/class="title">([^<]+)<\/h1>/);
    const agencyMatch = html.match(/class="agency">([^<]+)<\/span>/);
    const scoreMatch = html.match(/class="fit-score">([^<]+)<\/span>/);

    return [
      {
        id: 'opp-001',
        external_ref: 'SAM-001',
        title: titleMatch ? titleMatch[1] : '',
        agency: agencyMatch ? agencyMatch[1] : '',
        source: 'sam_gov',
        fit_score: scoreMatch ? Number(scoreMatch[1]) : 0,
      },
    ];
  }),

  loadGoldenParsedFromHtml: vi.fn<[], Promise<Opportunity[]>>(async () => {
    return [
      {
        id: 'opp-001',
        external_ref: 'SAM-001',
        title: 'Cloud Services',
        agency: 'DoD',
        source: 'sam_gov',
        fit_score: 90,
      },
    ];
  }),

  getCurrentFeatureFlags: vi.fn<[], Promise<string[]>>(async () => {
    return ['auth', 'ingestion', 'filtering', 'export'];
  }),

  getGoldenFeatureFlags: vi.fn<[], Promise<string[]>>(async () => {
    return ['auth', 'ingestion', 'filtering', 'export'];
  }),

  compareFeatureParity: vi.fn((current: string[], golden: string[]) => {
    const currentSet = new Set(current);
    const goldenSet = new Set(golden);

    const missing = [...goldenSet].filter((f) => !currentSet.has(f));
    const unexpected = [...currentSet].filter((f) => !goldenSet.has(f));

    return { missing, unexpected };
  }),
};
