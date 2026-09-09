import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listLeads: vi.fn(),
  getLeadDetails: vi.fn(),
  getTodayFollowUps: vi.fn(),
  getAppData: vi.fn(),
  mutateApp: vi.fn(),
}));

vi.mock('@/lib/require-user', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/crm-service', () => ({
  listLeads: mocks.listLeads,
  getLeadDetails: mocks.getLeadDetails,
  getTodayFollowUps: mocks.getTodayFollowUps,
}));
vi.mock('@/lib/app-service', () => ({
  getAppData: mocks.getAppData,
  mutateApp: mocks.mutateApp,
}));

import { GET as getLeads } from '@/app/api/crm/leads/route';
import { GET as getLead } from '@/app/api/crm/leads/[id]/route';
import { GET as getFollowUps } from '@/app/api/crm/follow-ups/route';
import { GET as getPipeline } from '@/app/api/crm/pipeline/route';
import { POST as postInteraction } from '@/app/api/crm/interactions/route';

const id = '11111111-1111-4111-8111-111111111111';

describe('existing CRM API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: 'admin-id' });
  });

  it('keeps the lead listing response and pagination contract', async () => {
    mocks.listLeads.mockResolvedValue({
      items: [{ id, name: 'Empresa' }],
      pagination: { page: 2, pageSize: 10, total: 11, pages: 2 },
    });
    const response = await getLeads(
      new Request('https://example.test/api/crm/leads?page=2&pageSize=10'),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{ id, name: 'Empresa' }],
      pagination: { page: 2, pageSize: 10, total: 11, pages: 2 },
    });
    expect(mocks.listLeads).toHaveBeenCalledWith(
      'admin-id',
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
  });

  it('keeps lead detail success and not-found contracts', async () => {
    mocks.getLeadDetails.mockResolvedValueOnce({
      company: { id, name: 'Empresa' },
      digitalAnalysis: null,
      interactions: [],
      tasks: [],
      opportunities: [],
      referrals: [],
      pipelineHistory: [],
    });
    const response = await getLead(
      new Request(`https://example.test/api/crm/leads/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      company: { id, name: 'Empresa' },
      digitalAnalysis: null,
    });

    mocks.getLeadDetails.mockRejectedValueOnce(
      new Error('Lead não encontrado.'),
    );
    const missing = await getLead(
      new Request(`https://example.test/api/crm/leads/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      error: 'Lead não encontrado.',
    });
  });

  it('keeps follow-up group names and status code', async () => {
    mocks.getTodayFollowUps.mockResolvedValue({
      overdue: [],
      today: [{ id: 'task-1' }],
      upcoming: [],
      leadsWithoutAction: [],
    });
    const response = await getFollowUps();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      overdue: [],
      today: [{ id: 'task-1' }],
      upcoming: [],
      leadsWithoutAction: [],
    });
  });

  it('keeps the pipeline response projection', async () => {
    mocks.getAppData.mockResolvedValue({
      pipelineStages: [{ id: 'stage-1' }],
      opportunities: [{ id: 'opportunity-1' }],
      pipelineHistory: [{ id: 'history-1' }],
      companies: [{ id }],
    });
    const response = await getPipeline();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      stages: [{ id: 'stage-1' }],
      opportunities: [{ id: 'opportunity-1' }],
      history: [{ id: 'history-1' }],
    });
  });

  it('keeps interaction creation at HTTP 201', async () => {
    mocks.mutateApp.mockResolvedValue({ id: 'interaction-1' });
    const response = await postInteraction(
      new Request('https://example.test/api/crm/interactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ companyId: id, type: 'email' }),
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: 'interaction-1' });
  });

  it('keeps current APIs session-protected with the legacy error shape', async () => {
    mocks.requireUser.mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    const response = await getLeads(
      new Request('https://example.test/api/crm/leads'),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'UNAUTHORIZED' });
  });
});
