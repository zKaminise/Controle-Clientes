import { z } from 'zod';
import { listLeads } from '@/lib/crm-service';
import { mutateApp } from '@/lib/app-service';
import { requireUser } from '@/lib/require-user';

const createSchema = z
  .object({
    company: z.record(z.string(), z.unknown()),
    digitalAnalysis: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

function status(error: unknown) {
  return error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 400;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = new URL(request.url).searchParams;
    return Response.json(
      await listLeads(user.id, {
        query: query.get('query') || undefined,
        industry: query.get('industry') || undefined,
        city: query.get('city') || undefined,
        state: query.get('state') || undefined,
        lifecycleStatus: query.get('lifecycleStatus') || undefined,
        prospectingStatus: query.get('prospectingStatus') || undefined,
        siteStatus: query.get('siteStatus') || undefined,
        priority: query.get('priority') || undefined,
        contactedBefore: query.get('contactedBefore') || undefined,
        noAction: query.get('noAction') === 'true',
        proposalPending: query.get('proposalPending') === 'true',
        page: Number(query.get('page') || 1),
        pageSize: Number(query.get('pageSize') || 25),
      }),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível listar os leads.',
      },
      { status: status(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createSchema.parse(await request.json());
    const company = await mutateApp(user.id, {
      action: 'create',
      entity: 'companies',
      data: input.company,
    });
    if (!('id' in company))
      throw new Error('Não foi possível identificar o lead criado.');
    if (input.digitalAnalysis) {
      await mutateApp(user.id, {
        action: 'create',
        entity: 'digitalAnalyses',
        data: { ...input.digitalAnalysis, companyId: company.id },
      });
    }
    return Response.json({ id: company.id }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível criar o lead.',
      },
      { status: status(error) },
    );
  }
}
