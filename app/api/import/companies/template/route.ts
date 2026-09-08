import { requireUser } from '@/lib/require-user';

const headers = [
  'empresa',
  'nome_fantasia',
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
  'url_origem',
  'responsavel',
  'instagram',
  'status_funil',
  'possui_site',
  'status_site',
  'qualidade_geral',
  'mobile',
  'velocidade',
  'design',
  'clareza_proposta',
  'cta',
  'integracao_whatsapp',
  'seo_basico',
  'https',
  'links_quebrados',
  'presenca_digital_ativa',
  'problemas_site',
  'oportunidade',
  'lead_score',
  'prioridade',
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
