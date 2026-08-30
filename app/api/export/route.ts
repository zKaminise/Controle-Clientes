import { z } from 'zod';
import { getAppData } from '@/lib/app-service';
import { toCsv } from '@/lib/csv';
import { requireUser } from '@/lib/require-user';

const exportEntity = z.enum(['companies', 'contacts', 'projects', 'domains', 'charges', 'payments', 'opportunities']);

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const entity = exportEntity.parse(new URL(request.url).searchParams.get('entity'));
    const data = await getAppData(user.id);
    const csv = toCsv(data[entity] as Array<Record<string, unknown>>);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${entity}-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Não autorizado.' : 'Exportação inválida.' }, { status: error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 400 });
  }
}
