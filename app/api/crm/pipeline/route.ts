import { z } from 'zod';
import { getAppData, mutateApp } from '@/lib/app-service';
import { requireUser } from '@/lib/require-user';

const moveSchema = z
  .object({
    id: z.string().uuid(),
    pipelineStageId: z.string().uuid(),
    lostReason: z.string().trim().max(10_000).nullable().optional(),
  })
  .strict();

export async function GET() {
  try {
    const user = await requireUser();
    const data = await getAppData(user.id);
    return Response.json({
      stages: data.pipelineStages,
      opportunities: data.opportunities,
      history: data.pipelineHistory,
    });
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível consultar o pipeline.',
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = moveSchema.parse(await request.json());
    return Response.json(
      await mutateApp(user.id, { action: 'moveOpportunity', ...input }),
    );
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível mover a oportunidade.',
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}
