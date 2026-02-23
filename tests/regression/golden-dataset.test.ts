import { describe, it, expect } from 'vitest';
import { goldenDataset } from '../mocks/golden-dataset.mock';

describe('Regression - Golden Dataset', () => {
  it('matches golden dataset for parsed opportunities', async () => {
    const current = await goldenDataset.loadCurrentParsedOpportunities();
    const golden = await goldenDataset.loadGoldenParsedOpportunities();

    const diff = goldenDataset.diffOpportunities(current, golden);

    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.changed.length).toBe(0);
  });

  it('validates API response schema against snapshot', async () => {
    const response = await goldenDataset.fetchCurrentApiResponse();
    const validation = goldenDataset.validateApiSchema(response);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('ensures HTML parsing stays consistent', async () => {
    const html = await goldenDataset.loadGoldenHtmlFixture();
    const parsed = await goldenDataset.parseHtml(html);
    const expected = await goldenDataset.loadGoldenParsedFromHtml();

    expect(parsed).toEqual(expected);
  });

  it('detects feature parity regressions', async () => {
    const currentFeatures = await goldenDataset.getCurrentFeatureFlags();
    const goldenFeatures = await goldenDataset.getGoldenFeatureFlags();

    const parity = goldenDataset.compareFeatureParity(currentFeatures, goldenFeatures);

    expect(parity.missing).toEqual([]);
    expect(parity.unexpected).toEqual([]);
  });
});

