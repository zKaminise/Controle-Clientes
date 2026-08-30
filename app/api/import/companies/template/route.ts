import { requireUser } from '@/lib/require-user';

const headers = [
  'empresa',
  'razao_social',
  'documento',
  'site',
  'email',
  'telefone',
  'whatsapp',
  'cidade',
  'estado',
  'segmento',
  'origem',
  'observacoes',
];

export async function GET() {
  try {
    await requireUser();
    return new Response(`\uFEFF${headers.join(',')}\r\n`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition':
          'attachment; filename="modelo-importacao-clientes.csv"',
      },
    });
  } catch {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }
}
