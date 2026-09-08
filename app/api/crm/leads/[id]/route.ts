import { z } from 'zod';
import { mutateApp } from '@/lib/app-service';
import { getLeadDetails } from '@/lib/crm-service';
import { requireUser } from '@/lib/require-user';

const updateSchema = z
  .object({
    company: z.record(z.string(), z.unknown()).optional(),
    digitalAnalysis: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine(
    (input) => input.company || input.digitalAnalysis,
    'Nenhuma alteração informada.',
  );

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return Response.json(
      await getLeadDetails(user.id, z.string().uuid().parse(id)),
    );
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED';
    const notFound =
      error instanceof Error && error.message === 'Lead não encontrado.';
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível consultar o lead.',
      },
      { status: unauthorized ? 401 : notFound ? 404 : 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const leadId = z.string().uuid().parse(id);
    const input = updateSchema.parse(await request.json());
    const current = await getLeadDetails(user.id, leadId);
    if (input.company)
      await mutateApp(user.id, {
        action: 'update',
        entity: 'companies',
        id: leadId,
        data: input.company,
      });
    if (input.digitalAnalysis) {
      await mutateApp(
        user.id,
        current.digitalAnalysis
          ? {
              action: 'update',
              entity: 'digitalAnalyses',
              id: current.digitalAnalysis.id,
              data: input.digitalAnalysis,
            }
          : {
              action: 'create',
              entity: 'digitalAnalyses',
              data: { ...input.digitalAnalysis, companyId: leadId },
            },
      );
    }
    return Response.json({ id: leadId });
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar o lead.',
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}
