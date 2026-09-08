'use client';

import {
  CalendarPlus,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
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

export type ProspectingData = {
  companies: Company[];
  digitalAnalyses: Analysis[];
  interactions: Interaction[];
  tasks: Task[];
  opportunities: Opportunity[];
  pipelineStages: Stage[];
};

const statuses = [
  'NOVO_LEAD',
  'PESQUISANDO',
  'PRONTO_PARA_CONTATO',
  'CONTATO_WHATSAPP',
  'CONTATO_EMAIL',
  'CONTATO_TELEFONE',
  'SEM_RESPOSTA',
  'RESPONDEU',
  'INTERESSADO',
  'REUNIAO_AGENDADA',
  'REUNIAO_REALIZADA',
  'PROPOSTA_ENVIADA',
  'NEGOCIACAO',
  'FOLLOWUP_FUTURO',
  'FECHADO',
  'PERDIDO',
  'DESCARTADO',
  'NUMERO_INVALIDO',
  'EMAIL_INVALIDO',
  'JA_POSSUI_FORNECEDOR',
  'SEM_INTERESSE',
] as const;

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
    entity: 'companies' | 'digitalAnalyses' | 'interactions' | 'tasks',
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
  const [prospectingStatus, setProspectingStatus] = useState('');
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
  const rows = data.companies.filter((company) => {
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
      (!prospectingStatus || company.prospectingStatus === prospectingStatus)
    );
  });
  const closed = data.companies.filter(
    (row) => row.prospectingStatus === 'FECHADO',
  ).length;
  const openPool = data.companies.filter(
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            'Novos leads',
            data.companies.filter(
              (row) => row.prospectingStatus === 'NOVO_LEAD',
            ).length,
          ],
          [
            'Sem resposta',
            data.companies.filter(
              (row) => row.prospectingStatus === 'SEM_RESPOSTA',
            ).length,
          ],
          [
            'Interessados',
            data.companies.filter(
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
              onChange={(event) => setProspectingStatus(event.target.value)}
            >
              <NativeSelectOption value="">Qualquer etapa</NativeSelectOption>
              {statuses.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {readable(value)}
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
                        value={company.prospectingStatus}
                        onChange={(event) =>
                          mutate(
                            {
                              action: 'update',
                              entity: 'companies',
                              id: company.id,
                              data: { prospectingStatus: event.target.value },
                            },
                            'Etapa atualizada.',
                          )
                        }
                      >
                        <NativeSelectOption value={company.prospectingStatus}>
                          {readable(company.prospectingStatus)}
                        </NativeSelectOption>
                        {statuses
                          .filter(
                            (value) => value !== company.prospectingStatus,
                          )
                          .map((value) => (
                            <NativeSelectOption key={value} value={value}>
                              {readable(value)}
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
        </CardContent>
      </Card>
    </div>
  );
}
