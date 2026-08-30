# Final handoff — Controle de Clientes

Data de consolidação: 30/08/2026.

## Estado

O Neon Production já está conectado, com migration aplicada e schema verificado. O banco comercial está vazio e ainda não possui administrador. O código está tecnicamente preparado para o deploy final, mas a Vercel ainda exige login/configuração: o domínio responde pela infraestrutura Vercel com HTTPS, porém retorna `DEPLOYMENT_NOT_FOUND`. Resend possui API key informada pelo proprietário, mas o endereço remetente ainda está inválido/ausente. A aplicação legada permanece somente como rollback temporário.

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

A migration `drizzle/0000_medical_sway.sql` cria UUIDs, enums, FKs, índices, unique/check constraints, JSONB, datas civis, timestamps com timezone e `numeric(12,2)`. Em 30/08/2026, ela foi aplicada no Neon Production. `npm run db:verify` confirmou 31/31 tabelas, 63 FKs, 79 índices totais, nenhum campo monetário inválido e zero registros em todas as tabelas comerciais.

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
- Templates, cópia, WhatsApp brasileiro via `wa.me`, envio Resend, log de mensagens e teste de e-mail autenticado nas Configurações.
- Busca server-side em empresas, contatos, domínios e projetos.
- CSV com preview/validação de empresas e exportação de sete entidades.
- Relatórios comerciais, financeiros, de clientes e domínios.
- Configurações persistidas para nome comercial, timezone, moeda, tema, alertas e pós-venda.
- Central de notificações com leitura individual e leitura em massa.

## Automações

`GET /api/cron/automations` é protegido por `CRON_SECRET` e agendado diariamente no `vercel.json`. O service gera cobranças futuras sem depender de pagamento anterior, ativa/agora vence cobranças, cria alertas de domínio, follow-ups, pós-venda, proposta parada e reunião próxima. Tarefas/notificações usam unique idempotency keys e cobranças recorrentes usam `(subscription_id, billing_period)`. Todas as execuções ficam em `automation_runs`.

## Resend e WhatsApp

O transporte Resend, templates HTML escapados, reset de senha, envio operacional, logging e botão de teste autenticado estão implementados. `RESEND_API_KEY` e `RESEND_FROM_EMAIL` são opcionais como conjunto; se apenas uma existir, o build falha com indicação específica. A API key foi informada como existente, mas o remetente completo e o domínio efetivamente verificado ainda precisam ser confirmados no painel externo.

WhatsApp funciona sem API: normaliza telefone brasileiro e abre `wa.me` com mensagem renderizada. Não existe envio automático, webhook ou WhatsApp Business Cloud API nesta versão.

## Segurança

- A antiga vulnerabilidade de identificador SQL foi removida por allowlist fechado de tabelas.
- Hash/salt e senha provisória fixa foram removidos do código novo e do histórico destinado ao GitHub.
- Entradas são validadas no servidor com schemas estritos.
- Sessões podem ser revogadas e reset de senha revoga sessões existentes.
- Better Auth fornece proteção de origem/cookie; o app confia somente na URL canônica e no hostname Production `*.vercel.app` fornecido pela própria Vercel.
- Cron usa Bearer token e comparação em tempo constante.
- `.gitignore` bloqueia envs, chaves, bancos/dumps, artefatos de teste e configuração Vercel local.
- CSV exportado neutraliza fórmulas; HTML de e-mail escapa dados.
- Headers de produção aplicam `nosniff`, frame deny, referrer policy, permissions policy e HSTS; source maps do navegador ficam desativados.
- Auditoria `npm audit` encerrou com zero vulnerabilidades conhecidas.

## Testes e validações

Validações locais executadas: instalação, lint, TypeScript, 17 testes unitários, migration real, verificação estrutural do Neon, auditoria de dependências e build do Next.js. O QA público anterior verificou login, recuperação, reset e responsividade em 375, 390, 430 e 1440 px; o teste encontrou e corrigiu o tipo dos botões de submit.

O smoke test autenticado em produção, cron real, Resend real e limpeza dos respectivos registros QA ainda dependem do deploy e do administrador. Nenhum dado QA foi inserido no Neon antes dessa etapa.

## Variáveis

Runtime obrigatório: `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `APP_TIMEZONE`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e `CRON_SECRET`. E-mail como conjunto: `RESEND_API_KEY` e `RESEND_FROM_EMAIL`. Opcional: `RESEND_FROM_NAME`. Bootstrap temporário: `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`.

## Deploy

1. Entrar na Vercel e vincular o projeto ao repositório/branch `main`.
2. Corrigir as variáveis Production conforme `docs/PRODUCTION_RUNBOOK.md` e publicar.
3. Criar o administrador com uma senha inicial válida, executar seed e remover as envs de bootstrap.
4. Vincular o domínio que já aponta para a Vercel ao deployment correto e validar HTTPS.
5. Confirmar remetente no Resend e executar auth, cron, e-mail e smoke test completo.
6. Remover somente os dados QA criados nessa validação e repetir `npm run db:verify`.

## Limitações conhecidas

- O deploy Vercel final aguarda uma sessão autenticada do proprietário.
- O administrador aguarda uma senha inicial válida de 12 a 128 caracteres; o valor local atual não atende o mínimo e não foi enfraquecido.
- O remetente completo do Resend ainda precisa ser confirmado.
- Listas grandes usam limites de leitura defensivos em timeline/logs, mas paginação completa de todas as grades pode ser ampliada antes de volumes muito altos.
- Tecnologias estão normalizadas no banco, mas o seletor N:N de tecnologias por projeto ainda não está exposto na interface.
- Recursos deliberadamente futuros: Google Calendar OAuth, WhatsApp Business Cloud API, IA, PDF de proposta e permissões multiusuário complexas.

## Referências operacionais

Consulte `README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/AUTOMATIONS.md` e `docs/TECHNICAL_HANDOFF_LEGACY.md`.
