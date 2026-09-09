import { describe, expect, it } from 'vitest';
import { agentAddProspectingCandidateSchema } from '@/lib/agent-prospecting-validation';

describe('validação da pesquisa assistida', () => {
  it('exige uma fonte pública verificável', () => {
    const result = agentAddProspectingCandidateSchema.safeParse({
      batchId: '11111111-1111-4111-8111-111111111111',
      companyName: 'Empresa Exemplo',
      evidence: [],
    });
    expect(result.success).toBe(false);
  });

  it('aceita contato empresarial público com evidência', () => {
    const result = agentAddProspectingCandidateSchema.safeParse({
      batchId: '11111111-1111-4111-8111-111111111111',
      companyName: 'Empresa Exemplo',
      website: 'https://example.com',
      publicEmail: 'contato@example.com',
      evidence: [
        { url: 'https://example.com/contato', label: 'Página de contato' },
      ],
      suggestedMessage: 'Mensagem apenas sugerida.',
    });
    expect(result.success).toBe(true);
  });
});
