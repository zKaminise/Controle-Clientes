export type LeadScoreLevel = 'BAIXA' | 'MEDIA' | 'ALTA' | 'MUITO_ALTA';

export type LeadScoreRule = {
  ruleKey: string;
  label: string;
  points: number;
  enabled: boolean;
  position: number;
};

export const DEFAULT_LEAD_SCORE_RULES: LeadScoreRule[] = [
  {
    ruleKey: 'no_site',
    label: 'Empresa sem site',
    points: 30,
    enabled: true,
    position: 0,
  },
  {
    ruleKey: 'outdated_site',
    label: 'Site claramente defasado',
    points: 25,
    enabled: true,
    position: 1,
  },
  {
    ruleKey: 'mobile_problems',
    label: 'Site com problemas graves no celular',
    points: 20,
    enabled: true,
    position: 2,
  },
  {
    ruleKey: 'active_presence_no_site',
    label: 'Presença digital ativa, mas sem site',
    points: 20,
    enabled: true,
    position: 3,
  },
  {
    ruleKey: 'public_phone',
    label: 'Telefone ou WhatsApp disponível',
    points: 10,
    enabled: true,
    position: 4,
  },
  {
    ruleKey: 'public_email',
    label: 'E-mail disponível',
    points: 5,
    enabled: true,
    position: 5,
  },
  {
    ruleKey: 'broken_links',
    label: 'Site com links quebrados',
    points: 10,
    enabled: true,
    position: 6,
  },
  {
    ruleKey: 'weak_cta',
    label: 'CTA ausente ou fraco',
    points: 10,
    enabled: true,
    position: 7,
  },
  {
    ruleKey: 'modern_complete_site',
    label: 'Site moderno e completo',
    points: -30,
    enabled: true,
    position: 8,
  },
];

export type ScoreCompany = {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
};

export type ScoreAnalysis = {
  hasSite?: boolean | null;
  siteStatus?: string | null;
  mobileQuality?: number | null;
  ctaQuality?: number | null;
  hasBrokenLinks?: boolean | null;
  hasActiveDigitalPresence?: boolean | null;
};

export function leadScoreLevel(score: number): LeadScoreLevel {
  if (score >= 80) return 'MUITO_ALTA';
  if (score >= 60) return 'ALTA';
  if (score >= 30) return 'MEDIA';
  return 'BAIXA';
}

export function calculateLeadScore(
  company: ScoreCompany,
  analysis: ScoreAnalysis,
  rules: LeadScoreRule[] = DEFAULT_LEAD_SCORE_RULES,
) {
  const conditions: Record<string, boolean> = {
    no_site: analysis.hasSite === false || analysis.siteStatus === 'SEM_SITE',
    outdated_site: analysis.siteStatus === 'SITE_DEFASADO',
    mobile_problems:
      analysis.hasSite === true &&
      analysis.mobileQuality !== null &&
      analysis.mobileQuality !== undefined &&
      analysis.mobileQuality <= 2,
    active_presence_no_site:
      Boolean(analysis.hasActiveDigitalPresence) &&
      (analysis.hasSite === false || analysis.siteStatus === 'SEM_SITE'),
    public_phone: Boolean(company.phone || company.whatsapp),
    public_email: Boolean(company.email),
    broken_links: analysis.hasBrokenLinks === true,
    weak_cta:
      analysis.hasSite === true &&
      analysis.ctaQuality !== null &&
      analysis.ctaQuality !== undefined &&
      analysis.ctaQuality <= 2,
    modern_complete_site: analysis.siteStatus === 'SITE_BOM',
  };
  const breakdown = rules
    .filter((rule) => rule.enabled && conditions[rule.ruleKey])
    .sort((left, right) => left.position - right.position)
    .map(({ ruleKey, label, points }) => ({ ruleKey, label, points }));
  const score = Math.max(
    0,
    Math.min(
      100,
      breakdown.reduce((total, rule) => total + rule.points, 0),
    ),
  );
  return { score, level: leadScoreLevel(score), breakdown };
}

export function normalizePhoneIdentity(value?: string | null) {
  const digits = value?.replace(/\D/g, '') || '';
  return digits.length >= 8 ? digits.replace(/^55(?=\d{10,11}$)/, '') : '';
}

export function normalizeEmailIdentity(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

export function normalizeDomainIdentity(value?: string | null) {
  if (!value) return '';
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }
}

export function normalizeNameCityIdentity(
  name?: string | null,
  city?: string | null,
) {
  const normalize = (value?: string | null) =>
    value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') || '';
  const normalizedName = normalize(name);
  const normalizedCity = normalize(city);
  return normalizedName && normalizedCity
    ? `${normalizedName}|${normalizedCity}`
    : '';
}
