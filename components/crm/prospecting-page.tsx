'use client';

import {
  CalendarPlus,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  ExternalLink,
  Layers3,
  UserPlus,
  Copy,
  Globe2,
  Camera,
  CalendarClock,
  ThumbsDown,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SIMPLE_PROSPECTING_STAGES,
  SIMPLE_TO_CANONICAL_STATUS,
  isActiveProspect,
  simpleProspectingStage,
  type SimpleProspectingStage,
} from '@/lib/customer-experience';

type Row = Record<string, unknown> & { id: string };
type Company = Row & {
  name: string;
  tradeName?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  lifecycleStatus: string;
  prospectingStatus: string;
  website?: string | null;
  instagram?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
};
type Analysis = Row & {
  companyId: string;
  siteStatus: string;
  leadScore: number;
  scoreLevel: string;
  priority: string;
  issues?: string | null;
};
type Interaction = Row & {
  companyId: string;
  occurredAt: string;
  result?: string | null;
};
type Task = Row & { companyId?: string | null; status: string; dueAt: string };
type Opportunity = Row & { companyId: string; pipelineStageId: string };
type Stage = Row & { slug: string; isWon: boolean; isLost: boolean };
type ProspectingBatch = Row & {
  name: string;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  desiredQuantity: number;
  status: string;
};
type ProspectingCandidate = Row & {
  batchId: string;
  companyName: string;
  city?: string | null;
  state?: string | null;
  score: number;
  status: string;
  evidence: Array<{ url: string; label?: string | null }>;
  suggestedMessage?: string | null;
  promotedCompanyId?: string | null;
};

export type ProspectingData = {
  companies: Company[];
  digitalAnalyses: Analysis[];
  interactions: Interaction[];
  tasks: Task[];
  opportunities: Opportunity[];
  pipelineStages: Stage[];
  prospectingBatches: ProspectingBatch[];
  prospectingCandidates: ProspectingCandidate[];
};

const siteStatuses = [
  'SEM_SITE',
  'SITE_RUIM',
  'SITE_DEFASADO',
  'SITE_MEDIANO',
  'SITE_BOM',
  'NAO_ANALISADO',
] as const;

function readable(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .replaceAll('_', ' ')
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function datePt(value?: string | null) {
  if (!value) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

export function ProspectingPage({
  data,
  openCreate,
  openEdit,
  openCompany,
  mutate,
}: {
  data: ProspectingData;
  openCreate: (
    entity:
      | 'companies'
      | 'digitalAnalyses'
      | 'interactions'
      | 'tasks'
      | 'meetings'
      | 'prospectingCandidates'
      | 'prospectingBatches',
    preset?: Record<string, unknown>,
  ) => void;
  openEdit: (entity: 'companies' | 'digitalAnalyses', row: Row) => void;
  openCompany: (id: string) => void;
  mutate: (payload: object, success?: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [siteStatus, setSiteStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [prospectingStatus, setProspectingStatus] = useState<
    SimpleProspectingStage | ''
  >('');
  const [quickFilter, setQuickFilter] = useState<
    'all' | 'no_action' | 'old_contact' | 'future' | 'proposal'
  >('all');
  const analyses = useMemo(
    () => new Map(data.digitalAnalyses.map((row) => [row.companyId, row])),
    [data.digitalAnalyses],
  );
  const lastInteractions = useMemo(() => {
    const map = new Map<string, Interaction>();
    for (const row of [...data.interactions].sort(
      (a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt),
    ))
      if (!map.has(row.companyId)) map.set(row.companyId, row);
    return map;
  }, [data.interactions]);
  const stages = useMemo(
    () => new Map(data.pipelineStages.map((row) => [row.id, row])),
    [data.pipelineStages],
  );
  const prospectCompanies = data.companies.filter((company) =>
    isActiveProspect(company.lifecycleStatus),
  );
  const rows = prospectCompanies.filter((company) => {
    const analysis = analyses.get(company.id);
    const interaction = lastInteractions.get(company.id);
    const normalized = query.toLocaleLowerCase('pt-BR');
    const matchesQuery =
      !normalized ||
      [
        company.name,
        company.tradeName,
        company.industry,
        company.city,
        company.email,
        company.phone,
        company.whatsapp,
        company.website,
      ].some((value) =>
        String(value || '')
          .toLocaleLowerCase('pt-BR')
          .includes(normalized),
      );
    const hasPendingProposal = data.opportunities.some((opportunity) => {
      const stage = stages.get(opportunity.pipelineStageId);
      return (
        opportunity.companyId === company.id &&
        Boolean(
          stage &&
          [
            'proposal',
            'proposta_enviada',
            'negotiation',
            'negociacao',
          ].includes(stage.slug) &&
          !stage.isWon &&
          !stage.isLost,
        )
      );
    });
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const quickMatch =
      quickFilter === 'all' ||
      (quickFilter === 'no_action' && !interaction && !company.nextActionAt) ||
      (quickFilter === 'old_contact' &&
        Boolean(
          interaction &&
          +new Date(interaction.occurredAt) < sevenDaysAgo &&
          company.prospectingStatus === 'SEM_RESPOSTA',
        )) ||
      (quickFilter === 'future' &&
        company.prospectingStatus === 'FOLLOWUP_FUTURO') ||
      (quickFilter === 'proposal' && hasPendingProposal);
    return (
      matchesQuery &&
      quickMatch &&
      (!industry ||
        String(company.industry || '')
          .toLocaleLowerCase('pt-BR')
          .includes(industry.toLocaleLowerCase('pt-BR'))) &&
      (!city ||
        String(company.city || '')
          .toLocaleLowerCase('pt-BR')
          .includes(city.toLocaleLowerCase('pt-BR'))) &&
      (!state || company.state === state.toUpperCase()) &&
      (!siteStatus || analysis?.siteStatus === siteStatus) &&
      (!priority ||
        analysis?.priority === priority ||
        analysis?.scoreLevel === priority) &&
      (!prospectingStatus ||
        simpleProspectingStage(company.prospectingStatus) === prospectingStatus)
    );
  });
  const closed = data.companies.filter(
    (row) =>
      row.lifecycleStatus === 'client' && row.prospectingStatus === 'FECHADO',
  ).length;
  const openPool = prospectCompanies.filter(
    (row) =>
      !['PERDIDO', 'DESCARTADO', 'SEM_INTERESSE'].includes(
        row.prospectingStatus,
      ),
  ).length;
  const overdue = data.tasks.filter(
    (row) =>
      (row.status === 'open' || row.status === 'snoozed') &&
      new Date(row.dueAt) < new Date(),
  ).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="size-4 text-primary" />
                Pesquisa assistida
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Crie um lote e peça ao Codex para pesquisar empresas. Você
                revisa tudo antes de virar lead.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCreate('prospectingBatches')}
            >
              <Sparkles />
              Novo lote
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[.75fr_1.25fr]">
          <div className="space-y-2">
            {data.prospectingBatches.slice(0, 6).map((batch) => (
              <div key={batch.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{batch.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {batch.industry || 'Qualquer segmento'} ·{' '}
                      {[batch.city, batch.state].filter(Boolean).join('/') ||
                        'Qualquer local'}
                    </p>
                  </div>
                  <Badge variant="outline">{readable(batch.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {
                    data.prospectingCandidates.filter(
                      (item) => item.batchId === batch.id,
                    ).length
                  }{' '}
                  de {batch.desiredQuantity} candidatos
                </p>
              </div>
            ))}
            {!data.prospectingBatches.length && (
              <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                Nenhum lote ainda. Crie um lote e use o Codex para preencher
                candidatos com evidências públicas.
              </p>
            )}
          </div>
          <div className="space-y-2">
            {data.prospectingCandidates
              .filter((item) => item.status !== 'ignored')
              .slice(0, 8)
              .map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {candidate.companyName}
                      </p>
                      <Badge>{candidate.score}/100</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[candidate.city, candidate.state]
                        .filter(Boolean)
                        .join('/') || 'Local não informado'}{' '}
                      · {readable(candidate.status)}
                    </p>
                    {candidate.suggestedMessage && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        Sugestão: {candidate.suggestedMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {candidate.evidence?.[0] && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Abrir fonte pública"
                        onClick={() =>
                          window.open(
                            candidate.evidence[0].url,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                      >
                        <ExternalLink />
                      </Button>
                    )}
                    {candidate.suggestedMessage && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Copiar mensagem sugerida"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            candidate.suggestedMessage || '',
                          )
                        }
                      >
                        <Copy />
                      </Button>
                    )}
                    {candidate.status !== 'promoted' && (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Analisar depois"
                          onClick={() =>
                            void mutate(
                              {
                                action: 'update',
                                entity: 'prospectingCandidates',
                                id: candidate.id,
                                data: { status: 'later' },
                              },
                              'Candidato guardado para depois.',
                            )
                          }
                        >
                          <Clock3 />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Ignorar"
                          onClick={() =>
                            void mutate(
                              {
                                action: 'update',
                                entity: 'prospectingCandidates',
                                id: candidate.id,
                                data: { status: 'ignored' },
                              },
                              'Candidato ignorado.',
                            )
                          }
                        >
                          <ThumbsDown />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void mutate(
                              {
                                action: 'promoteProspectingCandidate',
                                id: candidate.id,
                              },
                              'Candidato promovido para lead.',
                            )
                          }
                        >
                          <UserPlus />
                          Virar lead
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            {!data.prospectingCandidates.length && (
              <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                Os candidatos pesquisados aparecerão aqui para revisão. Nenhuma
                mensagem é enviada automaticamente.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            'Novos leads',
            prospectCompanies.filter(
              (row) => row.prospectingStatus === 'NOVO_LEAD',
            ).length,
          ],
          [
            'Sem resposta',
            prospectCompanies.filter(
              (row) => row.prospectingStatus === 'SEM_RESPOSTA',
            ).length,
          ],
          [
            'Interessados',
            prospectCompanies.filter(
              (row) => row.prospectingStatus === 'INTERESSADO',
            ).length,
          ],
          ['Follow-ups vencidos', overdue],
          [
            'Conversão',
            `${openPool ? Math.round((closed / openPool) * 100) : 0}%`,
          ],
        ].map(([label, value]) => (
          <Card key={label} size="sm">
            <CardHeader>
              <CardTitle className="text-xs text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {value}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>Base de prospecção</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {rows.length} empresas encontradas
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openCreate('companies')}>
                <Sparkles />
                Novo lead
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickFilter('no_action')}
              >
                Sem ação
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickFilter('old_contact')}
              >
                Sem resposta +7 dias
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickFilter('future')}
              >
                Contato futuro
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickFilter('proposal')}
              >
                Propostas abertas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Empresa, contato, segmento ou site"
              />
            </div>
            <Input
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              placeholder="Segmento: odontologia..."
            />
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Cidade"
            />
            <Input
              value={state}
              maxLength={2}
              onChange={(event) => setState(event.target.value)}
              placeholder="UF"
            />
            <NativeSelect
              className="w-full"
              value={siteStatus}
              onChange={(event) => setSiteStatus(event.target.value)}
            >
              <NativeSelectOption value="">
                Qualquer situação do site
              </NativeSelectOption>
              {siteStatuses.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {readable(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              className="w-full"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <NativeSelectOption value="">
                Qualquer prioridade
              </NativeSelectOption>
              {['BAIXA', 'MEDIA', 'ALTA', 'MUITO_ALTA'].map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {readable(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              className="w-full"
              value={prospectingStatus}
              onChange={(event) =>
                setProspectingStatus(
                  event.target.value as SimpleProspectingStage | '',
                )
              }
            >
              <NativeSelectOption value="">Qualquer etapa</NativeSelectOption>
              {SIMPLE_PROSPECTING_STAGES.map(([value, text]) => (
                <NativeSelectOption key={value} value={value}>
                  {text}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {(quickFilter !== 'all' ||
            query ||
            industry ||
            city ||
            state ||
            siteStatus ||
            priority ||
            prospectingStatus) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('');
                setIndustry('');
                setCity('');
                setState('');
                setSiteStatus('');
                setPriority('');
                setProspectingStatus('');
                setQuickFilter('all');
              }}
            >
              <SlidersHorizontal />
              Limpar filtros
            </Button>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Oportunidade digital</TableHead>
                  <TableHead>Pontuação</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Último contato</TableHead>
                  <TableHead>Próximo passo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((company) => {
                  const analysis = analyses.get(company.id);
                  const last = lastInteractions.get(company.id);
                  const researched = data.prospectingCandidates.find(
                    (item) => item.promotedCompanyId === company.id,
                  );
                  return (
                    <TableRow key={company.id}>
                      <TableCell>
                        <button
                          className="text-left font-medium hover:underline"
                          onClick={() => openCompany(company.id)}
                        >
                          {company.tradeName || company.name}
                        </button>
                        <div className="text-xs text-muted-foreground">
                          {company.industry || 'Sem segmento'} ·{' '}
                          {[company.city, company.state]
                            .filter(Boolean)
                            .join('/') || 'Sem local'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {analysis
                            ? readable(analysis.siteStatus)
                            : 'Não analisado'}
                        </Badge>
                        {analysis?.issues && (
                          <div className="mt-1 max-w-52 truncate text-xs text-muted-foreground">
                            {analysis.issues}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {analysis?.leadScore ?? 0}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {analysis ? readable(analysis.scoreLevel) : 'Baixa'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          size="sm"
                          value={simpleProspectingStage(
                            company.prospectingStatus,
                          )}
                          onChange={(event) =>
                            mutate(
                              {
                                action: 'update',
                                entity: 'companies',
                                id: company.id,
                                data: {
                                  prospectingStatus:
                                    SIMPLE_TO_CANONICAL_STATUS[
                                      event.target
                                        .value as SimpleProspectingStage
                                    ],
                                },
                              },
                              'Etapa atualizada.',
                            )
                          }
                        >
                          {SIMPLE_PROSPECTING_STAGES.map(([value, text]) => (
                            <NativeSelectOption key={value} value={value}>
                              {text}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </TableCell>
                      <TableCell>
                        {datePt(last?.occurredAt)}
                        {last?.result && (
                          <div className="max-w-40 truncate text-xs text-muted-foreground">
                            {last.result}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {company.nextAction || 'Nenhum'}
                        <div className="text-xs text-muted-foreground">
                          {datePt(company.nextActionAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            title="Registrar contato"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              openCreate('interactions', {
                                companyId: company.id,
                              })
                            }
                          >
                            <MessageCircle />
                          </Button>
                          {company.whatsapp && (
                            <Button
                              title="Copiar WhatsApp"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() =>
                                void navigator.clipboard.writeText(
                                  company.whatsapp || '',
                                )
                              }
                            >
                              <Copy />
                            </Button>
                          )}
                          {researched?.suggestedMessage && (
                            <Button
                              title="Copiar mensagem sugerida"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() =>
                                void navigator.clipboard.writeText(
                                  researched.suggestedMessage || '',
                                )
                              }
                            >
                              <MessageCircle />
                            </Button>
                          )}
                          {company.website && (
                            <Button
                              title="Abrir site"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() =>
                                window.open(
                                  company.website || '',
                                  '_blank',
                                  'noopener,noreferrer',
                                )
                              }
                            >
                              <Globe2 />
                            </Button>
                          )}
                          {company.instagram && (
                            <Button
                              title="Abrir Instagram"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() =>
                                window.open(
                                  company.instagram?.startsWith('http')
                                    ? company.instagram
                                    : `https://instagram.com/${company.instagram?.replace('@', '')}`,
                                  '_blank',
                                  'noopener,noreferrer',
                                )
                              }
                            >
                              <Camera />
                            </Button>
                          )}
                          <Button
                            title="Marcar reunião"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              openCreate('meetings', { companyId: company.id })
                            }
                          >
                            <CalendarClock />
                          </Button>
                          <Button
                            title="Sem interesse"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              void mutate(
                                {
                                  action: 'update',
                                  entity: 'companies',
                                  id: company.id,
                                  data: { prospectingStatus: 'SEM_INTERESSE' },
                                },
                                'Lead marcado como não convertido.',
                              )
                            }
                          >
                            <ThumbsDown />
                          </Button>
                          <Button
                            title="Converter em cliente"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              window.confirm(
                                'Converter este lead no mesmo registro de cliente?',
                              ) &&
                              void mutate(
                                {
                                  action: 'update',
                                  entity: 'companies',
                                  id: company.id,
                                  data: { prospectingStatus: 'FECHADO' },
                                },
                                'Lead convertido em cliente sem duplicação.',
                              )
                            }
                          >
                            <CheckCircle2 />
                          </Button>
                          <Button
                            title="Retomar depois"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => {
                              const date = window.prompt(
                                'Data para retomar (AAAA-MM-DD):',
                              );
                              if (!date) return;
                              void mutate(
                                {
                                  action: 'update',
                                  entity: 'companies',
                                  id: company.id,
                                  data: {
                                    prospectingStatus: 'FOLLOWUP_FUTURO',
                                    nextAction: 'Retomar contato',
                                    nextActionAt: `${date}T12:00:00-03:00`,
                                  },
                                },
                                'Contato agendado para depois.',
                              );
                            }}
                          >
                            <CalendarPlus />
                          </Button>
                          <Button
                            title="Criar follow-up"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              openCreate('tasks', {
                                companyId: company.id,
                                type: 'follow_up',
                              })
                            }
                          >
                            <CalendarPlus />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              analysis
                                ? openEdit('digitalAnalyses', analysis)
                                : openCreate('digitalAnalyses', {
                                    companyId: company.id,
                                    hasSite: Boolean(company.website),
                                    websiteUrl: company.website || '',
                                  })
                            }
                          >
                            {analysis ? 'Análise' : 'Analisar'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!rows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Nenhum lead corresponde aos filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
