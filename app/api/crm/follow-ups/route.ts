import { mutateApp } from '@/lib/app-service';
import { getTodayFollowUps } from '@/lib/crm-service';
import { requireUser } from '@/lib/require-user';

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(await getTodayFollowUps(user.id));
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível consultar os follow-ups.',
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const row = await mutateApp(user.id, {
      action: 'create',
      entity: 'tasks',
      data: await request.json(),
    });
    return Response.json(row, { status: 201 });
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível criar o follow-up.',
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}
