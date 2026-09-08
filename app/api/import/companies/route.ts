import { z } from 'zod';
import { getAppData, mutateApp } from '@/lib/app-service';
import {
  normalizeDomainIdentity,
  normalizeEmailIdentity,
  normalizeNameCityIdentity,
  normalizePhoneIdentity,
} from '@/lib/crm';
import { parseCsv } from '@/lib/csv';
import { requireUser } from '@/lib/require-user';
import {
  parseCompanyPayload,
  parseDigitalAnalysisPayload,
} from '@/lib/validation';

const requestSchema = z.object({
  content: z.string().min(1).max(5_000_000),
  mapping: z.record(z.string(), z.string()).optional(),
  confirm: z.boolean().default(false),
  duplicateAction: z.enum(['reject', 'ignore', 'update']).default('reject'),
});

const companyTargets = new Set([
  'name',
  'tradeName',
  'legalName',
  'document',
  'website',
  'instagram',
  'email',
  'phone',
  'whatsapp',
  'city',
  'state',
  'industry',
  'primaryContactName',
  'leadSource',
  'sourceUrl',
  'prospectingStatus',
  'notesSummary',
]);
const analysisTargets = new Set([
  'hasSite',
  'websiteUrl',
  'siteStatus',
  'overallQuality',
  'mobileQuality',
  'speedQuality',
  'designQuality',
  'valuePropositionQuality',
  'ctaQuality',
  'hasWhatsappIntegration',
  'hasBasicSeo',
  'hasHttps',
  'hasBrokenLinks',
  'hasActiveDigitalPresence',
  'issues',
  'opportunities',
  'scoreOverride',
  'priority',
]);
const allowedTargets = new Set([...companyTargets, ...analysisTargets]);

const aliases: Record<string, string> = {
  empresa: 'name',
  nome: 'name',
  name: 'name',
  nome_fantasia: 'tradeName',
  razao_social: 'legalName',
  legal_name: 'legalName',
  documento: 'document',
  cnpj: 'document',
  site: 'website',
  website: 'website',
  email: 'email',
  telefone: 'phone',
  phone: 'phone',
  whatsapp: 'whatsapp',
  cidade: 'city',
  city: 'city',
  estado: 'state',
  state: 'state',
  segmento: 'industry',
  industry: 'industry',
  responsavel: 'primaryContactName',
  contato: 'primaryContactName',
  instagram: 'instagram',
  origem: 'leadSource',
  lead_source: 'leadSource',
  url_origem: 'sourceUrl',
  status: 'prospectingStatus',
  status_funil: 'prospectingStatus',
  status_site: 'siteStatus',
  possui_site: 'hasSite',
  qualidade_geral: 'overallQuality',
  mobile: 'mobileQuality',
  velocidade: 'speedQuality',
  design: 'designQuality',
  clareza_proposta: 'valuePropositionQuality',
  cta: 'ctaQuality',
  integracao_whatsapp: 'hasWhatsappIntegration',
  seo_basico: 'hasBasicSeo',
  https: 'hasHttps',
  links_quebrados: 'hasBrokenLinks',
  presenca_digital_ativa: 'hasActiveDigitalPresence',
  problemas_site: 'issues',
  oportunidade: 'opportunities',
  lead_score: 'scoreOverride',
  prioridade: 'priority',
  observacoes: 'notesSummary',
  notes: 'notesSummary',
};

function normalizedHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function booleanValue(value: string) {
  const normalized = normalizedHeader(value);
  if (['sim', 's', 'true', '1', 'yes'].includes(normalized)) return true;
  if (['nao', 'n', 'false', '0', 'no'].includes(normalized)) return false;
  return null;
}

function normalizeRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
) {
  const company: Record<string, unknown> = {};
  const analysis: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(row)) {
    const target = mapping[header] || '';
    if (!target || !value.trim()) continue;
    let normalizedValue: unknown = value.trim();
    if (
      ['website', 'websiteUrl', 'sourceUrl'].includes(target) &&
      !/^https?:\/\//i.test(value.trim())
    )
      normalizedValue = `https://${value.trim()}`;
    if (
      [
        'hasSite',
        'hasWhatsappIntegration',
        'hasBasicSeo',
        'hasHttps',
        'hasBrokenLinks',
        'hasActiveDigitalPresence',
      ].includes(target)
    )
      normalizedValue = booleanValue(value);
    if (
      [
        'overallQuality',
        'mobileQuality',
        'speedQuality',
        'designQuality',
        'valuePropositionQuality',
        'ctaQuality',
        'scoreOverride',
      ].includes(target)
    )
      normalizedValue = Number(value.replace(',', '.'));
    if (['siteStatus', 'priority', 'prospectingStatus'].includes(target))
      normalizedValue = normalizedHeader(value).toUpperCase();
    (companyTargets.has(target) ? company : analysis)[target] = normalizedValue;
  }
  const createCompany = parseCompanyPayload({
    lifecycleStatus: 'lead',
    relationshipStatus: 'inactive',
    healthStatus: 'good',
    prospectingStatus: 'NOVO_LEAD',
    ...company,
  });
  const parsedAnalysis = Object.keys(analysis).length
    ? parseDigitalAnalysisPayload({
        companyId: '00000000-0000-4000-8000-000000000000',
        ...analysis,
      })
    : null;
  return {
    company: createCompany,
    companyUpdate: company,
    analysis: parsedAnalysis
      ? { ...parsedAnalysis, companyId: undefined }
      : null,
  };
}

type ExistingCompany = Awaited<
  ReturnType<typeof getAppData>
>['companies'][number];

function duplicateOf(
  candidate: ReturnType<typeof parseCompanyPayload>,
  existing: ExistingCompany[],
) {
  const phone = normalizePhoneIdentity(candidate.whatsapp || candidate.phone);
  const email = normalizeEmailIdentity(candidate.email);
  const domain = normalizeDomainIdentity(candidate.website);
  const nameCity = normalizeNameCityIdentity(candidate.name, candidate.city);
  for (const row of existing) {
    const reasons: string[] = [];
    const existingPhones = [
      normalizePhoneIdentity(row.phone),
      normalizePhoneIdentity(row.whatsapp),
    ].filter(Boolean);
    if (phone && existingPhones.includes(phone))
      reasons.push('telefone/WhatsApp');
    if (email && normalizeEmailIdentity(row.email) === email)
      reasons.push('e-mail');
    if (domain && normalizeDomainIdentity(row.website) === domain)
      reasons.push('domínio');
    if (nameCity && normalizeNameCityIdentity(row.name, row.city) === nameCity)
      reasons.push('nome + cidade');
    if (reasons.length) return { id: row.id, name: row.name, reasons };
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = requestSchema.parse(await request.json());
    const rawRows = parseCsv(input.content);
    if (rawRows.length > 2_000)
      throw new Error('Importe no máximo 2.000 linhas por vez.');
    const headers = Object.keys(rawRows[0] || {});
    const suggestedMapping = Object.fromEntries(
      headers.map((header) => [
        header,
        aliases[normalizedHeader(header)] || '',
      ]),
    );
    const mapping = input.mapping || suggestedMapping;
    for (const target of Object.values(mapping))
      if (target && !allowedTargets.has(target))
        throw new Error(`Mapeamento inválido: ${target}.`);
    const appData = await getAppData(user.id);
    const seenValid: ExistingCompany[] = [];
    const prepared = rawRows.map((row, index) => {
      try {
        const normalized = normalizeRow(row, mapping);
        const duplicate = duplicateOf(normalized.company, [
          ...appData.companies,
          ...seenValid,
        ]);
        if (!duplicate)
          seenValid.push({
            ...normalized.company,
            id: `preview-${index}`,
          } as ExistingCompany);
        return {
          row: index + 2,
          status: duplicate ? ('duplicate' as const) : ('valid' as const),
          data: normalized,
          duplicate,
          error: duplicate
            ? `Possível duplicado por ${duplicate.reasons.join(', ')}.`
            : null,
        };
      } catch (error) {
        return {
          row: index + 2,
          status: 'invalid' as const,
          data: null,
          duplicate: null,
          error: error instanceof Error ? error.message : 'Linha inválida.',
        };
      }
    });
    const duplicates = prepared.filter((item) => item.status === 'duplicate');
    const summary = {
      total: prepared.length,
      valid: prepared.filter((item) => item.status === 'valid').length,
      invalid: prepared.filter((item) => item.status === 'invalid').length,
      duplicates: duplicates.length,
      willCreate: prepared.filter((item) => item.status === 'valid').length,
      willUpdate:
        input.duplicateAction === 'update'
          ? duplicates.filter(
              (item) =>
                item.duplicate?.id && !item.duplicate.id.startsWith('preview-'),
            ).length
          : 0,
      willSkip:
        prepared.filter((item) => item.status === 'invalid').length +
        (input.duplicateAction === 'ignore' ? duplicates.length : 0),
    };
    const preview = prepared.slice(0, 100).map((item) => ({
      row: item.row,
      status: item.status,
      company: item.data?.company || null,
      digitalAnalysis: item.data?.analysis || null,
      duplicate: item.duplicate,
      error: item.error,
    }));
    if (!input.confirm)
      return Response.json({
        headers,
        suggestedMapping,
        mapping,
        preview,
        summary,
        previewLimited: prepared.length > 100,
      });
    if (duplicates.length && input.duplicateAction === 'reject')
      return Response.json(
        {
          error:
            'Existem possíveis duplicados. Escolha ignorar ou atualizar antes de confirmar.',
          preview,
          summary,
        },
        { status: 409 },
      );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const item of prepared) {
      if (!item.data) {
        skipped += 1;
        continue;
      }
      const actualDuplicateId =
        item.duplicate?.id && !item.duplicate.id.startsWith('preview-')
          ? item.duplicate.id
          : null;
      if (
        item.status === 'duplicate' &&
        (input.duplicateAction === 'ignore' || !actualDuplicateId)
      ) {
        skipped += 1;
        continue;
      }
      let companyId = actualDuplicateId;
      if (companyId) {
        await mutateApp(user.id, {
          action: 'update',
          entity: 'companies',
          id: companyId,
          data: item.data.companyUpdate,
        });
        updated += 1;
      } else {
        const row = await mutateApp(user.id, {
          action: 'create',
          entity: 'companies',
          data: item.data.company,
        });
        if (!('id' in row)) throw new Error('A empresa não pôde ser criada.');
        companyId = row.id;
        created += 1;
      }
      if (item.data.analysis && companyId) {
        const existingAnalysis = appData.digitalAnalyses.find(
          (analysis) => analysis.companyId === companyId,
        );
        await mutateApp(
          user.id,
          existingAnalysis
            ? {
                action: 'update',
                entity: 'digitalAnalyses',
                id: existingAnalysis.id,
                data: item.data.analysis,
              }
            : {
                action: 'create',
                entity: 'digitalAnalyses',
                data: { ...item.data.analysis, companyId },
              },
        );
      }
    }
    return Response.json({ created, updated, skipped, total: prepared.length });
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json(
      {
        error: unauthorized
          ? 'Não autorizado.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível importar.',
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}
