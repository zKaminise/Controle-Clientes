import { describe, expect, it } from 'vitest';
import {
  clientCompleteness,
  conversionFields,
  domainReminderPriority,
  isActiveProspect,
  nextPostSaleAt,
  simpleProspectingStage,
  SIMPLE_TO_CANONICAL_STATUS,
  shouldSurfaceDeferredLead,
} from '@/lib/customer-experience';

describe('experiência simplificada do CRM', () => {
  it('agrupa os 21 estados legados sem perder o estado persistido', () => {
    expect(simpleProspectingStage('CONTATO_WHATSAPP')).toBe('waiting');
    expect(simpleProspectingStage('NEGOCIACAO')).toBe('proposal');
    expect(simpleProspectingStage('FOLLOWUP_FUTURO')).toBe('later');
    expect(simpleProspectingStage('EMAIL_INVALIDO')).toBe('lost');
    expect(SIMPLE_TO_CANONICAL_STATUS.won).toBe('FECHADO');
  });

  it('calcula completude somente com campos úteis ao atendimento', () => {
    expect(
      clientCompleteness({
        company: {
          name: 'Cliente',
          email: 'cliente@example.com',
          primaryContactName: 'Ana',
          website: 'https://example.com',
          nextContactAt: '2026-12-01T12:00:00Z',
        },
        hasDeliveredProject: true,
        hasDomainOrHosting: true,
        hasMaintenanceDecision: true,
        hasHistory: true,
      }),
    ).toBe(100);
  });

  it('não trata cliente entregue como lead ativo e converte o mesmo registro', () => {
    expect(isActiveProspect('client')).toBe(false);
    expect(isActiveProspect('lead')).toBe(true);
    expect(conversionFields('FECHADO')).toEqual({
      lifecycleStatus: 'client',
      relationshipStatus: 'active_non_recurring',
    });
  });

  it('calcula pós-venda e prioridade de domínio pelas configurações', () => {
    expect(
      nextPostSaleAt(new Date('2026-01-01T12:00:00Z'), 90).toISOString(),
    ).toBe('2026-04-01T12:00:00.000Z');
    expect(domainReminderPriority('client', 30)).toBe('high');
    expect(domainReminderPriority('me', 30)).toBe('urgent');
  });

  it('faz Retomar Depois voltar à atenção somente na data correta', () => {
    expect(
      shouldSurfaceDeferredLead({
        prospectingStatus: 'FOLLOWUP_FUTURO',
        nextActionAt: new Date('2026-09-10T12:00:00Z'),
        until: new Date('2026-09-10T12:00:00Z'),
      }),
    ).toBe(true);
    expect(
      shouldSurfaceDeferredLead({
        prospectingStatus: 'FOLLOWUP_FUTURO',
        nextActionAt: new Date('2026-12-10T12:00:00Z'),
        until: new Date('2026-09-10T12:00:00Z'),
      }),
    ).toBe(false);
  });
});
