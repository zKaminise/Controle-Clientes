'use client';

import {
  AlertTriangle,
  Archive,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Command,
  Copy,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Globe2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Tags,
  Target,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { authClient } from '@/lib/auth-client';
import { whatsappUrl } from '@/lib/business';
import { renderTemplate } from '@/lib/email-templates';

type Primitive = string | number | boolean | null | undefined;
type Row = Record<string, Primitive> & { id: string };
type User = {
  id: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
};
type Company = Row & {
  name: string;
  lifecycleStatus: string;
  relationshipStatus: string;
  healthStatus: string;
  nextContactAt?: string | null;
  website?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  contactFrequencyMonths?: number | null;
};
type Contact = Row & {
  companyId: string;
  name: string;
  email?: string | null;
  whatsapp?: string | null;
  role?: string | null;
  isPrimary: boolean;
  isFinancialContact: boolean;
};
type Stage = Row & {
  name: string;
  slug: string;
  position: number;
  color?: string | null;
  isWon: boolean;
  isLost: boolean;
};
type Opportunity = Row & {
  companyId: string;
  pipelineStageId: string;
  title: string;
  estimatedValue: string;
  probability: number;
  nextAction?: string | null;
  nextActionAt?: string | null;
  lostReason?: string | null;
};
type Project = Row & {
  companyId: string;
  name: string;
  type: string;
  status: string;
  soldValue: string;
  productionUrl?: string | null;
};
type Domain = Row & {
  companyId: string;
  projectId?: string | null;
  domain: string;
  expirationDate: string;
  responsibility: string;
  registeredUnderMyAccount: boolean;
  clientRenewalPrice: string;
  registrar?: string | null;
};
type Subscription = Row & {
  companyId: string;
  projectId?: string | null;
  serviceId?: string | null;
  description: string;
  amount: string;
  frequency: string;
  billingDay: number;
  nextChargeDate: string;
  status: string;
};
type Charge = Row & {
  companyId: string;
  projectId?: string | null;
  subscriptionId?: string | null;
  description: string;
  category: string;
  amount: string;
  dueDate: string;
  status: string;
  billingPeriod?: string | null;
};
type Payment = Row & {
  chargeId: string;
  amount: string;
  paidAt: string;
  paymentMethod?: string | null;
};
type Task = Row & {
  companyId?: string | null;
  title: string;
  type: string;
  dueAt: string;
  priority: string;
  status: string;
  description?: string | null;
};
type Proposal = Row & {
  companyId: string;
  opportunityId?: string | null;
  title: string;
  finalAmount: string;
  status: string;
  validUntil?: string | null;
};
type Meeting = Row & {
  companyId: string;
  opportunityId?: string | null;
  title: string;
  meetingAt: string;
  type: string;
};
type Interaction = Row & {
  companyId: string;
  type: string;
  subject?: string | null;
  content: string;
  occurredAt: string;
};
type Template = Row & {
  name: string;
  category: string;
  subject?: string | null;
  content: string;
  channel: string;
};
type Notification = Row & {
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
};
type Tag = Row & { name: string; color?: string | null };
type ServiceRow = Row & {
  companyId?: string | null;
  provider?: string | null;
  name?: string | null;
  status?: string | null;
};
type ActivityRow = Row & {
  companyId?: string | null;
  entityType: string;
  action: string;
  description: string;
  createdAt: string;
};
type SettingsData = {
  id: string;
  businessName: string;
  timezone: string;
  currency: string;
  theme: 'light' | 'dark' | 'system';
  domainAlertDays: number[];
  defaultPostSaleMonths: number;
};
type AppData = {
  user: User;
  companies: Company[];
  archivedCompanies: Company[];
  contacts: Contact[];
  pipelineStages: Stage[];
  opportunities: Opportunity[];
  projects: Project[];
  domains: Domain[];
  hostingServices: ServiceRow[];
  emailServices: ServiceRow[];
  services: Row[];
  subscriptions: Subscription[];
  charges: Charge[];
  payments: Payment[];
  proposals: Proposal[];
  meetings: Meeting[];
  tasks: Task[];
  interactions: Interaction[];
  messageTemplates: Template[];
  messageLogs: Row[];
  notifications: Notification[];
  tags: Tag[];
  companyTags: Array<{ companyId: string; tagId: string }>;
  activities: ActivityRow[];
  settings: SettingsData | null;
};

type PageKey =
  | 'dashboard'
  | 'attention'
  | 'companies'
  | 'projects'
  | 'pipeline'
  | 'finance'
  | 'domains'
  | 'agenda'
  | 'commercial'
  | 'messages'
  | 'reports'
  | 'settings';
type Entity =
  | 'companies'
  | 'contacts'
  | 'pipelineStages'
  | 'opportunities'
  | 'projects'
  | 'domains'
  | 'hostingServices'
  | 'emailServices'
  | 'services'
  | 'subscriptions'
  | 'charges'
  | 'proposals'
  | 'meetings'
  | 'tasks'
  | 'interactions'
  | 'messageTemplates'
  | 'tags';
type FormValues = Record<string, Primitive>;
type FormState = {
  entity: Entity;
  values: FormValues;
  id?: string;
  title?: string;
};
type Field = {
  key: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'url'
    | 'date'
    | 'datetime-local'
    | 'number'
    | 'textarea'
    | 'select'
    | 'checkbox';
  options?: Array<[string, string]>;
  source?: 'companies' | 'stages' | 'projects' | 'services' | 'opportunities';
  wide?: boolean;
  required?: boolean;
};

const nav: Array<[PageKey, string, typeof LayoutDashboard]> = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['attention', 'Minha atenção', AlertTriangle],
  ['companies', 'Clientes', Users],
  ['pipeline', 'Pipeline', Target],
  ['projects', 'Projetos', BriefcaseBusiness],
  ['finance', 'Financeiro', CircleDollarSign],
  ['domains', 'Domínios', Globe2],
  ['agenda', 'Agenda', CalendarDays],
  ['commercial', 'Propostas & reuniões', FileText],
  ['messages', 'Comunicação', MessageCircle],
  ['reports', 'Relatórios', FileSpreadsheet],
  ['settings', 'Configurações', Settings],
];

const titles: Record<PageKey, [string, string]> = {
  dashboard: ['Bom dia, Gabriel.', 'Sua operação em números e próximas ações.'],
  attention: [
    'Precisa da sua atenção',
    'Pendências ordenadas por urgência e data.',
  ],
  companies: [
    'Clientes e prospects',
    'Relacionamentos, contatos, tags e visão 360º.',
  ],
  projects: ['Projetos', 'Entregas, tecnologias e infraestrutura vinculada.'],
  pipeline: [
    'Pipeline comercial',
    'Arraste oportunidades e registre ganho ou perda.',
  ],
  finance: ['Financeiro', 'Assinaturas, cobranças independentes e pagamentos.'],
  domains: ['Domínios', 'Renovações e responsabilidades sob controle.'],
  agenda: ['Agenda operacional', 'Tarefas, reuniões e vencimentos reunidos.'],
  commercial: ['Propostas e reuniões', 'Negociação e compromissos comerciais.'],
  messages: ['Comunicação', 'Templates, WhatsApp e e-mails registrados.'],
  reports: [
    'Relatórios',
    'Indicadores comerciais, financeiros e operacionais.',
  ],
  settings: [
    'Configurações',
    'Preferências, pipeline, segurança e portabilidade.',
  ],
};

export function OperationsApp({ initialUser }: { initialUser: User }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [page, setPage] = useState<PageKey>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState<FormState | null>(null);
  const [company360, setCompany360] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      title: string;
      subtitle?: string | null;
      section: string;
    }>
  >([]);

  const loadData = useCallback(async () => {
    const response = await fetch('/api/app', { cache: 'no-store' });
    if (response.status === 401) {
      router.replace('/login');
      return;
    }
    if (!response.ok)
      throw new Error(
        'Não foi possível carregar sua operação. Verifique a configuração do banco.',
      );
    setData((await response.json()) as AppData);
  }, [router]);

  useEffect(() => {
    loadData().catch((error) =>
      setToast(error instanceof Error ? error.message : 'Falha ao carregar.'),
    );
  }, [loadData]);
  useEffect(() => {
    const saved = localStorage.getItem('ops-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system')
      setTheme(saved);
  }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle(
        'dark',
        theme === 'dark' || (theme === 'system' && media.matches),
      );
    apply();
    localStorage.setItem('ops-theme', theme);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [page]);
  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(search)}`,
      );
      if (!response.ok) return;
      const result = (await response.json()) as Record<
        string,
        Array<{ id: string; title: string; subtitle?: string | null }>
      >;
      setSearchResults(
        Object.entries(result).flatMap(([section, rows]) =>
          rows.map((row) => ({ ...row, section })),
        ),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  async function mutate(payload: object, success = 'Salvo com sucesso.') {
    setBusy(true);
    try {
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || 'Não foi possível concluir.');
      await loadData();
      setForm(null);
      setToast(success);
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : 'Não foi possível concluir.',
      );
    } finally {
      setBusy(false);
    }
  }

  function openCreate(entity: Entity, preset: FormValues = {}) {
    setForm({ entity, values: { ...defaults(entity, data), ...preset } });
  }
  function openEdit(entity: Entity, row: Row) {
    const allowed = new Set(fields(entity).map((field) => field.key));
    setForm({
      entity,
      id: row.id,
      values: Object.fromEntries(
        Object.entries(row)
          .filter(([key]) => allowed.has(key))
          .map(([key, value]) => [key, toInputValue(value)]),
      ),
    });
  }
  async function logout() {
    await authClient.signOut();
    router.replace('/login');
    router.refresh();
  }
  async function importCompanies(file: File) {
    const content = await file.text();
    const validation = await fetch('/api/import/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, confirm: false }),
    });
    const preview = (await validation.json()) as {
      error?: string;
      summary?: {
        total: number;
        valid: number;
        invalid: number;
        duplicates: number;
      };
    };
    if (!validation.ok || !preview.summary)
      return setToast(preview.error || 'CSV inválido.');
    const summary = preview.summary;
    if (summary.invalid || summary.duplicates)
      return setToast(
        `Prévia: ${summary.valid} válidas, ${summary.invalid} inválidas e ${summary.duplicates} possíveis duplicadas. Corrija o arquivo antes de importar.`,
      );
    if (!window.confirm(`Importar ${summary.valid} empresas validadas?`))
      return;
    const confirmed = await fetch('/api/import/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, confirm: true }),
    });
    const result = (await confirmed.json()) as {
      error?: string;
      imported?: number;
    };
    if (!confirmed.ok) return setToast(result.error || 'Falha na importação.');
    await loadData();
    setToast(`${result.imported} empresas importadas.`);
  }

  if (!data) return <LoadingScreen />;
  const company = company360
    ? data.companies.find((item) => item.id === company360) || null
    : null;
  const unread = data.notifications.filter((item) => !item.readAt).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mobileOpen && (
        <button
          aria-label="Fechar navegação"
          className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <div>
              <p className="text-sm font-semibold leading-none tracking-tight">
                Minha Operação
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Controle de clientes
              </p>
            </div>
          </div>
          <Button
            className="lg:hidden"
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(false)}
          >
            <X />
          </Button>
        </div>
        <nav
          className="space-y-0.5 overflow-y-auto"
          aria-label="Navegação principal"
        >
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => {
                setPage(key);
                setFilter('all');
                setMobileOpen(false);
              }}
              className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors ${page === key ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground'}`}
            >
              <Icon
                className={`size-4 ${page === key ? 'text-primary' : ''}`}
              />
              <span>{label}</span>
              {key === 'attention' &&
                data.tasks.filter(
                  (task) =>
                    task.status === 'open' &&
                    new Date(task.dueAt) <= new Date(),
                ).length > 0 && (
                  <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {
                      data.tasks.filter(
                        (task) =>
                          task.status === 'open' &&
                          new Date(task.dueAt) <= new Date(),
                      ).length
                    }
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-sidebar-border bg-background/70 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
              GM
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">
                {initialUser.name}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                Administrador
              </p>
            </div>
            <Button
              title="Sair"
              variant="ghost"
              size="icon-xs"
              onClick={logout}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/88 px-4 backdrop-blur-xl sm:px-7">
          <Button
            className="lg:hidden"
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <div className="relative hidden max-w-lg flex-1 sm:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 border-transparent bg-muted/70 pl-9 focus-visible:bg-background"
              placeholder="Buscar empresa, contato, domínio ou projeto..."
            />
            {searchResults.length > 0 && (
              <div className="absolute inset-x-0 top-11 z-50 max-h-80 overflow-y-auto rounded-xl border bg-popover p-2 shadow-xl">
                {searchResults.map((result) => (
                  <button
                    key={`${result.section}-${result.id}`}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      const companyId = data.companies.some(
                        (item) => item.id === result.id,
                      )
                        ? result.id
                        : (result as { companyId?: string }).companyId;
                      if (companyId) setCompany360(companyId);
                      setSearch('');
                      setSearchResults([]);
                    }}
                  >
                    <Search className="size-3.5 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {result.title}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {label(result.section)} · {result.subtitle}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              aria-label="Alternar tema"
              variant="ghost"
              size="icon"
              onClick={() =>
                setTheme(
                  theme === 'light'
                    ? 'dark'
                    : theme === 'dark'
                      ? 'system'
                      : 'light',
                )
              }
            >
              {theme === 'light' ? (
                <Sun />
              ) : theme === 'dark' ? (
                <Moon />
              ) : (
                <Settings />
              )}
            </Button>
            <Button
              aria-label="Notificações"
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Button>
            <Button
              onClick={() => openCreate(defaultEntity(page))}
              className="ml-1 h-9 gap-2 rounded-lg px-3 shadow-sm"
            >
              <Plus />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
          <PageHeading page={page} />
          {page === 'dashboard' && (
            <Dashboard data={data} setPage={setPage} openCreate={openCreate} />
          )}
          {page === 'attention' && (
            <AttentionPage data={data} mutate={mutate} />
          )}
          {page === 'companies' && (
            <CompaniesPage
              data={data}
              filter={filter}
              setFilter={setFilter}
              openCreate={openCreate}
              openEdit={openEdit}
              openCompany={setCompany360}
              mutate={mutate}
              onImport={() => fileRef.current?.click()}
            />
          )}
          {page === 'pipeline' && (
            <PipelinePage
              data={data}
              openCreate={openCreate}
              openCompany={setCompany360}
              mutate={mutate}
            />
          )}
          {page === 'projects' && (
            <ProjectsPage
              data={data}
              openCreate={openCreate}
              openEdit={openEdit}
              mutate={mutate}
            />
          )}
          {page === 'finance' && (
            <FinancePage
              data={data}
              filter={filter}
              setFilter={setFilter}
              openCreate={openCreate}
              openEdit={openEdit}
              mutate={mutate}
            />
          )}
          {page === 'domains' && (
            <DomainsPage
              data={data}
              filter={filter}
              setFilter={setFilter}
              openCreate={openCreate}
              openEdit={openEdit}
              mutate={mutate}
            />
          )}
          {page === 'agenda' && (
            <AgendaPage data={data} openCreate={openCreate} mutate={mutate} />
          )}
          {page === 'commercial' && (
            <CommercialPage
              data={data}
              openCreate={openCreate}
              openEdit={openEdit}
              mutate={mutate}
            />
          )}
          {page === 'messages' && (
            <MessagesPage
              data={data}
              openCreate={openCreate}
              openEdit={openEdit}
              setToast={setToast}
            />
          )}
          {page === 'reports' && <ReportsPage data={data} />}
          {page === 'settings' && (
            <SettingsPage
              data={data}
              theme={theme}
              setTheme={setTheme}
              openCreate={openCreate}
              openEdit={openEdit}
              setPasswordOpen={setPasswordOpen}
              setToast={setToast}
              mutate={mutate}
            />
          )}
        </main>
      </div>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importCompanies(file);
          event.currentTarget.value = '';
        }}
      />
      <RecordDialog
        form={form}
        data={data}
        busy={busy}
        onClose={() => setForm(null)}
        onChange={(values) => form && setForm({ ...form, values })}
        onSave={() =>
          form &&
          mutate({
            action: form.id ? 'update' : 'create',
            entity: form.entity,
            id: form.id,
            data: form.values,
          })
        }
      />
      <Company360Dialog
        company={company}
        data={data}
        onClose={() => setCompany360(null)}
        openCreate={openCreate}
        openEdit={openEdit}
        mutate={mutate}
      />
      <NotificationsDialog
        open={notificationsOpen}
        data={data}
        onClose={() => setNotificationsOpen(false)}
        mutate={mutate}
      />
      <PasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        setToast={setToast}
      />
      {toast && (
        <output className="fixed bottom-5 right-5 z-[100] flex max-w-sm items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium shadow-xl">
          <CheckCircle2 className="size-4 text-primary" />
          {toast}
        </output>
      )}
    </div>
  );
}

function Dashboard({
  data,
  setPage,
  openCreate,
}: {
  data: AppData;
  setPage: (page: PageKey) => void;
  openCreate: (entity: Entity, preset?: FormValues) => void;
}) {
  const activeClients = data.companies.filter(
    (item) => item.lifecycleStatus === 'client',
  ).length;
  const activeSubscriptions = data.subscriptions.filter(
    (item) => item.status === 'active',
  );
  const mrr = activeSubscriptions.reduce(
    (sum, item) =>
      sum +
      Number(item.amount) /
        ({ monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[
          item.frequency
        ] || 1),
    0,
  );
  const openAmount = data.charges
    .filter((item) => ['pending', 'overdue'].includes(item.status))
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const received = data.payments.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const attention = attentionItems(data).slice(0, 7);
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Clientes ativos"
          value={String(activeClients)}
          detail={`${activeSubscriptions.length} assinaturas ativas`}
          icon={Users}
        />
        <Metric
          label="MRR normalizado"
          value={money(mrr)}
          detail="Calculado pelas assinaturas"
          icon={RefreshCw}
        />
        <Metric
          label="Em aberto"
          value={money(openAmount)}
          detail={`${data.charges.filter((item) => item.status === 'overdue').length} cobranças atrasadas`}
          icon={CreditCard}
        />
        <Metric
          label="Recebido"
          value={money(received)}
          detail="Pagamentos registrados"
          icon={Banknote}
        />
      </section>
      <section className="mt-7 grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
        <Panel
          title="Precisa da sua atenção"
          subtitle={`${attention.length} itens mais urgentes`}
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage('attention')}
            >
              Ver tudo <ChevronRight />
            </Button>
          }
        >
          <AttentionList items={attention} />
        </Panel>
        <Panel title="Ações rápidas" subtitle="Cadastre sem perder o contexto">
          <div className="grid grid-cols-2 gap-2 p-5">
            {[
              ['Cliente', 'companies', Users],
              ['Oportunidade', 'opportunities', Target],
              ['Assinatura', 'subscriptions', RefreshCw],
              ['Cobrança', 'charges', CreditCard],
              ['Tarefa', 'tasks', CheckCircle2],
              ['Domínio', 'domains', Globe2],
            ].map(([text, entity, Icon]) => (
              <Button
                key={String(entity)}
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => openCreate(entity as Entity)}
              >
                <Icon className="size-5 text-primary" />
                {String(text)}
              </Button>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function AttentionPage({
  data,
  mutate,
}: {
  data: AppData;
  mutate: (payload: object, success?: string) => Promise<void>;
}) {
  const items = attentionItems(data);
  return (
    <Panel
      title="Fila de atenção"
      subtitle="Cobranças, domínios, tarefas, follow-ups e reuniões"
    >
      <AttentionList
        items={items}
        onComplete={(id) =>
          mutate({ action: 'completeTask', id }, 'Tarefa concluída.')
        }
      />
    </Panel>
  );
}

function CompaniesPage({
  data,
  filter,
  setFilter,
  openCreate,
  openEdit,
  openCompany,
  mutate,
  onImport,
}: {
  data: AppData;
  filter: string;
  setFilter: (value: string) => void;
  openCreate: (entity: Entity, preset?: FormValues) => void;
  openEdit: (entity: Entity, row: Row) => void;
  openCompany: (id: string) => void;
  mutate: (payload: object, success?: string) => Promise<void>;
  onImport: () => void;
}) {
  const sourceRows =
    filter === 'archived' ? data.archivedCompanies : data.companies;
  const rows = sourceRows.filter(
    (company) =>
      filter === 'archived' ||
      filter === 'all' ||
      filter === company.lifecycleStatus ||
      (filter === 'recurring' &&
        company.relationshipStatus === 'active_recurring') ||
      (filter === 'no_contact' && !company.nextContactAt),
  );
  return (
    <Panel
      title="Base de relacionamentos"
      subtitle={`${rows.length} de ${filter === 'archived' ? data.archivedCompanies.length : data.companies.length} empresas`}
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onImport}>
            <Upload />
            Importar CSV
          </Button>
          <a
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
            href="/api/import/companies/template"
          >
            <Download className="size-3.5" />
            Modelo CSV
          </a>
          <ExportButton entity="companies" />
        </div>
      }
    >
      <FilterBar
        value={filter}
        onChange={setFilter}
        options={[
          ['all', 'Todos'],
          ['client', 'Clientes'],
          ['prospect', 'Prospects'],
          ['former_client', 'Ex-clientes'],
          ['recurring', 'Recorrentes'],
          ['no_contact', 'Sem contato'],
          ['archived', 'Arquivadas'],
        ]}
      />
      <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((company) => {
          const primary =
            data.contacts.find(
              (contact) =>
                contact.companyId === company.id && contact.isPrimary,
            ) ||
            data.contacts.find((contact) => contact.companyId === company.id);
          const companyTags = data.companyTags
            .filter((item) => item.companyId === company.id)
            .map((item) => data.tags.find((tag) => tag.id === item.tagId))
            .filter(Boolean) as Tag[];
          return (
            <article
              key={company.id}
              className="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <button
                className="w-full text-left"
                onClick={() => filter !== 'archived' && openCompany(company.id)}
              >
                <div className="flex items-start gap-3">
                  <ToneIcon
                    tone={
                      company.healthStatus === 'critical'
                        ? 'rose'
                        : company.healthStatus === 'attention'
                          ? 'amber'
                          : 'green'
                    }
                    icon={Users}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{company.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {primary?.name ||
                        company.email ||
                        'Sem contato principal'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      company.lifecycleStatus === 'client'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {label(company.lifecycleStatus)}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-1">
                  {companyTags.map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Próximo contato: {datePt(company.nextContactAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {primary?.whatsapp ||
                    company.whatsapp ||
                    'WhatsApp não informado'}
                </p>
              </button>
              <div className="mt-4 flex justify-end gap-1 border-t pt-3">
                {filter !== 'archived' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCompany(company.id)}
                  >
                    Ver 360º
                  </Button>
                )}
                {filter !== 'archived' ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit('companies', company)}
                    >
                      <Settings />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        window.confirm('Arquivar esta empresa?') &&
                        void mutate(
                          {
                            action: 'archive',
                            entity: 'companies',
                            id: company.id,
                          },
                          'Empresa arquivada.',
                        )
                      }
                    >
                      <Archive />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void mutate(
                        {
                          action: 'restore',
                          entity: 'companies',
                          id: company.id,
                        },
                        'Empresa restaurada.',
                      )
                    }
                  >
                    <RefreshCw /> Restaurar
                  </Button>
                )}
              </div>
            </article>
          );
        })}
        {!rows.length && (
          <EmptyCards
            text="Nenhuma empresa neste filtro."
            onAdd={() => openCreate('companies')}
          />
        )}
      </div>
    </Panel>
  );
}

function PipelinePage({
  data,
  openCreate,
  openCompany,
  mutate,
}: {
  data: AppData;
  openCreate: (entity: Entity, preset?: FormValues) => void;
  openCompany: (id: string) => void;
  mutate: (payload: object, success?: string) => Promise<void>;
}) {
  function moveOpportunity(id: string, stage: Stage) {
    const lostReason = stage.isLost
      ? window.prompt('Motivo da perda (recomendado):')
      : undefined;
    void mutate(
      {
        action: 'moveOpportunity',
        id,
        pipelineStageId: stage.id,
        lostReason,
      },
      stage.isWon
        ? 'Oportunidade ganha e empresa convertida em cliente.'
        : stage.isLost
          ? 'Perda registrada.'
          : 'Etapa atualizada.',
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4">
        {data.pipelineStages.map((stage) => {
          const rows = data.opportunities.filter(
            (item) => item.pipelineStageId === stage.id,
          );
          return (
            <section
              key={stage.id}
              className="w-[300px] shrink-0 rounded-2xl border bg-muted/30"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = event.dataTransfer.getData('text/opportunity');
                if (!id) return;
                moveOpportunity(id, stage);
              }}
            >
              <header className="flex items-center justify-between border-b p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: stage.color || '#64748b' }}
                    />
                    <h2 className="text-sm font-semibold">{stage.name}</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rows.length} ·{' '}
                    {money(
                      rows.reduce(
                        (sum, row) => sum + Number(row.estimatedValue),
                        0,
                      ),
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    openCreate('opportunities', { pipelineStageId: stage.id })
                  }
                >
                  <Plus />
                </Button>
              </header>
              <div className="min-h-28 space-y-3 p-3">
                {rows.map((opportunity) => (
                  <article
                    draggable
                    key={opportunity.id}
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        'text/opportunity',
                        opportunity.id,
                      )
                    }
                    className="cursor-grab rounded-xl border bg-card p-4 shadow-sm active:cursor-grabbing"
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => openCompany(opportunity.companyId)}
                    >
                      <p className="text-sm font-semibold">
                        {opportunity.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {companyName(data, opportunity.companyId)}
                      </p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {money(Number(opportunity.estimatedValue))}
                        </span>
                        <Badge variant="secondary">
                          {opportunity.probability}%
                        </Badge>
                      </div>
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        {opportunity.nextAction || 'Próxima ação não definida'}{' '}
                        · {datePt(opportunity.nextActionAt)}
                      </p>
                    </button>
                    <NativeSelect
                      aria-label={`Mover ${opportunity.title} para etapa`}
                      className="mt-3 w-full"
                      value={opportunity.pipelineStageId}
                      onChange={(event) => {
                        const targetStage = data.pipelineStages.find(
                          (item) => item.id === event.target.value,
                        );
                        if (targetStage)
                          moveOpportunity(opportunity.id, targetStage);
                      }}
                    >
                      {data.pipelineStages.map((targetStage) => (
                        <NativeSelectOption
                          key={targetStage.id}
                          value={targetStage.id}
                        >
                          Mover para: {targetStage.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ProjectsPage({ data, openCreate, openEdit, mutate }: CrudPageProps) {
  return (
    <Panel
      title="Projetos ativos"
      subtitle={`${data.projects.length} projetos cadastrados`}
      action={<ExportButton entity="projects" />}
    >
      <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.projects.map((project) => (
          <RecordCard
            key={project.id}
            icon={BriefcaseBusiness}
            title={project.name}
            subtitle={companyName(data, project.companyId)}
            badge={label(project.status)}
            lines={[
              label(project.type),
              project.productionUrl || 'URL de produção pendente',
            ]}
            value={money(Number(project.soldValue))}
            onEdit={() => openEdit('projects', project)}
            onArchive={() =>
              window.confirm('Arquivar projeto?') &&
              void mutate(
                { action: 'archive', entity: 'projects', id: project.id },
                'Projeto arquivado.',
              )
            }
          />
        ))}
        {!data.projects.length && (
          <EmptyCards
            text="Cadastre seu primeiro projeto."
            onAdd={() => openCreate('projects')}
          />
        )}
      </div>
    </Panel>
  );
}

function FinancePage({
  data,
  filter,
  setFilter,
  openCreate,
  openEdit,
  mutate,
}: CrudPageProps & { filter: string; setFilter: (value: string) => void }) {
  const charges = data.charges.filter(
    (charge) =>
      filter === 'all' ||
      charge.status === filter ||
      (filter === 'subscription' && charge.subscriptionId),
  );
  const mrr = data.subscriptions
    .filter((item) => item.status === 'active')
    .reduce(
      (sum, item) =>
        sum +
        Number(item.amount) /
          ({ monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[
            item.frequency
          ] || 1),
      0,
    );
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="MRR"
          value={money(mrr)}
          detail="Normalizado por frequência"
          icon={RefreshCw}
        />
        <Metric
          label="Em aberto"
          value={money(
            data.charges
              .filter((item) => ['pending', 'overdue'].includes(item.status))
              .reduce((sum, item) => sum + Number(item.amount), 0),
          )}
          detail="Pendente + atrasado"
          icon={CreditCard}
        />
        <Metric
          label="Recebido"
          value={money(
            data.payments.reduce((sum, item) => sum + Number(item.amount), 0),
          )}
          detail={`${data.payments.length} pagamentos`}
          icon={Banknote}
        />
      </section>
      <Panel
        title="Assinaturas"
        subtitle="Geram períodos antecipadamente, independentemente de pagamento"
        action={
          <Button size="sm" onClick={() => openCreate('subscriptions')}>
            <Plus />
            Assinatura
          </Button>
        }
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.subscriptions.map((subscription) => (
            <article key={subscription.id} className="rounded-xl border p-4">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold">{subscription.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {companyName(data, subscription.companyId)}
                  </p>
                </div>
                <Badge
                  variant={
                    subscription.status === 'active' ? 'default' : 'secondary'
                  }
                >
                  {label(subscription.status)}
                </Badge>
              </div>
              <p className="mt-4 text-lg font-semibold">
                {money(Number(subscription.amount))}
              </p>
              <p className="text-xs text-muted-foreground">
                {label(subscription.frequency)} · próxima{' '}
                {datePt(subscription.nextChargeDate)}
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={() => openEdit('subscriptions', subscription)}
              >
                Editar
              </Button>
            </article>
          ))}
        </div>
      </Panel>
      <Panel
        title="Cobranças"
        subtitle={`${charges.length} resultados`}
        action={
          <div className="flex gap-2">
            <ExportButton entity="charges" />
            <Button size="sm" onClick={() => openCreate('charges')}>
              <Plus />
              Cobrança
            </Button>
          </div>
        }
      >
        <FilterBar
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'Todas'],
            ['scheduled', 'Agendadas'],
            ['pending', 'Pendentes'],
            ['overdue', 'Atrasadas'],
            ['paid', 'Pagas'],
            ['subscription', 'Recorrentes'],
          ]}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {charges.map((charge) => (
              <TableRow key={charge.id}>
                <TableCell className="font-medium">
                  {charge.description}
                </TableCell>
                <TableCell>{companyName(data, charge.companyId)}</TableCell>
                <TableCell>{charge.billingPeriod || 'Pontual'}</TableCell>
                <TableCell>{datePt(charge.dueDate)}</TableCell>
                <TableCell>
                  <StatusBadge status={charge.status} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {money(Number(charge.amount))}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {charge.status !== 'paid' &&
                      charge.status !== 'cancelled' && (
                        <Button
                          size="sm"
                          onClick={() =>
                            void mutate(
                              { action: 'markPaid', id: charge.id },
                              'Pagamento registrado.',
                            )
                          }
                        >
                          Marcar pago
                        </Button>
                      )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit('charges', charge)}
                    >
                      <Settings />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

function DomainsPage({
  data,
  filter,
  setFilter,
  openCreate,
  openEdit,
  mutate,
}: CrudPageProps & { filter: string; setFilter: (value: string) => void }) {
  const rows = data.domains.filter((domain) => {
    const days = daysUntil(domain.expirationDate);
    return (
      filter === 'all' ||
      (filter === 'mine' && domain.responsibility === 'me') ||
      (filter === 'expired' && days < 0) ||
      (Number(filter) > 0 && days >= 0 && days <= Number(filter))
    );
  });
  return (
    <Panel
      title="Controle de domínios"
      subtitle={`${rows.filter((item) => item.responsibility === 'me').length} sob sua responsabilidade`}
      action={
        <div className="flex gap-2">
          <ExportButton entity="domains" />
          <Button size="sm" onClick={() => openCreate('domains')}>
            <Plus />
            Domínio
          </Button>
        </div>
      }
    >
      <FilterBar
        value={filter}
        onChange={setFilter}
        options={[
          ['all', 'Todos'],
          ['7', 'Até 7 dias'],
          ['30', 'Até 30 dias'],
          ['60', 'Até 60 dias'],
          ['mine', 'Minha responsabilidade'],
          ['expired', 'Vencidos'],
        ]}
      />
      <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((domain) => (
          <RecordCard
            key={domain.id}
            icon={Globe2}
            title={domain.domain}
            subtitle={companyName(data, domain.companyId)}
            badge={
              daysUntil(domain.expirationDate) < 0
                ? 'Vencido'
                : `${daysUntil(domain.expirationDate)} dias`
            }
            danger={domain.registeredUnderMyAccount}
            lines={[
              `Vence em ${datePt(domain.expirationDate)}`,
              domain.registrar || 'Registrador não informado',
              domain.registeredUnderMyAccount
                ? '⚠ DOMÍNIO SOB MINHA RESPONSABILIDADE'
                : `Responsabilidade: ${label(domain.responsibility)}`,
            ]}
            value={money(Number(domain.clientRenewalPrice))}
            onEdit={() => openEdit('domains', domain)}
            onArchive={() =>
              window.confirm('Arquivar domínio?') &&
              void mutate(
                { action: 'archive', entity: 'domains', id: domain.id },
                'Domínio arquivado.',
              )
            }
          />
        ))}
      </div>
    </Panel>
  );
}

function AgendaPage({
  data,
  openCreate,
  mutate,
}: {
  data: AppData;
  openCreate: (entity: Entity, preset?: FormValues) => void;
  mutate: (payload: object, success?: string) => Promise<void>;
}) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  const plusSeven = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const groups = ['overdue', 'today', 'upcoming', 'completed'] as const;
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const rows = data.tasks.filter((task) => taskGroup(task) === group);
        return (
          <Panel
            key={group}
            title={
              {
                overdue: 'Atrasadas',
                today: 'Hoje',
                upcoming: 'Próximas',
                completed: 'Concluídas',
              }[group]
            }
            subtitle={`${rows.length} tarefas`}
          >
            <div className="divide-y">
              {rows.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6"
                >
                  <button
                    aria-label="Concluir"
                    disabled={task.status === 'completed'}
                    onClick={() =>
                      void mutate(
                        { action: 'completeTask', id: task.id },
                        'Tarefa concluída.',
                      )
                    }
                    className={`grid size-5 place-items-center rounded-full border ${task.status === 'completed' ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary'}`}
                  >
                    {task.status === 'completed' && (
                      <Check className="size-3" />
                    )}
                  </button>
                  <div className="min-w-48 flex-1">
                    <p
                      className={`text-sm font-medium ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.companyId
                        ? companyName(data, task.companyId)
                        : task.description || label(task.type)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      task.priority === 'urgent' ? 'destructive' : 'secondary'
                    }
                  >
                    {label(task.priority)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {dateTimePt(task.dueAt)}
                  </span>
                  {task.status !== 'completed' && (
                    <div className="flex gap-1">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          void mutate(
                            {
                              action: 'snoozeTask',
                              id: task.id,
                              until: tomorrow,
                            },
                            'Adiada para amanhã.',
                          )
                        }
                      >
                        Amanhã
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          void mutate(
                            {
                              action: 'snoozeTask',
                              id: task.id,
                              until: plusSeven,
                            },
                            'Adiada por 7 dias.',
                          )
                        }
                      >
                        +7 dias
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          const date = window.prompt('Nova data (AAAA-MM-DD):');
                          if (date)
                            void mutate(
                              {
                                action: 'snoozeTask',
                                id: task.id,
                                until: `${date}T12:00:00-03:00`,
                              },
                              'Tarefa adiada.',
                            );
                        }}
                      >
                        Escolher
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
      <Button onClick={() => openCreate('tasks')}>
        <Plus />
        Nova tarefa
      </Button>
    </div>
  );
}

function CommercialPage({ data, openCreate, openEdit }: CrudPageProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel
        title="Propostas"
        subtitle={`${data.proposals.length} propostas`}
        action={
          <Button size="sm" onClick={() => openCreate('proposals')}>
            <Plus />
            Proposta
          </Button>
        }
      >
        <div className="divide-y">
          {data.proposals.map((proposal) => (
            <div key={proposal.id} className="flex items-center gap-3 p-5">
              <FileText className="size-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{proposal.title}</p>
                <p className="text-xs text-muted-foreground">
                  {companyName(data, proposal.companyId)} · válida até{' '}
                  {datePt(proposal.validUntil)}
                </p>
              </div>
              <span className="text-sm font-semibold">
                {money(Number(proposal.finalAmount))}
              </span>
              <StatusBadge status={proposal.status} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit('proposals', proposal)}
              >
                <Settings />
              </Button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        title="Reuniões"
        subtitle={`${data.meetings.length} compromissos`}
        action={
          <Button size="sm" onClick={() => openCreate('meetings')}>
            <Plus />
            Reunião
          </Button>
        }
      >
        <div className="divide-y">
          {data.meetings.map((meeting) => (
            <div key={meeting.id} className="flex items-center gap-3 p-5">
              <CalendarDays className="size-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{meeting.title}</p>
                <p className="text-xs text-muted-foreground">
                  {companyName(data, meeting.companyId)} ·{' '}
                  {dateTimePt(meeting.meetingAt)}
                </p>
              </div>
              <Badge variant="secondary">{label(meeting.type)}</Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit('meetings', meeting)}
              >
                <Settings />
              </Button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function MessagesPage({
  data,
  openCreate,
  openEdit,
  setToast,
}: {
  data: AppData;
  openCreate: (entity: Entity, preset?: FormValues) => void;
  openEdit: (entity: Entity, row: Row) => void;
  setToast: (message: string) => void;
}) {
  const [preview, setPreview] = useState<Template | null>(null);
  async function send(template: Template) {
    const to = window.prompt('E-mail do destinatário:');
    if (!to) return;
    const response = await fetch('/api/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: template.id,
        to,
        subject: template.subject || template.name,
        content: template.content,
        variables: { nome: 'Cliente', meu_nome: 'Gabriel' },
      }),
    });
    const result = (await response.json()) as { error?: string };
    setToast(
      response.ok
        ? 'E-mail enviado e registrado.'
        : result.error || 'Falha no envio.',
    );
  }
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.messageTemplates.map((template) => (
          <article key={template.id} className="rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="secondary">{label(template.category)}</Badge>
                <h3 className="mt-3 font-semibold">{template.name}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit('messageTemplates', template)}
              >
                <Settings />
              </Button>
            </div>
            <p className="mt-4 line-clamp-5 whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {renderTemplate(template.content, {
                nome: 'Cliente',
                empresa: 'Empresa',
                valor: 'R$ 0,00',
                vencimento: '00/00/0000',
                dominio: 'exemplo.com.br',
                meu_nome: 'Gabriel',
              })}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(template.content);
                  setToast('Mensagem copiada.');
                }}
              >
                <Copy />
                Copiar
              </Button>
              <Button variant="outline" onClick={() => setPreview(template)}>
                <Search />
                Preview
              </Button>
              {template.channel === 'email' && (
                <Button
                  className="col-span-2"
                  onClick={() => void send(template)}
                >
                  <Mail />
                  Enviar e-mail
                </Button>
              )}
              {template.channel === 'whatsapp' && (
                <Button
                  className="col-span-2"
                  onClick={() => {
                    const phone = window.prompt('WhatsApp com DDD:');
                    if (!phone) return;
                    try {
                      window.open(
                        whatsappUrl(
                          phone,
                          renderTemplate(template.content, {
                            nome: 'Cliente',
                            empresa: 'Empresa',
                            valor: 'R$ 0,00',
                            vencimento: '00/00/0000',
                            dominio: 'exemplo.com.br',
                            meu_nome: 'Gabriel',
                          }),
                        ),
                        '_blank',
                        'noopener,noreferrer',
                      );
                    } catch (error) {
                      setToast(
                        error instanceof Error
                          ? error.message
                          : 'Telefone inválido.',
                      );
                    }
                  }}
                >
                  <MessageCircle />
                  Abrir WhatsApp
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      <Button className="mt-5" onClick={() => openCreate('messageTemplates')}>
        <Plus />
        Novo template
      </Button>
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>
              Prévia com variáveis de exemplo.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/40 p-5 whitespace-pre-line text-sm">
            {preview &&
              renderTemplate(preview.content, {
                nome: 'Cliente',
                empresa: 'Empresa Exemplo',
                valor: 'R$ 150,00',
                vencimento: '10/09/2026',
                dominio: 'exemplo.com.br',
                meu_nome: 'Gabriel',
              })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReportsPage({ data }: { data: AppData }) {
  const wonStages = new Set(
    data.pipelineStages.filter((stage) => stage.isWon).map((stage) => stage.id),
  );
  const lostStages = new Set(
    data.pipelineStages
      .filter((stage) => stage.isLost)
      .map((stage) => stage.id),
  );
  const won = data.opportunities.filter((item) =>
    wonStages.has(item.pipelineStageId),
  );
  const lost = data.opportunities.filter((item) =>
    lostStages.has(item.pipelineStageId),
  );
  const received = data.payments.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const overdue = data.charges
    .filter((item) => item.status === 'overdue')
    .reduce((sum, item) => sum + Number(item.amount), 0);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ReportBlock
        title="Comercial"
        rows={[
          ['Oportunidades', data.opportunities.length],
          ['Ganhas', won.length],
          ['Perdidas', lost.length],
          [
            'Taxa de conversão',
            `${data.opportunities.length ? Math.round((won.length / data.opportunities.length) * 100) : 0}%`,
          ],
          [
            'Valor ganho',
            money(
              won.reduce((sum, item) => sum + Number(item.estimatedValue), 0),
            ),
          ],
        ]}
      />
      <ReportBlock
        title="Financeiro"
        rows={[
          ['Recebido', money(received)],
          [
            'Pendente',
            money(
              data.charges
                .filter((item) => item.status === 'pending')
                .reduce((sum, item) => sum + Number(item.amount), 0),
            ),
          ],
          ['Atrasado', money(overdue)],
          [
            'Assinaturas ativas',
            data.subscriptions.filter((item) => item.status === 'active')
              .length,
          ],
        ]}
      />
      <ReportBlock
        title="Clientes"
        rows={[
          [
            'Ativos',
            data.companies.filter((item) => item.lifecycleStatus === 'client')
              .length,
          ],
          [
            'Prospects',
            data.companies.filter((item) => item.lifecycleStatus === 'prospect')
              .length,
          ],
          [
            'Recorrentes',
            data.companies.filter(
              (item) => item.relationshipStatus === 'active_recurring',
            ).length,
          ],
          [
            'Sem próximo contato',
            data.companies.filter((item) => !item.nextContactAt).length,
          ],
        ]}
      />
      <ReportBlock
        title="Domínios"
        rows={[
          [
            'Ativos',
            data.domains.filter((item) => daysUntil(item.expirationDate) >= 0)
              .length,
          ],
          [
            'Até 30 dias',
            data.domains.filter(
              (item) =>
                daysUntil(item.expirationDate) >= 0 &&
                daysUntil(item.expirationDate) <= 30,
            ).length,
          ],
          [
            'Vencidos',
            data.domains.filter((item) => daysUntil(item.expirationDate) < 0)
              .length,
          ],
          [
            'Sob minha responsabilidade',
            data.domains.filter((item) => item.responsibility === 'me').length,
          ],
        ]}
      />
    </div>
  );
}

function SettingsPage({
  data,
  theme,
  setTheme,
  openCreate,
  openEdit,
  setPasswordOpen,
  setToast,
  mutate,
}: {
  data: AppData;
  theme: string;
  setTheme: (value: 'light' | 'dark' | 'system') => void;
  openCreate: (entity: Entity, preset?: FormValues) => void;
  openEdit: (entity: Entity, row: Row) => void;
  setPasswordOpen: (value: boolean) => void;
  setToast: (value: string) => void;
  mutate: (payload: object, success?: string) => Promise<void>;
}) {
  const [businessName, setBusinessName] = useState(
    data.settings?.businessName || 'Minha Operação',
  );
  const [timezone, setTimezone] = useState(
    data.settings?.timezone || 'America/Sao_Paulo',
  );
  const [currency, setCurrency] = useState(data.settings?.currency || 'BRL');
  const [domainAlertDays, setDomainAlertDays] = useState(
    (data.settings?.domainAlertDays || [60, 30, 15, 7, 3, 0]).join(', '),
  );
  const [defaultPostSaleMonths, setDefaultPostSaleMonths] = useState(
    data.settings?.defaultPostSaleMonths || 6,
  );
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  async function saveSettings() {
    const alertDays = [
      ...new Set(
        domainAlertDays
          .split(',')
          .map((value) => Number(value.trim()))
          .filter(
            (value) => Number.isInteger(value) && value >= 0 && value <= 365,
          ),
      ),
    ].sort((a, b) => b - a);
    if (!alertDays.length)
      return setToast('Informe ao menos um intervalo de alerta válido.');
    await mutate(
      {
        action: 'updateSettings',
        data: {
          businessName,
          timezone,
          currency,
          theme,
          domainAlertDays: alertDays,
          defaultPostSaleMonths: Number(defaultPostSaleMonths),
        },
      },
      'Configurações salvas.',
    );
  }

  async function sendTestEmail() {
    setSendingTestEmail(true);
    try {
      const response = await fetch('/api/email/test', { method: 'POST' });
      const result = (await response.json()) as { error?: string };
      setToast(
        response.ok
          ? 'E-mail de teste enviado para o seu endereço.'
          : result.error || 'Falha ao enviar o e-mail de teste.',
      );
    } catch {
      setToast('Não foi possível conectar ao serviço de e-mail.');
    } finally {
      setSendingTestEmail(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Preferências" subtitle="Aparência e segurança">
        <div className="space-y-4 p-5">
          <label className="block text-xs font-medium">
            Tema
            <NativeSelect
              className="mt-2 w-full"
              value={theme}
              onChange={(event) =>
                setTheme(event.target.value as 'light' | 'dark' | 'system')
              }
            >
              <NativeSelectOption value="light">Claro</NativeSelectOption>
              <NativeSelectOption value="dark">Escuro</NativeSelectOption>
              <NativeSelectOption value="system">Sistema</NativeSelectOption>
            </NativeSelect>
          </label>
          <Button variant="outline" onClick={() => setPasswordOpen(true)}>
            Alterar senha
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const result = await authClient.revokeOtherSessions();
              setToast(
                result.error
                  ? result.error.message || 'Falha ao encerrar sessões.'
                  : 'Outras sessões encerradas.',
              );
            }}
          >
            Encerrar outras sessões
          </Button>
        </div>
      </Panel>
      <Panel
        title="Etapas do pipeline"
        subtitle="Ordenação e estágios terminais"
      >
        <div className="divide-y">
          {data.pipelineStages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-3 p-4">
              <span
                className="size-2 rounded-full"
                style={{ background: stage.color || '#64748b' }}
              />
              <span className="flex-1 text-sm">
                {stage.position + 1}. {stage.name}
              </span>
              {stage.isWon && <Badge>Ganho</Badge>}
              {stage.isLost && <Badge variant="destructive">Perdido</Badge>}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit('pipelineStages', stage)}
              >
                <Settings />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 p-4">
            <Button
              variant="outline"
              onClick={() => openCreate('pipelineStages')}
            >
              <Plus /> Nova etapa
            </Button>
            <Button variant="outline" onClick={() => openCreate('tags')}>
              <Tags /> Nova tag
            </Button>
          </div>
        </div>
      </Panel>
      <Panel title="Portabilidade" subtitle="Seus dados continuam seus">
        <div className="grid gap-2 p-5 sm:grid-cols-2">
          {[
            'companies',
            'contacts',
            'projects',
            'domains',
            'charges',
            'payments',
            'opportunities',
          ].map((entity) => (
            <ExportButton key={entity} entity={entity} />
          ))}
        </div>
      </Panel>
      <Panel
        title="Configuração operacional"
        subtitle="Persistida no PostgreSQL"
      >
        <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
          <label className="text-xs font-medium">
            Nome comercial
            <Input
              className="mt-2"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium">
            Timezone
            <Input
              className="mt-2"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium">
            Moeda
            <Input
              className="mt-2"
              maxLength={3}
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value.toUpperCase())
              }
            />
          </label>
          <label className="text-xs font-medium">
            Pós-venda padrão (meses)
            <Input
              className="mt-2"
              min={1}
              max={120}
              type="number"
              value={defaultPostSaleMonths}
              onChange={(event) =>
                setDefaultPostSaleMonths(Number(event.target.value))
              }
            />
          </label>
          <label className="text-xs font-medium sm:col-span-2">
            Alertas de domínio (dias, separados por vírgula)
            <Input
              className="mt-2"
              value={domainAlertDays}
              onChange={(event) => setDomainAlertDays(event.target.value)}
            />
          </label>
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">
              Segredos do Resend permanecem somente nas variáveis de ambiente.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={sendingTestEmail}
                onClick={() => void sendTestEmail()}
              >
                {sendingTestEmail ? 'Enviando…' : 'Enviar e-mail de teste'}
              </Button>
              <Button onClick={() => void saveSettings()}>
                Salvar configurações
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Company360Dialog({
  company,
  data,
  onClose,
  openCreate,
  openEdit,
  mutate,
}: {
  company: Company | null;
  data: AppData;
  onClose: () => void;
  openCreate: (entity: Entity, preset?: FormValues) => void;
  openEdit: (entity: Entity, row: Row) => void;
  mutate: (payload: object, success?: string) => Promise<void>;
}) {
  if (!company) return null;
  const linked = <T extends { companyId?: string | null }>(rows: T[]) =>
    rows.filter((row) => row.companyId === company.id);
  const companyChargeIds = new Set(linked(data.charges).map((item) => item.id));
  const timeline = [
    ...linked(data.interactions).map((item) => ({
      id: item.id,
      date: item.occurredAt,
      text: item.content,
      type: item.type,
    })),
    ...linked(data.activities).map((item) => ({
      id: item.id,
      date: item.createdAt,
      text: item.description,
      type: item.action,
    })),
    ...linked(data.meetings).map((item) => ({
      id: item.id,
      date: item.meetingAt,
      text: `Reunião: ${item.title}`,
      type: 'meeting',
    })),
    ...linked(data.proposals).map((item) => ({
      id: item.id,
      date: String(item.updatedAt || item.createdAt),
      text: `Proposta ${item.title}: ${label(item.status)}`,
      type: 'proposal',
    })),
    ...linked(data.tasks).map((item) => ({
      id: item.id,
      date: item.dueAt,
      text: `Tarefa ${item.title}: ${label(item.status)}`,
      type: 'task',
    })),
    ...data.payments
      .filter((item) => companyChargeIds.has(item.chargeId))
      .map((item) => ({
        id: item.id,
        date: item.paidAt,
        text: `Pagamento recebido: ${money(Number(item.amount))}`,
        type: 'payment',
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[1050px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <ToneIcon
              tone={
                company.healthStatus === 'critical'
                  ? 'rose'
                  : company.healthStatus === 'attention'
                    ? 'amber'
                    : 'green'
              }
              icon={Users}
            />
            {company.name}
          </DialogTitle>
          <DialogDescription>
            Visão 360º do relacionamento e da operação.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-3">
          <MiniSection
            title="Dados"
            action={
              <Button
                size="xs"
                variant="ghost"
                onClick={() => openEdit('companies', company)}
              >
                Editar
              </Button>
            }
          >
            <InfoRow
              label="Status"
              value={`${label(company.lifecycleStatus)} · ${label(company.relationshipStatus)}`}
            />
            <InfoRow label="Site" value={company.website || '—'} />
            <InfoRow
              label="Próximo contato"
              value={datePt(company.nextContactAt)}
            />
          </MiniSection>
          <MiniSection
            title="Contatos"
            action={
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  openCreate('contacts', { companyId: company.id })
                }
              >
                <Plus />
                Adicionar
              </Button>
            }
          >
            {linked(data.contacts).map((contact) => (
              <div key={contact.id} className="rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between">
                  <p className="text-sm font-medium">{contact.name}</p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit('contacts', contact)}
                    >
                      <Settings />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        window.confirm('Arquivar este contato?') &&
                        void mutate(
                          {
                            action: 'archive',
                            entity: 'contacts',
                            id: contact.id,
                          },
                          'Contato arquivado.',
                        )
                      }
                    >
                      <Archive />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {contact.role || 'Contato'} ·{' '}
                  {contact.email || contact.whatsapp || 'Sem canal'}
                </p>
                <div className="mt-1 flex gap-1">
                  {contact.isPrimary && (
                    <Badge variant="outline">Principal</Badge>
                  )}
                  {contact.isFinancialContact && (
                    <Badge variant="outline">Financeiro</Badge>
                  )}
                </div>
              </div>
            ))}
          </MiniSection>
          <MiniSection title="Próxima ação">
            <InfoRow
              label={
                company.nextAction ? String(company.nextAction) : 'Não definida'
              }
              value={datePt(company.nextActionAt as string)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                openCreate('interactions', {
                  companyId: company.id,
                  type: 'note',
                })
              }
            >
              Registrar interação
            </Button>
          </MiniSection>
          <MiniSection
            title="Tags"
            action={
              <Button
                size="xs"
                variant="ghost"
                onClick={() => openCreate('tags')}
              >
                <Plus /> Criar
              </Button>
            }
          >
            <div className="flex flex-wrap gap-2">
              {data.tags.map((tag) => {
                const active = data.companyTags.some(
                  (item) =>
                    item.companyId === company.id && item.tagId === tag.id,
                );
                return (
                  <button
                    key={tag.id}
                    className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                    onClick={() =>
                      void mutate(
                        {
                          action: active ? 'removeCompanyTag' : 'addCompanyTag',
                          companyId: company.id,
                          tagId: tag.id,
                        },
                        active ? 'Tag removida.' : 'Tag adicionada.',
                      )
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </MiniSection>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <LinkedSection
            title="Projetos"
            rows={linked(data.projects)}
            render={(row) => `${row.name} · ${label(row.status)}`}
            onAdd={() => openCreate('projects', { companyId: company.id })}
          />
          <LinkedSection
            title="Oportunidades"
            rows={linked(data.opportunities)}
            render={(row) =>
              `${row.title} · ${money(Number(row.estimatedValue))}`
            }
            onAdd={() => openCreate('opportunities', { companyId: company.id })}
          />
          <LinkedSection
            title="Financeiro"
            rows={linked(data.charges)}
            render={(row) =>
              `${row.description} · ${money(Number(row.amount))} · ${label(row.status)}`
            }
            onAdd={() => openCreate('charges', { companyId: company.id })}
          />
          <LinkedSection
            title="Domínios"
            rows={linked(data.domains)}
            render={(row) => `${row.domain} · ${datePt(row.expirationDate)}`}
            onAdd={() => openCreate('domains', { companyId: company.id })}
          />
          <LinkedSection
            title="Propostas"
            rows={linked(data.proposals)}
            render={(row) => `${row.title} · ${label(row.status)}`}
            onAdd={() => openCreate('proposals', { companyId: company.id })}
          />
          <LinkedSection
            title="Reuniões"
            rows={linked(data.meetings)}
            render={(row) => `${row.title} · ${dateTimePt(row.meetingAt)}`}
            onAdd={() => openCreate('meetings', { companyId: company.id })}
          />
          <LinkedSection
            title="Tarefas"
            rows={linked(data.tasks)}
            render={(row) => `${row.title} · ${dateTimePt(row.dueAt)}`}
            onAdd={() => openCreate('tasks', { companyId: company.id })}
          />
          <LinkedSection
            title="Hospedagem"
            rows={linked(data.hostingServices)}
            render={(row) =>
              `${row.provider || row.name} · ${label(String(row.status || 'active'))}`
            }
            onAdd={() =>
              openCreate('hostingServices', { companyId: company.id })
            }
            onEdit={(row) => openEdit('hostingServices', row as Row)}
          />
          <LinkedSection
            title="Serviços de e-mail"
            rows={linked(data.emailServices)}
            render={(row) =>
              `${row.provider || 'Serviço de e-mail'} · ${label(String(row.status || 'active'))}`
            }
            onAdd={() => openCreate('emailServices', { companyId: company.id })}
            onEdit={(row) => openEdit('emailServices', row as Row)}
          />
        </div>
        <MiniSection title="Timeline">
          <div className="max-h-72 divide-y overflow-y-auto">
            {timeline.map((item) => (
              <div key={`${item.type}-${item.id}`} className="py-3">
                <p className="text-sm">{item.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {label(item.type)} · {dateTimePt(item.date)}
                </p>
              </div>
            ))}
            {!timeline.length && (
              <p className="text-sm text-muted-foreground">
                Nenhuma interação ou atividade.
              </p>
            )}
          </div>
        </MiniSection>
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() =>
              window.confirm('Arquivar esta empresa?') &&
              void mutate(
                { action: 'archive', entity: 'companies', id: company.id },
                'Empresa arquivada.',
              )
            }
          >
            Arquivar empresa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecordDialog({
  form,
  data,
  busy,
  onClose,
  onChange,
  onSave,
}: {
  form: FormState | null;
  data: AppData;
  busy: boolean;
  onClose: () => void;
  onChange: (values: FormValues) => void;
  onSave: () => void;
}) {
  if (!form) return null;
  const spec = fields(form.entity);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>
            {form.id ? 'Editar' : 'Novo'} {entityLabel(form.entity)}
          </DialogTitle>
          <DialogDescription>
            Os dados são validados no servidor antes de serem salvos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {spec.map((field) => (
            <label
              key={field.key}
              className={`text-xs font-medium ${field.wide ? 'sm:col-span-2' : ''}`}
            >
              {field.label}
              {field.type === 'textarea' ? (
                <Textarea
                  className="mt-2"
                  required={field.required}
                  value={String(form.values[field.key] ?? '')}
                  onChange={(event) =>
                    onChange({
                      ...form.values,
                      [field.key]: event.target.value,
                    })
                  }
                />
              ) : field.type === 'select' ? (
                <NativeSelect
                  className="mt-2 w-full"
                  required={field.required}
                  value={String(form.values[field.key] ?? '')}
                  onChange={(event) =>
                    onChange({
                      ...form.values,
                      [field.key]: event.target.value,
                    })
                  }
                >
                  <NativeSelectOption value="">Selecione</NativeSelectOption>
                  {optionsFor(field, data).map(([value, text]) => (
                    <NativeSelectOption key={value} value={value}>
                      {text}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : field.type === 'checkbox' ? (
                <span className="mt-2 flex h-9 items-center gap-2 rounded-lg border px-3">
                  <input
                    type="checkbox"
                    checked={Boolean(form.values[field.key])}
                    onChange={(event) =>
                      onChange({
                        ...form.values,
                        [field.key]: event.target.checked,
                      })
                    }
                  />
                  <span className="font-normal text-muted-foreground">Sim</span>
                </span>
              ) : (
                <Input
                  className="mt-2 h-9"
                  required={field.required}
                  type={field.type || 'text'}
                  step={field.type === 'number' ? '0.01' : undefined}
                  value={String(form.values[field.key] ?? '')}
                  onChange={(event) =>
                    onChange({
                      ...form.values,
                      [field.key]:
                        field.type === 'number'
                          ? event.target.value
                          : event.target.value,
                    })
                  }
                />
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={onSave}>
            {busy ? <LoaderCircle className="animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotificationsDialog({
  open,
  data,
  onClose,
  mutate,
}: {
  open: boolean;
  data: AppData;
  onClose: () => void;
  mutate: (payload: object, success?: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notificações</DialogTitle>
          <DialogDescription>
            Alertas gerados pelas automações.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] divide-y overflow-y-auto">
          {data.notifications.map((notification) => (
            <button
              key={notification.id}
              className={`w-full p-4 text-left ${notification.readAt ? 'opacity-55' : 'hover:bg-muted/50'}`}
              onClick={() =>
                void mutate(
                  { action: 'markNotificationRead', id: notification.id },
                  'Marcada como lida.',
                )
              }
            >
              <p className="text-sm font-medium">{notification.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {notification.message}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {dateTimePt(notification.createdAt)}
              </p>
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() =>
            void mutate(
              { action: 'markNotificationRead', all: true },
              'Todas marcadas como lidas.',
            )
          }
        >
          Marcar todas como lidas
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  open,
  onClose,
  setToast,
}: {
  open: boolean;
  onClose: () => void;
  setToast: (message: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  async function save() {
    if (newPassword !== confirm)
      return setToast('As novas senhas não coincidem.');
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (result.error)
      return setToast(result.error.message || 'Não foi possível alterar.');
    setToast('Senha alterada e outras sessões revogadas.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirm('');
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>
            A nova senha deve ter pelo menos 12 caracteres. Outras sessões serão
            encerradas.
          </DialogDescription>
        </DialogHeader>
        <label className="text-xs font-medium">
          Senha atual
          <Input
            className="mt-2"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          Nova senha
          <Input
            className="mt-2"
            type="password"
            minLength={12}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          Confirmar
          <Input
            className="mt-2"
            type="password"
            minLength={12}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>
        <Button onClick={() => void save()}>Salvar nova senha</Button>
      </DialogContent>
    </Dialog>
  );
}

type CrudPageProps = {
  data: AppData;
  openCreate: (entity: Entity, preset?: FormValues) => void;
  openEdit: (entity: Entity, row: Row) => void;
  mutate: (payload: object, success?: string) => Promise<void>;
};
function PageHeading({ page }: { page: PageKey }) {
  const [title, subtitle] = titles[page];
  return (
    <div className="mb-8">
      <p className="mb-1 text-xs font-medium capitalize text-primary">
        {new Intl.DateTimeFormat('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date())}
      </p>
      <h1 className="text-2xl font-semibold tracking-[-.035em] sm:text-[30px]">
        {title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
function BrandMark() {
  return (
    <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(41,74,66,.18)]">
      <Command className="size-4.5" />
    </div>
  );
}
function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="text-center">
        <BrandMark />
        <LoaderCircle className="mx-auto mt-4 size-5 animate-spin text-primary" />
        <p className="mt-2 text-xs text-muted-foreground">
          Organizando sua operação...
        </p>
      </div>
    </div>
  );
}
function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(15,23,42,.03)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function MiniSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
function LinkedSection<T extends { id: string }>({
  title,
  rows,
  render,
  onAdd,
  onEdit,
}: {
  title: string;
  rows: T[];
  render: (row: T) => string;
  onAdd: () => void;
  onEdit?: (row: T) => void;
}) {
  return (
    <MiniSection
      title={title}
      action={
        <Button size="xs" variant="ghost" onClick={onAdd}>
          <Plus />
          Adicionar
        </Button>
      }
    >
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-xs"
        >
          <p className="min-w-0 flex-1 truncate">{render(row)}</p>
          {onEdit && (
            <Button variant="ghost" size="icon-xs" onClick={() => onEdit(row)}>
              <Settings />
            </Button>
          )}
        </div>
      ))}
      {!rows.length && (
        <p className="text-xs text-muted-foreground">Nenhum registro.</p>
      )}
    </MiniSection>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold tracking-[-.04em]">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
function ToneIcon({ tone, icon: Icon }: { tone: string; icon: typeof Users }) {
  return (
    <div
      className={`grid size-10 shrink-0 place-items-center rounded-xl attention-${tone}`}
    >
      <Icon className="size-4.5" />
    </div>
  );
}
function RecordCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  lines,
  value,
  danger,
  onEdit,
  onArchive,
}: {
  icon: typeof Users;
  title: string;
  subtitle: string;
  badge: string;
  lines: string[];
  value?: string;
  danger?: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <article
      className={`rounded-2xl border bg-card p-5 ${danger ? 'border-amber-400 dark:border-amber-800' : ''}`}
    >
      <div className="flex items-start gap-3">
        <ToneIcon tone={danger ? 'amber' : 'green'} icon={Icon} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{title}</h3>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Badge variant={danger ? 'destructive' : 'secondary'}>{badge}</Badge>
      </div>
      <div className="mt-5 space-y-2">
        {lines.map((line) => (
          <p
            key={line}
            className={`truncate text-xs ${danger && line.includes('RESPONSABILIDADE') ? 'font-bold text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}
          >
            {line}
          </p>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t pt-4">
        <p className="text-sm font-semibold">{value}</p>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <Settings />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onArchive}>
            <Archive />
          </Button>
        </div>
      </div>
    </article>
  );
}
function FilterBar({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b p-3">
      {options.map(([key, text]) => (
        <Button
          key={key}
          size="sm"
          variant={value === key ? 'default' : 'ghost'}
          onClick={() => onChange(key)}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        ['paid', 'accepted', 'active', 'won'].includes(status)
          ? 'default'
          : ['overdue', 'rejected', 'cancelled', 'lost'].includes(status)
            ? 'destructive'
            : 'secondary'
      }
    >
      {label(status)}
    </Badge>
  );
}
function EmptyCards({ text, onAdd }: { text: string; onAdd: () => void }) {
  return (
    <div className="col-span-full rounded-xl border border-dashed p-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button className="mt-3" variant="outline" onClick={onAdd}>
        <Plus />
        Adicionar primeiro
      </Button>
    </div>
  );
}
function ExportButton({ entity }: { entity: string }) {
  return (
    <a
      className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
      href={`/api/export?entity=${entity}`}
    >
      <Download className="size-3.5" />
      {label(entity)}
    </a>
  );
}
function InfoRow({ label: rowLabel, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{rowLabel}</span>
      <span className="max-w-[65%] text-right font-medium">{value}</span>
    </div>
  );
}
function ReportBlock({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string | number]>;
}) {
  return (
    <Panel title={title} subtitle="Dados persistidos">
      <div className="divide-y">
        {rows.map(([name, value]) => (
          <div key={name} className="flex items-center justify-between p-4">
            <span className="text-sm text-muted-foreground">{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}

type AttentionItem = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  priority: string;
  type: string;
  taskId?: string;
};
function attentionItems(data: AppData): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const task of data.tasks.filter(
    (item) => !['completed', 'cancelled'].includes(item.status),
  ))
    items.push({
      id: `task-${task.id}`,
      taskId: task.id,
      title: task.title,
      subtitle: task.companyId
        ? companyName(data, task.companyId)
        : task.description || label(task.type),
      date: task.dueAt,
      priority: task.priority,
      type: task.type,
    });
  for (const charge of data.charges.filter((item) => item.status === 'overdue'))
    items.push({
      id: `charge-${charge.id}`,
      title: `Cobrança atrasada: ${charge.description}`,
      subtitle: companyName(data, charge.companyId),
      date: charge.dueDate,
      priority: 'urgent',
      type: 'charge',
    });
  for (const domain of data.domains.filter(
    (item) => daysUntil(item.expirationDate) <= 60,
  ))
    items.push({
      id: `domain-${domain.id}`,
      title: `Domínio: ${domain.domain}`,
      subtitle: domain.registeredUnderMyAccount
        ? 'SOB MINHA RESPONSABILIDADE'
        : companyName(data, domain.companyId),
      date: domain.expirationDate,
      priority: daysUntil(domain.expirationDate) <= 7 ? 'urgent' : 'high',
      type: 'domain',
    });
  for (const meeting of data.meetings.filter(
    (item) => new Date(item.meetingAt).getTime() <= Date.now() + 7 * 86400000,
  ))
    items.push({
      id: `meeting-${meeting.id}`,
      title: `Reunião: ${meeting.title}`,
      subtitle: companyName(data, meeting.companyId),
      date: meeting.meetingAt,
      priority: 'high',
      type: 'meeting',
    });
  return items.sort(
    (a, b) =>
      priorityValue(b.priority) - priorityValue(a.priority) ||
      new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}
function AttentionList({
  items,
  onComplete,
}: {
  items: AttentionItem[];
  onComplete?: (id: string) => void;
}) {
  return (
    <div className="divide-y">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3.5 px-5 py-4 sm:px-6"
        >
          <ToneIcon
            tone={
              item.priority === 'urgent'
                ? 'rose'
                : item.type === 'domain'
                  ? 'amber'
                  : 'violet'
            }
            icon={
              item.type === 'domain'
                ? Globe2
                : item.type === 'charge'
                  ? CreditCard
                  : item.type === 'meeting'
                    ? CalendarDays
                    : Clock3
            }
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">
              {item.subtitle} · {datePt(item.date)}
            </p>
          </div>
          <Badge
            variant={item.priority === 'urgent' ? 'destructive' : 'secondary'}
          >
            {label(item.priority)}
          </Badge>
          {item.taskId && onComplete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onComplete(item.taskId!)}
            >
              <Check />
            </Button>
          )}
        </div>
      ))}
      {!items.length && (
        <div className="p-10 text-center">
          <CheckCircle2 className="mx-auto size-6 text-primary" />
          <p className="mt-3 text-sm font-medium">Tudo em dia</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Novos alertas aparecerão após o cron diário.
          </p>
        </div>
      )}
    </div>
  );
}

function fields(entity: Entity): Field[] {
  const company: Field = {
    key: 'companyId',
    label: 'Empresa',
    type: 'select',
    source: 'companies',
    required: true,
  };
  const project: Field = {
    key: 'projectId',
    label: 'Projeto',
    type: 'select',
    source: 'projects',
  };
  const opportunity: Field = {
    key: 'opportunityId',
    label: 'Oportunidade',
    type: 'select',
    source: 'opportunities',
  };
  const map: Record<Entity, Field[]> = {
    companies: [
      { key: 'name', label: 'Nome da empresa', required: true },
      { key: 'legalName', label: 'Razão social' },
      { key: 'document', label: 'CPF/CNPJ' },
      {
        key: 'lifecycleStatus',
        label: 'Lifecycle',
        type: 'select',
        options: [
          ['prospect', 'Prospect'],
          ['client', 'Cliente'],
          ['former_client', 'Ex-cliente'],
        ],
      },
      {
        key: 'relationshipStatus',
        label: 'Relacionamento',
        type: 'select',
        options: [
          ['active_recurring', 'Ativo recorrente'],
          ['active_non_recurring', 'Ativo sem recorrência'],
          ['inactive', 'Inativo'],
        ],
      },
      {
        key: 'healthStatus',
        label: 'Saúde',
        type: 'select',
        options: [
          ['good', 'Boa'],
          ['attention', 'Atenção'],
          ['critical', 'Crítica'],
        ],
      },
      { key: 'website', label: 'Site', type: 'url' },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'phone', label: 'Telefone' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'city', label: 'Cidade' },
      { key: 'state', label: 'UF' },
      { key: 'industry', label: 'Segmento' },
      { key: 'leadSource', label: 'Origem' },
      { key: 'nextAction', label: 'Próxima ação', wide: true },
      { key: 'nextActionAt', label: 'Quando', type: 'datetime-local' },
      {
        key: 'contactFrequencyMonths',
        label: 'Contato a cada (meses)',
        type: 'number',
      },
      {
        key: 'notesSummary',
        label: 'Resumo/observações',
        type: 'textarea',
        wide: true,
      },
    ],
    contacts: [
      company,
      { key: 'name', label: 'Nome', required: true },
      { key: 'role', label: 'Cargo/função' },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'phone', label: 'Telefone' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'isPrimary', label: 'Contato principal', type: 'checkbox' },
      {
        key: 'isFinancialContact',
        label: 'Responsável financeiro',
        type: 'checkbox',
      },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ],
    pipelineStages: [
      { key: 'name', label: 'Nome da etapa', required: true },
      { key: 'slug', label: 'Identificador (slug)', required: true },
      { key: 'position', label: 'Posição', type: 'number', required: true },
      { key: 'color', label: 'Cor hexadecimal' },
      { key: 'isWon', label: 'Etapa de ganho', type: 'checkbox' },
      { key: 'isLost', label: 'Etapa de perda', type: 'checkbox' },
      { key: 'isActive', label: 'Ativa', type: 'checkbox' },
    ],
    opportunities: [
      company,
      {
        key: 'pipelineStageId',
        label: 'Etapa',
        type: 'select',
        source: 'stages',
        required: true,
      },
      { key: 'title', label: 'Oportunidade', required: true },
      { key: 'estimatedValue', label: 'Valor estimado', type: 'number' },
      { key: 'probability', label: 'Probabilidade (%)', type: 'number' },
      { key: 'leadSource', label: 'Origem' },
      {
        key: 'expectedCloseDate',
        label: 'Previsão de fechamento',
        type: 'date',
      },
      { key: 'nextAction', label: 'Próxima ação', wide: true },
      { key: 'nextActionAt', label: 'Quando', type: 'datetime-local' },
      {
        key: 'lostReason',
        label: 'Motivo de perda',
        type: 'textarea',
        wide: true,
      },
    ],
    projects: [
      company,
      { key: 'name', label: 'Projeto', required: true },
      {
        key: 'type',
        label: 'Tipo',
        type: 'select',
        options: [
          ['landing_page', 'Landing page'],
          ['institutional', 'Institucional'],
          ['ecommerce', 'E-commerce'],
          ['web_system', 'Sistema web'],
          ['maintenance', 'Manutenção'],
          ['other', 'Outro'],
        ],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          ['proposal', 'Proposta'],
          ['development', 'Desenvolvimento'],
          ['review', 'Revisão'],
          ['delivered', 'Entregue'],
          ['maintenance', 'Manutenção'],
          ['archived', 'Arquivado'],
        ],
      },
      { key: 'productionUrl', label: 'URL produção', type: 'url' },
      { key: 'stagingUrl', label: 'URL staging', type: 'url' },
      { key: 'repositoryUrl', label: 'Repositório', type: 'url' },
      { key: 'startDate', label: 'Início', type: 'date' },
      { key: 'deliveryDate', label: 'Entrega', type: 'date' },
      { key: 'soldValue', label: 'Valor vendido', type: 'number' },
      { key: 'costValue', label: 'Custo', type: 'number' },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ],
    domains: [
      company,
      project,
      { key: 'domain', label: 'Domínio', required: true },
      { key: 'registrar', label: 'Registrador' },
      { key: 'registrationDate', label: 'Registro', type: 'date' },
      {
        key: 'expirationDate',
        label: 'Vencimento',
        type: 'date',
        required: true,
      },
      {
        key: 'responsibility',
        label: 'Responsabilidade',
        type: 'select',
        options: [
          ['me', 'Eu'],
          ['client', 'Cliente'],
          ['third_party', 'Terceiro'],
        ],
      },
      {
        key: 'registeredUnderMyAccount',
        label: 'Registrado em minha conta',
        type: 'checkbox',
      },
      {
        key: 'registeredUnderClientDocument',
        label: 'Documento do cliente',
        type: 'checkbox',
      },
      { key: 'autoRenew', label: 'Renovação automática', type: 'checkbox' },
      { key: 'renewalCost', label: 'Custo', type: 'number' },
      { key: 'clientRenewalPrice', label: 'Preço ao cliente', type: 'number' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          ['active', 'Ativo'],
          ['expiring', 'Vencendo'],
          ['expired', 'Vencido'],
          ['transferred', 'Transferido'],
        ],
      },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ],
    hostingServices: [
      company,
      project,
      { key: 'provider', label: 'Provedor', required: true },
      { key: 'plan', label: 'Plano' },
      { key: 'isFree', label: 'Gratuito', type: 'checkbox' },
      {
        key: 'billingFrequency',
        label: 'Frequência',
        type: 'select',
        options: frequencyOptions,
      },
      { key: 'cost', label: 'Custo', type: 'number' },
      {
        key: 'paidBy',
        label: 'Pago por',
        type: 'select',
        options: [
          ['me', 'Eu'],
          ['client', 'Cliente'],
          ['third_party', 'Terceiro'],
        ],
      },
      { key: 'renewalDate', label: 'Renovação', type: 'date' },
      { key: 'dashboardUrl', label: 'Painel', type: 'url' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: serviceStatusOptions,
      },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ],
    emailServices: [
      company,
      project,
      { key: 'provider', label: 'Provedor', required: true },
      { key: 'accountEmail', label: 'E-mail da conta', type: 'email' },
      { key: 'verifiedDomain', label: 'Domínio verificado' },
      { key: 'senderDomain', label: 'Domínio remetente' },
      { key: 'senderAddress', label: 'Endereço remetente', type: 'email' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: serviceStatusOptions,
      },
      { key: 'dashboardUrl', label: 'Painel', type: 'url' },
      {
        key: 'credentialReference',
        label: 'Referência da credencial',
        wide: true,
      },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ],
    services: [
      { key: 'name', label: 'Serviço', required: true },
      { key: 'description', label: 'Descrição', type: 'textarea', wide: true },
      { key: 'defaultAmount', label: 'Valor padrão', type: 'number' },
      { key: 'active', label: 'Ativo', type: 'checkbox' },
    ],
    subscriptions: [
      company,
      project,
      {
        key: 'serviceId',
        label: 'Serviço',
        type: 'select',
        source: 'services',
      },
      { key: 'description', label: 'Descrição', required: true },
      { key: 'amount', label: 'Valor', type: 'number', required: true },
      {
        key: 'frequency',
        label: 'Frequência',
        type: 'select',
        options: frequencyOptions,
      },
      {
        key: 'customIntervalMonths',
        label: 'Intervalo customizado (meses)',
        type: 'number',
      },
      {
        key: 'billingDay',
        label: 'Dia de cobrança',
        type: 'number',
        required: true,
      },
      { key: 'startDate', label: 'Início', type: 'date', required: true },
      { key: 'endDate', label: 'Fim', type: 'date' },
      {
        key: 'nextChargeDate',
        label: 'Próxima cobrança',
        type: 'date',
        required: true,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          ['active', 'Ativa'],
          ['paused', 'Pausada'],
          ['cancelled', 'Cancelada'],
          ['finished', 'Finalizada'],
        ],
      },
    ],
    charges: [
      company,
      project,
      {
        key: 'subscriptionId',
        label: 'Assinatura',
        type: 'select',
        options: [],
      },
      { key: 'description', label: 'Descrição', required: true },
      { key: 'category', label: 'Categoria' },
      { key: 'amount', label: 'Valor', type: 'number', required: true },
      { key: 'dueDate', label: 'Vencimento', type: 'date', required: true },
      { key: 'billingPeriod', label: 'Período (AAAA-MM)' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          ['scheduled', 'Agendada'],
          ['pending', 'Pendente'],
          ['paid', 'Paga'],
          ['overdue', 'Atrasada'],
          ['cancelled', 'Cancelada'],
        ],
      },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ],
    proposals: [
      company,
      opportunity,
      { key: 'title', label: 'Proposta', required: true },
      { key: 'description', label: 'Descrição', type: 'textarea', wide: true },
      { key: 'subtotal', label: 'Subtotal', type: 'number' },
      { key: 'discount', label: 'Desconto', type: 'number' },
      {
        key: 'finalAmount',
        label: 'Valor final',
        type: 'number',
        required: true,
      },
      { key: 'paymentTerms', label: 'Condições', type: 'textarea', wide: true },
      { key: 'validUntil', label: 'Validade', type: 'date' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          ['draft', 'Rascunho'],
          ['sent', 'Enviada'],
          ['negotiation', 'Negociação'],
          ['accepted', 'Aceita'],
          ['rejected', 'Rejeitada'],
          ['expired', 'Expirada'],
        ],
      },
      { key: 'notes', label: 'Observações', type: 'textarea', wide: true },
    ],
    meetings: [
      company,
      opportunity,
      { key: 'title', label: 'Reunião', required: true },
      {
        key: 'meetingAt',
        label: 'Data e hora',
        type: 'datetime-local',
        required: true,
      },
      {
        key: 'type',
        label: 'Tipo',
        type: 'select',
        options: [
          ['google_meet', 'Google Meet'],
          ['teams', 'Teams'],
          ['phone', 'Telefone'],
          ['in_person', 'Presencial'],
          ['other', 'Outro'],
        ],
      },
      { key: 'meetingUrl', label: 'Link', type: 'url' },
      { key: 'location', label: 'Local' },
      { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
      { key: 'result', label: 'Resultado', type: 'textarea', wide: true },
      { key: 'nextAction', label: 'Próxima ação' },
      { key: 'nextActionAt', label: 'Quando', type: 'datetime-local' },
    ],
    tasks: [
      { ...company, required: false },
      { key: 'title', label: 'Tarefa', required: true },
      {
        key: 'type',
        label: 'Tipo',
        type: 'select',
        options: [
          ['general', 'Geral'],
          ['charge', 'Cobrança'],
          ['follow_up', 'Follow-up'],
          ['domain', 'Domínio'],
          ['post_sale', 'Pós-venda'],
          ['meeting', 'Reunião'],
        ],
      },
      {
        key: 'dueAt',
        label: 'Data e hora',
        type: 'datetime-local',
        required: true,
      },
      {
        key: 'priority',
        label: 'Prioridade',
        type: 'select',
        options: [
          ['low', 'Baixa'],
          ['normal', 'Normal'],
          ['high', 'Alta'],
          ['urgent', 'Urgente'],
        ],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          ['open', 'Aberta'],
          ['completed', 'Concluída'],
          ['snoozed', 'Adiada'],
          ['cancelled', 'Cancelada'],
        ],
      },
      { key: 'description', label: 'Descrição', type: 'textarea', wide: true },
    ],
    interactions: [
      company,
      opportunity,
      {
        key: 'type',
        label: 'Tipo',
        type: 'select',
        options: [
          ['whatsapp', 'WhatsApp'],
          ['email', 'E-mail'],
          ['call', 'Ligação'],
          ['meeting', 'Reunião'],
          ['note', 'Nota'],
          ['system', 'Sistema'],
          ['other', 'Outro'],
        ],
      },
      { key: 'subject', label: 'Assunto' },
      {
        key: 'content',
        label: 'Conteúdo',
        type: 'textarea',
        wide: true,
        required: true,
      },
      { key: 'occurredAt', label: 'Quando', type: 'datetime-local' },
      { key: 'nextAction', label: 'Próxima ação' },
      { key: 'nextActionAt', label: 'Quando', type: 'datetime-local' },
    ],
    messageTemplates: [
      { key: 'name', label: 'Nome', required: true },
      { key: 'category', label: 'Categoria', required: true },
      {
        key: 'channel',
        label: 'Canal',
        type: 'select',
        options: [
          ['whatsapp', 'WhatsApp'],
          ['email', 'E-mail'],
        ],
      },
      { key: 'subject', label: 'Assunto' },
      {
        key: 'content',
        label: 'Conteúdo',
        type: 'textarea',
        wide: true,
        required: true,
      },
    ],
    tags: [
      { key: 'name', label: 'Tag', required: true },
      { key: 'color', label: 'Cor hexadecimal' },
    ],
  };
  return map[entity];
}
const frequencyOptions: Array<[string, string]> = [
  ['monthly', 'Mensal'],
  ['quarterly', 'Trimestral'],
  ['semiannual', 'Semestral'],
  ['annual', 'Anual'],
  ['custom', 'Personalizada'],
];
const serviceStatusOptions: Array<[string, string]> = [
  ['active', 'Ativo'],
  ['inactive', 'Inativo'],
  ['cancelled', 'Cancelado'],
];
function optionsFor(field: Field, data: AppData): Array<[string, string]> {
  if (field.options?.length) return field.options;
  if (field.key === 'subscriptionId')
    return data.subscriptions.map((item) => [item.id, item.description]);
  if (field.source === 'companies')
    return data.companies.map((item) => [item.id, item.name]);
  if (field.source === 'stages')
    return data.pipelineStages.map((item) => [item.id, item.name]);
  if (field.source === 'projects')
    return data.projects.map((item) => [item.id, item.name]);
  if (field.source === 'services')
    return data.services.map((item) => [item.id, String(item.name)]);
  if (field.source === 'opportunities')
    return data.opportunities.map((item) => [item.id, item.title]);
  return [];
}
function defaults(entity: Entity, data: AppData | null): FormValues {
  const today = new Date().toISOString().slice(0, 10);
  const firstCompany = data?.companies[0]?.id || '';
  const firstStage = data?.pipelineStages[0]?.id || '';
  const map: Record<Entity, FormValues> = {
    companies: {
      lifecycleStatus: 'prospect',
      relationshipStatus: 'inactive',
      healthStatus: 'good',
    },
    contacts: {
      companyId: firstCompany,
      isPrimary: false,
      isFinancialContact: false,
    },
    pipelineStages: {
      position: data?.pipelineStages.length || 0,
      color: '#64748b',
      isWon: false,
      isLost: false,
      isActive: true,
    },
    opportunities: {
      companyId: firstCompany,
      pipelineStageId: firstStage,
      estimatedValue: '0.00',
      probability: 20,
    },
    projects: {
      companyId: firstCompany,
      type: 'other',
      status: 'proposal',
      soldValue: '0.00',
      costValue: '0.00',
    },
    domains: {
      companyId: firstCompany,
      expirationDate: today,
      responsibility: 'client',
      registeredUnderMyAccount: false,
      registeredUnderClientDocument: false,
      autoRenew: false,
      renewalCost: '0.00',
      clientRenewalPrice: '0.00',
      status: 'active',
    },
    hostingServices: {
      companyId: firstCompany,
      isFree: false,
      billingFrequency: 'monthly',
      cost: '0.00',
      paidBy: 'me',
      status: 'active',
    },
    emailServices: { companyId: firstCompany, status: 'active' },
    services: { defaultAmount: '0.00', active: true },
    subscriptions: {
      companyId: firstCompany,
      amount: '0.00',
      frequency: 'monthly',
      billingDay: 10,
      startDate: today,
      nextChargeDate: today,
      status: 'active',
    },
    charges: {
      companyId: firstCompany,
      amount: '0.00',
      dueDate: today,
      status: 'pending',
      category: 'service',
    },
    proposals: {
      companyId: firstCompany,
      subtotal: '0.00',
      discount: '0.00',
      finalAmount: '0.00',
      status: 'draft',
    },
    meetings: {
      companyId: firstCompany,
      meetingAt: `${today}T10:00`,
      type: 'other',
    },
    tasks: {
      companyId: firstCompany,
      dueAt: `${today}T12:00`,
      type: 'general',
      priority: 'normal',
      status: 'open',
      source: 'manual',
    },
    interactions: {
      companyId: firstCompany,
      type: 'note',
      occurredAt: `${today}T12:00`,
    },
    messageTemplates: { channel: 'whatsapp' },
    tags: { color: '#64748b' },
  };
  return map[entity];
}
function defaultEntity(page: PageKey): Entity {
  return (
    {
      dashboard: 'companies',
      attention: 'tasks',
      companies: 'companies',
      projects: 'projects',
      pipeline: 'opportunities',
      finance: 'charges',
      domains: 'domains',
      agenda: 'tasks',
      commercial: 'proposals',
      messages: 'messageTemplates',
      reports: 'companies',
      settings: 'tags',
    } as Record<PageKey, Entity>
  )[page];
}
function entityLabel(entity: Entity) {
  return (
    {
      companies: 'cliente ou prospect',
      contacts: 'contato',
      pipelineStages: 'etapa do pipeline',
      opportunities: 'oportunidade',
      projects: 'projeto',
      domains: 'domínio',
      hostingServices: 'hospedagem',
      emailServices: 'serviço de e-mail',
      services: 'serviço',
      subscriptions: 'assinatura',
      charges: 'cobrança',
      proposals: 'proposta',
      meetings: 'reunião',
      tasks: 'tarefa',
      interactions: 'interação ou nota',
      messageTemplates: 'template',
      tags: 'tag',
    } as Record<Entity, string>
  )[entity];
}
function toInputValue(value: Primitive) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))
    return value.slice(0, 16);
  return value;
}
function companyName(data: AppData, id: string) {
  return (
    data.companies.find((item) => item.id === id)?.name ||
    'Empresa não encontrada'
  );
}
function money(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}
function datePt(value?: string | null) {
  if (!value) return 'Sem data';
  const date = new Date(
    value.length === 10 ? `${value}T12:00:00-03:00` : value,
  );
  return Number.isNaN(date.getTime())
    ? 'Sem data'
    : new Intl.DateTimeFormat('pt-BR').format(date);
}
function dateTimePt(value?: string | null) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sem data'
    : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
}
function daysUntil(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T12:00:00`);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}
function label(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function priorityValue(value: string) {
  return { urgent: 4, high: 3, normal: 2, low: 1 }[value] || 0;
}
function taskGroup(task: Task) {
  if (task.status === 'completed') return 'completed';
  const date = new Date(task.dueAt);
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const end = new Date(start.getTime() + 86400000);
  if (date < start) return 'overdue';
  if (date < end) return 'today';
  return 'upcoming';
}
