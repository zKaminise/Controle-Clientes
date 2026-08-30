# Arquitetura

## Visão geral

```text
Navegador
   │ HTTPS + cookie HttpOnly
   ▼
Vercel / Next.js App Router
   ├─ Server Components: sessão e entrada da aplicação
   ├─ Client Components: formulários, modais, filtros e Kanban
   ├─ Route Handlers: API privada, busca, CSV, e-mail e cron
   ├─ Better Auth: credenciais, sessão e rate limit
   ├─ Services: regras de CRM, financeiro e automações
   └─ Drizzle ORM + Neon HTTP
                         │
                         ▼
                  Neon PostgreSQL
```

Integrações externas: Resend para e-mail, Vercel Cron para execução diária e `wa.me` para abrir conversas no WhatsApp. Google Calendar, WhatsApp Business Cloud API, IA e PDF de propostas são extensões futuras deliberadas.

## Limites de segurança

- A conta é criada por script administrativo; cadastro público fica desativado.
- Toda rota de dados chama a camada de autorização e filtra por `owner_user_id`.
- A UI nunca é a única barreira: validação Zod e autorização acontecem no servidor.
- Tabelas mutáveis usam um allowlist fechado; nomes de tabela nunca vêm da requisição.
- Secrets permanecem em variáveis server-side e não usam prefixo `NEXT_PUBLIC_`.
- Better Auth mantém sessões no PostgreSQL, cookies seguros em produção e rate limit no banco.
- O cron exige Bearer token comparado em tempo constante.

## Camadas

- `app/`: páginas e endpoints HTTP.
- `components/ui/`: componentes visuais preservados do projeto original.
- `db/schema.ts`: modelo relacional PostgreSQL.
- `db/index.ts`: conexão Neon/Drizzle.
- `lib/validation.ts`: contratos de entrada.
- `lib/app-service.ts`: operações autenticadas e timeline.
- `lib/automation-service.ts`: jobs sem dependência da abertura do dashboard.
- `lib/business.ts`: regras puras e testáveis.
- `lib/email*.ts`: transporte Resend e templates HTML seguros.
- `scripts/`: seed e bootstrap do administrador.
- `tests/`: regras críticas e CSV.

## Decisões importantes

- Uma empresa muda de prospect para cliente; não é duplicada quando a oportunidade é ganha.
- Notas são `interactions` do tipo `note`, permitindo histórico ilimitado sem tabela redundante.
- Cobranças recorrentes são identificadas por `(subscription_id, billing_period)` e não dependem do pagamento do ciclo anterior.
- Dinheiro permanece como decimal no banco e string na fronteira do ORM; conversões calculadas usam centavos quando necessário.
- Vencimentos usam `date`; eventos auditáveis usam `timestamptz`.
- Soft delete usa `archived_at` onde preservar histórico é importante.

## Legado e rollback

O remote `sites-legacy` e a branch local `legacy-sites` apontam para a versão anterior. Eles não fazem parte da arquitetura de produção e não devem receber secrets ou evoluções do sistema novo.
