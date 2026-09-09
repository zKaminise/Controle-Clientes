export const SIMPLE_PROSPECTING_STAGES = [
  ['new', 'Novo'],
  ['contact', 'Contatar'],
  ['waiting', 'Aguardando resposta'],
  ['interested', 'Interessado'],
  ['meeting', 'Reunião'],
  ['proposal', 'Proposta / negociação'],
  ['later', 'Retomar depois'],
  ['won', 'Convertido'],
  ['lost', 'Não convertido'],
] as const;

export type SimpleProspectingStage =
  (typeof SIMPLE_PROSPECTING_STAGES)[number][0];

export function isActiveProspect(lifecycleStatus: string) {
  return lifecycleStatus === 'lead' || lifecycleStatus === 'prospect';
}

export function conversionFields(prospectingStatus: string) {
  return prospectingStatus === 'FECHADO'
    ? {
        lifecycleStatus: 'client' as const,
        relationshipStatus: 'active_non_recurring' as const,
      }
    : {};
}

export function nextPostSaleAt(from: Date, intervalDays: number) {
  const result = new Date(from);
  result.setUTCDate(result.getUTCDate() + intervalDays);
  return result;
}

export function domainReminderPriority(
  responsibility: string,
  thresholdDays: number,
) {
  if (responsibility === 'me' && thresholdDays <= 30) return 'urgent' as const;
  if (thresholdDays <= 7) return 'urgent' as const;
  if (thresholdDays <= 60) return 'high' as const;
  return 'normal' as const;
}

export function shouldSurfaceDeferredLead(input: {
  prospectingStatus: string;
  nextActionAt: Date | null;
  until: Date;
}) {
  return (
    input.prospectingStatus === 'FOLLOWUP_FUTURO' &&
    Boolean(input.nextActionAt && input.nextActionAt <= input.until)
  );
}

export function simpleProspectingStage(status: string): SimpleProspectingStage {
  if (['NOVO_LEAD', 'PESQUISANDO'].includes(status)) return 'new';
  if (status === 'PRONTO_PARA_CONTATO') return 'contact';
  if (
    [
      'CONTATO_WHATSAPP',
      'CONTATO_EMAIL',
      'CONTATO_TELEFONE',
      'SEM_RESPOSTA',
      'RESPONDEU',
    ].includes(status)
  )
    return 'waiting';
  if (status === 'INTERESSADO') return 'interested';
  if (['REUNIAO_AGENDADA', 'REUNIAO_REALIZADA'].includes(status))
    return 'meeting';
  if (['PROPOSTA_ENVIADA', 'NEGOCIACAO'].includes(status)) return 'proposal';
  if (status === 'FOLLOWUP_FUTURO') return 'later';
  if (status === 'FECHADO') return 'won';
  return 'lost';
}

export const SIMPLE_TO_CANONICAL_STATUS: Record<
  SimpleProspectingStage,
  string
> = {
  new: 'NOVO_LEAD',
  contact: 'PRONTO_PARA_CONTATO',
  waiting: 'SEM_RESPOSTA',
  interested: 'INTERESSADO',
  meeting: 'REUNIAO_AGENDADA',
  proposal: 'PROPOSTA_ENVIADA',
  later: 'FOLLOWUP_FUTURO',
  won: 'FECHADO',
  lost: 'PERDIDO',
};

export function clientCompleteness(input: {
  company: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    website?: string | null;
    primaryContactName?: string | null;
    nextContactAt?: string | Date | null;
  };
  hasDeliveredProject: boolean;
  hasDomainOrHosting: boolean;
  hasMaintenanceDecision: boolean;
  hasHistory: boolean;
}) {
  const checks = [
    Boolean(input.company.name),
    Boolean(
      input.company.email || input.company.phone || input.company.whatsapp,
    ),
    Boolean(input.company.primaryContactName),
    Boolean(input.company.website),
    input.hasDeliveredProject,
    input.hasDomainOrHosting,
    input.hasMaintenanceDecision,
    Boolean(input.company.nextContactAt),
    input.hasHistory,
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}
