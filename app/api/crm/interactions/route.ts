import { mutateApp } from '@/lib/app-service';
import { requireUser } from '@/lib/require-user';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const row = await mutateApp(user.id, {
      action: 'create',
      entity: 'interactions',
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
            : 'Não foi possível registrar o contato.',
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}
