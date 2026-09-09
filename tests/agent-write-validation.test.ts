import { describe, expect, it } from 'vitest';
import {
  agentCreateInteractionSchema,
  agentCreateLeadSchema,
  agentIdempotencyKeySchema,
  agentSetLeadStageSchema,
  agentUpsertDigitalAnalysisSchema,
} from '@/lib/agent-write-validation';

describe('contratos de escrita do agente', () => {
  it('normaliza campos de lead e rejeita campos administrativos', () => {
    const lead = agentCreateLeadSchema.parse({
      name: ' Empresa Exemplo ',
      state: 'sp',
      email: 'contato@example.com',
    });
    expect(lead).toMatchObject({ name: 'Empresa Exemplo', state: 'SP' });
    expect(() =>
      agentCreateLeadSchema.parse({ name: 'Empresa', ownerUserId: 'outro' }),
    ).toThrow();
  });

  it('exige timestamp com offset para concorrência otimista', () => {
    expect(() =>
      agentSetLeadStageSchema.parse({
        expectedUpdatedAt: '2026-09-09T10:00:00',
        prospectingStatus: 'INTERESSADO',
      }),
    ).toThrow();
    expect(
      agentSetLeadStageSchema.parse({
        expectedUpdatedAt: '2026-09-09T10:00:00-03:00',
        prospectingStatus: 'INTERESSADO',
      }).expectedUpdatedAt,
    ).toBeInstanceOf(Date);
  });

  it('exige próxima ação e data juntas em contatos', () => {
    expect(() =>
      agentCreateInteractionSchema.parse({
        companyId: '11111111-1111-4111-8111-111111111111',
        type: 'whatsapp',
        content: 'Contato realizado.',
        nextAction: 'Retornar',
      }),
    ).toThrow(/juntos/);
  });

  it('aceita análise parcial e proíbe payload vazio', () => {
    expect(agentUpsertDigitalAnalysisSchema.parse({ hasSite: false })).toEqual({ hasSite: false });
    expect(() => agentUpsertDigitalAnalysisSchema.parse({})).toThrow();
  });

  it('limita o formato da chave idempotente', () => {
    expect(agentIdempotencyKeySchema.parse('agent-call:2026-09-09:001')).toBe(
      'agent-call:2026-09-09:001',
    );
    expect(() => agentIdempotencyKeySchema.parse('curta')).toThrow();
    expect(() => agentIdempotencyKeySchema.parse('chave com espaços')).toThrow();
  });
});

