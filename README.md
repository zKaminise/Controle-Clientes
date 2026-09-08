# Controle de Clientes — Minha Operação

Sistema web privado para administrar leads, prospecção, clientes, projetos, propostas, reuniões, recorrências, cobranças, pagamentos, domínios, tarefas e comunicação. O acesso público é desativado: existe somente o administrador criado pelo comando de bootstrap.

## CRM de prospecção

- Empresas classificadas como lead, prospect, cliente, ex-cliente ou parceiro.
- Funil de prospecção com 21 estados claros e mudança rápida pela grade.
- Análise digital de site, mobile, velocidade, design, CTA, SEO, HTTPS e oportunidades.
- Lead score de 0 a 100, faixas de prioridade e regras configuráveis.
- Histórico individual de contatos, resultado, observação e próxima ação.
- Follow-ups com motivo, prioridade e lembrete; visão diária e leads sem ação.
- Indicações com indicador, indicado, status e conversão.
- Importação CSV em etapas, com mapeamento, prévia, erros e tratamento de duplicados.
- Filtros combináveis e APIs autenticadas para automação futura.

Consulte o [guia rápido](./docs/CRM-GUIDE.md), a [API privada](./docs/CRM-API.md) e a [auditoria inicial](./docs/CRM-AUDIT.md).

## Arquitetura

```text
GitHub → Vercel → Next.js App Router → Neon PostgreSQL
                     ├─ Better Auth
                     ├─ Resend
                     ├─ Vercel Cron
                     └─ WhatsApp via wa.me
```

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM, Neon Serverless, Better Auth, Zod, Resend, Vitest e ESLint.

## Instalação local

Requisitos: Node.js 22.x, npm e acesso ao Neon Production.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run create-admin
npm run dev
```

No Windows PowerShell, use `Copy-Item .env.example .env.local` no lugar de `cp`.

O endereço local é `http://localhost:3000`. A validação também é executada no build: variáveis obrigatórias ausentes ou inválidas interrompem a compilação em vez de produzir um deploy inseguro.

## Variáveis de ambiente

Use [.env.example](./.env.example) como modelo. Nunca versione `.env.local`.

- `DATABASE_URL`: string pooled do Neon para o ambiente atual.
- `NEXT_PUBLIC_APP_URL`: URL pública da aplicação.
- `APP_TIMEZONE`: timezone operacional; padrão `America/Sao_Paulo`.
- `BETTER_AUTH_SECRET`: segredo aleatório com pelo menos 32 caracteres.
- `BETTER_AUTH_URL`: URL canônica usada pelo Better Auth.
- `CRON_SECRET`: segredo independente, gerado com 32 bytes aleatórios, validado no endpoint do cron.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`: opcionais até ativar envio de e-mail.
- `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`: usados somente no bootstrap e removidos depois.

Gere secrets com `openssl rand -base64 32` ou, no PowerShell, com `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`.

## Banco, migrations e seed

```bash
npm run db:generate   # gera SQL a partir do schema
npm run db:migrate    # aplica migrations em DATABASE_URL
npm run db:seed       # seed idempotente para usuários existentes
npm run db:studio     # abre o Drizzle Studio
```

O schema usa UUID, `numeric(12,2)` para dinheiro, `date` para vencimentos, `timestamptz` para eventos, enums, JSONB, FKs, índices e constraints. As migrations são incrementais e ficam em `drizzle/`; nunca edite uma migration já aplicada. Consulte [docs/DATABASE.md](./docs/DATABASE.md).

## Primeiro administrador

Defina temporariamente em `.env.local`:

```env
ADMIN_EMAIL=gabriel.misao08@gmail.com
ADMIN_INITIAL_PASSWORD=
```

Depois execute `npm run create-admin`, entre no sistema, altere a senha em Configurações e remova as duas variáveis de bootstrap. Não existe senha padrão no repositório e não há tela pública de cadastro.

## Desenvolvimento e qualidade

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

## Neon e Vercel

A operação atual usa uma única linha oficial: `GitHub main → Vercel Production → Neon Production`. Preview e staging não são requisitos. Nunca execute seed demo, limpeza ou teste destrutivo nesse banco. O deploy não altera dados automaticamente. Consulte [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) e [docs/PRODUCTION_RUNBOOK.md](./docs/PRODUCTION_RUNBOOK.md).

## Cron e Resend

`vercel.json` executa `/api/cron/automations` diariamente. A rota exige `Authorization: Bearer <CRON_SECRET>` e processa recorrências, vencimentos, alertas e follow-ups com chaves idempotentes. Consulte [docs/AUTOMATIONS.md](./docs/AUTOMATIONS.md).

O Resend é opcional para navegar e administrar dados. Para enviar e-mail, verifique um domínio no painel do Resend, configure os DNS fornecidos por ele e defina as três variáveis `RESEND_*`. Falhas de envio ficam registradas sem expor segredo.

## Exportação, backup e restauração

O módulo Relatórios/Configurações exporta CSV de empresas, contatos, projetos, domínios, cobranças, pagamentos e oportunidades. Para backup completo, use o recurso de restore/branching do Neon e mantenha uma política de retenção adequada ao plano contratado. Valide restaurações em uma branch isolada antes de qualquer uso em produção.

## Troubleshooting

- `Configuração pendente`: confira `DATABASE_URL`, `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL`.
- Login não funciona após banco novo: rode migrations e `npm run create-admin`.
- E-mail indisponível: configure `RESEND_API_KEY` e um remetente verificado.
- Cron retorna 401: confira se `CRON_SECRET` é idêntico na Vercel e no teste.
- Schema desatualizado: rode `npm run db:generate`, revise o SQL e depois `npm run db:migrate`.

## Documentação

- [Arquitetura](./docs/ARCHITECTURE.md)
- [Auditoria do CRM](./docs/CRM-AUDIT.md)
- [Guia do CRM](./docs/CRM-GUIDE.md)
- [API privada do CRM](./docs/CRM-API.md)
- [Relatório de implementação](./docs/CRM-IMPLEMENTATION.md)
- [Banco de dados](./docs/DATABASE.md)
- [Deploy](./docs/DEPLOYMENT.md)
- [Automações](./docs/AUTOMATIONS.md)
- [Runbook de produção](./docs/PRODUCTION_RUNBOOK.md)
- [Handoff final](./FINAL_HANDOFF.md)

O remote antigo do ChatGPT Sites permanece somente como rollback temporário (`sites-legacy`). A aplicação atual não depende de Sites, Vinext, Cloudflare Workers, D1, Wrangler ou Miniflare.
