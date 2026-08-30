import { z } from 'zod';
import { getAppData, mutateApp } from '@/lib/app-service';
import { parseCsv } from '@/lib/csv';
import { requireUser } from '@/lib/require-user';
import { parseCompanyPayload } from '@/lib/validation';

const requestSchema = z.object({
  content: z.string().min(1).max(2_000_000),
  confirm: z.boolean().default(false),
});

const aliases: Record<string, string> = {
  empresa: 'name', nome: 'name', name: 'name', razao_social: 'legalName', legal_name: 'legalName',
  documento: 'document', cnpj: 'document', site: 'website', website: 'website', email: 'email',
  telefone: 'phone', phone: 'phone', whatsapp: 'whatsapp', cidade: 'city', city: 'city',
  estado: 'state', state: 'state', segmento: 'industry', industry: 'industry', origem: 'leadSource',
  lead_source: 'leadSource', observacoes: 'notesSummary', notes: 'notesSummary',
};

function normalizeRow(row: Record<string, string>) {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.trim().toLowerCase().replaceAll(' ', '_');
    const target = aliases[normalizedKey];
    if (target && value) mapped[target] = value;
  }
  return { lifecycleStatus: 'prospect', relationshipStatus: 'inactive', healthStatus: 'good', ...mapped };
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = requestSchema.parse(await request.json());
    const rawRows = parseCsv(input.content);
    if (rawRows.length > 1_000) throw new Error('Importe no máximo 1.000 linhas por vez.');
    const existing = (await getAppData(user.id)).companies;
    const seen = new Set<string>();
    const preview = rawRows.map((row, index) => {
      try {
        const normalized = normalizeRow(row);
        const parsed = parseCompanyPayload(normalized);
        const signature = [parsed.name, parsed.website || '', parsed.email || ''].join('|').toLowerCase();
        const duplicate = seen.has(signature) || existing.some((company) => company.name.toLowerCase() === parsed.name.toLowerCase() || Boolean(parsed.website && company.website === parsed.website) || Boolean(parsed.email && company.email === parsed.email));
        seen.add(signature);
        return { row: index + 2, status: duplicate ? 'duplicate' : 'valid', data: parsed, error: duplicate ? 'Possível duplicado; revise antes de importar.' : null };
      } catch (error) {
        return { row: index + 2, status: 'invalid', data: normalizeRow(row), error: error instanceof Error ? error.message : 'Linha inválida.' };
      }
    });

    if (!input.confirm) return Response.json({ preview, summary: { total: preview.length, valid: preview.filter((item) => item.status === 'valid').length, invalid: preview.filter((item) => item.status === 'invalid').length, duplicates: preview.filter((item) => item.status === 'duplicate').length } });
    if (preview.some((item) => item.status !== 'valid')) return Response.json({ error: 'Corrija ou remova linhas inválidas/duplicadas antes de confirmar.', preview }, { status: 400 });
    for (const item of preview) await mutateApp(user.id, { action: 'create', entity: 'companies', data: item.data });
    return Response.json({ imported: preview.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Não autorizado.' : error instanceof Error ? error.message : 'Não foi possível importar.' }, { status: error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 400 });
  }
}
