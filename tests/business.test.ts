import { describe, expect, it } from 'vitest';
import {
  billingPeriod,
  crossedDomainThresholds,
  domainTaskKey,
  initialChargeStatus,
  isoDateInTimeZone,
  minorUnitsToMoney,
  moneyToMinorUnits,
  nextPostSaleDate,
  proposalStatusTimestamps,
  nextSubscriptionDate,
  normalizeBrazilianPhone,
  pipelineTransition,
  shouldMarkOverdue,
  subscriptionDatesThroughHorizon,
} from '@/lib/business';
import { renderTemplate } from '@/lib/email-templates';

describe('billing periods and recurrence', () => {
  it('uses a stable YYYY-MM billing period', () =>
    expect(billingPeriod('2026-08-10')).toBe('2026-08'));
  it('clamps day 31 to February instead of overflowing', () => {
    expect(
      nextSubscriptionDate({
        currentDate: '2027-01-31',
        frequency: 'monthly',
        billingDay: 31,
      }),
    ).toBe('2027-02-28');
  });
  it('supports leap years and annual recurrence', () => {
    expect(
      nextSubscriptionDate({
        currentDate: '2024-02-29',
        frequency: 'annual',
        billingDay: 29,
      }),
    ).toBe('2025-02-28');
  });
  it('generates each cycle independently of payment state', () => {
    expect(
      subscriptionDatesThroughHorizon({
        nextChargeDate: '2026-08-10',
        horizon: '2026-10-10',
        frequency: 'monthly',
        billingDay: 10,
      }),
    ).toEqual({
      dates: ['2026-08-10', '2026-09-10', '2026-10-10'],
      nextDate: '2026-11-10',
    });
  });
  it('classifies new and overdue charges deterministically', () => {
    expect(initialChargeStatus('2026-08-30', '2026-08-29')).toBe('scheduled');
    expect(initialChargeStatus('2026-08-29', '2026-08-29')).toBe('pending');
    expect(shouldMarkOverdue('2026-08-28', '2026-08-29', 'pending')).toBe(true);
    expect(shouldMarkOverdue('2026-08-28', '2026-08-29', 'paid')).toBe(false);
  });
});

describe('automation idempotency inputs', () => {
  it('returns every crossed domain threshold so missed daily runs recover safely', () => {
    expect(
      crossedDomainThresholds(
        '2026-10-01',
        '2026-09-16',
        [60, 30, 15, 7, 3, 0],
      ),
    ).toEqual([60, 30, 15]);
  });
  it('calculates post-sale cadence with month-end clamping', () =>
    expect(nextPostSaleDate('2026-08-31', 6)).toBe('2027-02-28'));

  it('records proposal lifecycle timestamps without replacing existing dates', () => {
    const now = new Date('2026-08-30T12:00:00.000Z');
    expect(proposalStatusTimestamps({ status: 'sent', now })).toEqual({
      sentAt: now,
    });
    expect(
      proposalStatusTimestamps({
        status: 'accepted',
        now,
        existing: { sentAt: new Date('2026-08-20T12:00:00.000Z') },
      }),
    ).toEqual({ acceptedAt: now });
    expect(
      proposalStatusTimestamps({
        status: 'negotiation',
        now,
        existing: { sentAt: new Date('2026-08-20T12:00:00.000Z') },
      }),
    ).toEqual({});
  });
  it('creates a stable unique key per domain threshold', () =>
    expect(domainTaskKey('domain-1', '2026-10-01', 15)).toBe(
      'domain:domain-1:2026-10-01:15',
    ));
  it('uses the operational São Paulo date at UTC boundaries', () =>
    expect(isoDateInTimeZone(new Date('2026-08-30T01:00:00Z'))).toBe(
      '2026-08-29',
    ));
});

describe('pipeline and formatting rules', () => {
  it('persists won_at and promotes the company', () => {
    const now = new Date('2026-08-29T12:00:00Z');
    expect(
      pipelineTransition({ isWon: true, isLost: false, now }),
    ).toMatchObject({ wonAt: now, lostAt: null, companyLifecycle: 'client' });
  });
  it('persists lost_at and the reported reason', () => {
    const now = new Date('2026-08-29T12:00:00Z');
    expect(
      pipelineTransition({
        isWon: false,
        isLost: true,
        now,
        lostReason: 'Orçamento',
      }),
    ).toMatchObject({ wonAt: null, lostAt: now, lostReason: 'Orçamento' });
  });
  it('stores currency without binary floating-point persistence', () => {
    expect(moneyToMinorUnits('1.234,56')).toBe(123456);
    expect(minorUnitsToMoney(123456)).toBe('1234.56');
  });
  it('normalizes Brazilian WhatsApp numbers', () =>
    expect(normalizeBrazilianPhone('(11) 98765-4321')).toBe('5511987654321'));
  it('renders supported variables and preserves unknown ones', () =>
    expect(
      renderTemplate('Olá {{nome}} — {{outro}}', { nome: 'Gabriel' }),
    ).toBe('Olá Gabriel — {{outro}}'));
});
