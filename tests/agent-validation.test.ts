import { describe, expect, it } from 'vitest';
import {
  agentAttentionQuerySchema,
  agentLeadSearchSchema,
  agentMetricsQuerySchema,
  strictSearchParams,
} from '@/lib/agent-validation';

describe('agent query validation', () => {
  it('rejects unknown and repeated query fields', () => {
    expect(() => agentLeadSearchSchema.parse({ hidden: 'true' })).toThrow();
    expect(() =>
      strictSearchParams(
        new Request('https://example.test/api/agent/v1/leads?page=1&page=2'),
      ),
    ).toThrow('Parâmetro repetido');
  });

  it('limits pagination and normalizes state', () => {
    expect(() => agentLeadSearchSchema.parse({ pageSize: '101' })).toThrow();
    expect(agentLeadSearchSchema.parse({ state: 'sp' })).toMatchObject({
      state: 'SP',
      page: 1,
      pageSize: 25,
    });
  });

  it('requires an ordered attention range', () => {
    expect(() =>
      agentAttentionQuerySchema.parse({ from: '2026-09-09', to: '2026-09-08' }),
    ).toThrow('A data inicial deve ser anterior');
  });

  it('defaults commercial metrics to the São Paulo current month', () => {
    const parsed = agentMetricsQuerySchema.parse({});
    expect(parsed.timezone).toBe('America/Sao_Paulo');
    expect(parsed.from.slice(0, 8)).toBe(parsed.to.slice(0, 8));
    expect(parsed.comparePrevious).toBe(false);
  });
});
