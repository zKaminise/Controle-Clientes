# Final handoff — Controle de Clientes

Data de consolidação: 30/08/2026.

## Estado

O código está tecnicamente preparado para produção, mas depende da criação/configuração externa do Neon, Vercel e, opcionalmente, Resend. Não houve alteração de DNS. A aplicação legada permanece disponível somente para rollback temporário.

## Arquitetura e stack

```text
GitHub → Vercel → Next.js 16 App Router → Neon PostgreSQL
                     ├─ Better Auth 1.7
                     ├─ Drizzle ORM
                     ├─ Resend
                     ├─ Vercel Cron
                     └─ WhatsApp wa.me
```

Frontend: React 19, TypeScript, Tailwind CSS 4 e componentes Base UI/shadcn. Backend: Route Handlers e services server-side. Validação: Zod. Testes: Vitest. O runtime não possui Vinext, Vite como runtime, D1, Cloudflare Worker, Wrangler, Miniflare ou binding do ChatGPT Sites.

## Schema e migration

O PostgreSQL final possui 31 tabelas: `users`, `sessions`, `accounts`, `verifications`, `rate_limits`, `companies`, `contacts`, `pipeline_stages`, `opportunities`, `projects`, `technologies`, `project_technologies`, `domains`, `hosting_services`, `email_services`, `services`, `subscriptions`, `charges`, `payments`, `proposals`, `meetings`, `tasks`, `interactions`, `message_templates`, `message_logs`, `notifications`, `tags`, `company_tags`, `activities`, `settings` e `automation_runs`.

A migration `drizzle/0000_medical_sway.sql` cria UUIDs, enums, FKs, índices, unique/check constraints, JSONB, datas civis, timestamps com timezone e `numeric(12,2)`. Ela foi gerada e validada localmente, mas ainda não foi aplicada em Neon por ausência de `DATABASE_URL`.

## Autenticação

- Better Auth com e-mail/senha e sessão persistida no PostgreSQL.
- Cadastro público desativado; administrador criado por `npm run create-admin`.
- Senha entre 12 e 128 caracteres, sem senha padrão no código.
- Cookies seguros em produção, trusted origin e secrets obrigatórios no runtime.
- Recuperação por token de uma hora, e-mail Resend e revogação de sessões após reset.
- Alteração de senha e encerramento das outras sessões na tela Configurações.
- Rate limit persistido: login 5/minuto e limites mais restritos nos endpoints de reset.
- Todas as APIs privadas verificam sessão e aplicam `owner_user_id`.

## Módulos implementados

- Dashboard operacional com clientes, recorrência, MRR, oportunidades e financeiro.
- Página “Precisa da sua atenção” com urgências agregadas.
- Empresas/prospects com CRUD, filtros, importação, exportação, soft delete e restauração.
- Empresa 360º com contatos, tags, próxima ação, projetos, oportunidades, propostas, financeiro, domínios, hospedagem, e-mail, reuniões, tarefas, notas/interações e timeline.
- Contatos múltiplos, principal único e responsável financeiro.
- Pipeline configurável, Kanban persistente, ganho/perda e motivo da perda.
- Projetos, tecnologias normalizadas no schema, hospedagem e serviços de e-mail sem secrets.
- Propostas e reuniões reais.
- Assinaturas, cobranças por billing period, pagamentos e MRR normalizado por frequência.
- Domínios com responsabilidade destacada e thresholds configuráveis.
- Tarefas com concluir, concluir e criar próxima, adiar e cancelar.
- Templates, cópia, WhatsApp brasileiro via `wa.me`, envio Resend e log de mensagens.
- Busca server-side em empresas, contatos, domínios e projetos.
- CSV com preview/validação de empresas e exportação de sete entidades.
- Relatórios comerciais, financeiros, de clientes e domínios.
- Configurações persistidas para nome comercial, timezone, moeda, tema, alertas e pós-venda.
- Central de notificações com leitura individual e leitura em massa.

## Automações

`GET /api/cron/automations` é protegido por `CRON_SECRET` e agendado diariamente no `vercel.json`. O service gera cobranças futuras sem depender de pagamento anterior, ativa/agora vence cobranças, cria alertas de domínio, follow-ups, pós-venda, proposta parada e reunião próxima. Tarefas/notificações usam unique idempotency keys e cobranças recorrentes usam `(subscription_id, billing_period)`. Todas as execuções ficam em `automation_runs`.

## Resend e WhatsApp

O transporte Resend, templates HTML escapados, reset de senha, envio operacional e logging estão implementados. Sem `RESEND_API_KEY` as páginas não relacionadas continuam funcionando e a integração informa configuração pendente. O domínio/remetente ainda precisam ser verificados no painel externo.

WhatsApp funciona sem API: normaliza telefone brasileiro e abre `wa.me` com mensagem renderizada. Não existe envio automático, webhook ou WhatsApp Business Cloud API nesta versão.

## Segurança

- A antiga vulnerabilidade de identificador SQL foi removida por allowlist fechado de tabelas.
- Hash/salt e senha provisória fixa foram removidos do código novo e do histórico destinado ao GitHub.
- Entradas são validadas no servidor com schemas estritos.
- Sessões podem ser revogadas e reset de senha revoga sessões existentes.
- Better Auth fornece proteção de origem/cookie e o app restringe trusted origins.
- Cron usa Bearer token e comparação em tempo constante.
- `.gitignore` bloqueia envs, chaves, bancos/dumps, artefatos de teste e configuração Vercel local.
- CSV exportado neutraliza fórmulas; HTML de e-mail escapa dados.
- Auditoria `npm audit` encerrou com zero vulnerabilidades conhecidas.

## Testes e validações

Validações locais executadas: instalação, lint, TypeScript, testes unitários, geração de migration, auditoria de dependências e build do Next.js. O QA público verificou login, recuperação, reset e responsividade em 375, 390, 430 e 1440 px; o teste encontrou e corrigiu o tipo dos botões de submit.

Os testes autenticados e de integração com banco ainda precisam ser executados depois de fornecer uma `TEST_DATABASE_URL`/branch Neon descartável. Isso é uma dependência externa, não deve ser executado contra Production.

## Variáveis

Obrigatórias: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Operacionais: `NEXT_PUBLIC_APP_URL`, `APP_TIMEZONE`, `CRON_SECRET`. Opcionais: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`. Bootstrap temporário: `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`.

## Deploy

1. Criar branches Neon separadas e aplicar `npm run db:migrate`.
2. Criar o administrador com `npm run create-admin` e remover as envs temporárias.
3. Importar o GitHub na Vercel e cadastrar envs por Development/Preview/Production.
4. Validar a URL `*.vercel.app`, cron, logs, auth e módulos privados.
5. Verificar domínio/remetente no Resend se e-mail for habilitado.
6. Somente então adicionar `clientes.gabrielmisao.com.br` na Vercel e copiar os DNS informados pelo painel.

## Limitações conhecidas

- Nenhum deploy, banco Neon ou DNS foi criado sem as credenciais/ações externas do proprietário.
- Integração autenticada real aguarda banco de teste.
- Listas grandes usam limites de leitura defensivos em timeline/logs, mas paginação completa de todas as grades pode ser ampliada antes de volumes muito altos.
- Tecnologias estão normalizadas no banco, mas o seletor N:N de tecnologias por projeto ainda não está exposto na interface.
- Recursos deliberadamente futuros: Google Calendar OAuth, WhatsApp Business Cloud API, IA, PDF de proposta e permissões multiusuário complexas.

## Referências operacionais

Consulte `README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/AUTOMATIONS.md` e `docs/TECHNICAL_HANDOFF_LEGACY.md`.
