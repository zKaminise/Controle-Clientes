# Banco de dados

O schema final é PostgreSQL e está em `db/schema.ts`. Em 30/08/2026, a migration inicial foi aplicada no Neon Production e a verificação direta confirmou 31 tabelas, 79 índices totais, 63 foreign keys e constraints de integridade. Todos os IDs principais usam UUID gerado pelo PostgreSQL.

## Catálogo de tabelas

| Tabela | Objetivo | PK / FKs principais | Uniques e índices relevantes |
|---|---|---|---|
| `users` | Administradores do Better Auth | PK `id` | e-mail único |
| `sessions` | Sessões revogáveis | PK; FK usuário | token único; usuário/expiração |
| `accounts` | Credencial Better Auth | PK; FK usuário | provider + account |
| `verifications` | Tokens temporários | PK | identificador/valor |
| `rate_limits` | Limites persistidos | chave primária textual | expiração |
| `companies` | Prospect, cliente ou ex-cliente | PK; FK owner e indicação | owner+nome/documento; lifecycle e próximo contato |
| `contacts` | Múltiplos contatos por empresa | PK; FKs owner/empresa | empresa; owner+e-mail |
| `pipeline_stages` | Etapas configuráveis do funil | PK; FK owner | owner+slug e owner+posição |
| `opportunities` | Negociações comerciais | PK; FKs owner/empresa/stage | stage, empresa, próxima ação |
| `projects` | Entregas e manutenção | PK; FKs owner/empresa | empresa/status |
| `technologies` | Catálogo técnico | PK; FK owner | owner+nome |
| `project_technologies` | N:N projeto/tecnologia | PK composta; duas FKs | par único pela PK |
| `domains` | Registro e renovação de domínios | PK; FKs owner/empresa/projeto | owner+domínio; expiração e empresa |
| `hosting_services` | Hospedagem por cliente/projeto | PK; FKs owner/empresa/projeto | empresa/status |
| `email_services` | Serviço de e-mail sem credenciais | PK; FKs owner/empresa/projeto | empresa/status |
| `services` | Catálogo de serviços | PK; FK owner | owner+nome |
| `subscriptions` | Recorrências independentes | PK; FKs owner/empresa/projeto/serviço | próxima cobrança; empresa/status |
| `charges` | Parcelas/cobranças por período | PK; FKs owner/empresa/projeto/assinatura | assinatura+período; vencimento/status e empresa |
| `payments` | Recebimentos parciais ou integrais | PK; FKs owner/cobrança | cobrança/data |
| `proposals` | Propostas comerciais | PK; FKs owner/empresa/oportunidade | empresa/status e validade |
| `meetings` | Agenda comercial | PK; FKs owner/empresa/oportunidade | data da reunião |
| `tasks` | Próximas ações manuais/automáticas | PK; FKs owner e entidades relacionadas | `idempotency_key` único; vencimento/status |
| `interactions` | WhatsApp, e-mail, ligação, reunião e notas | PK; FKs owner/empresa/oportunidade/autor | empresa/data |
| `message_templates` | Modelos editáveis | PK; FK owner | owner+nome |
| `message_logs` | Auditoria de envio/cópia | PK; FKs owner/empresa/template | data/status |
| `notifications` | Central de atenção | PK; FK usuário | `idempotency_key` único; lidas/não lidas |
| `tags` | Classificação flexível | PK; FK owner | owner+nome |
| `company_tags` | N:N empresa/tag | PK composta; duas FKs | par único pela PK |
| `activities` | Timeline/auditoria operacional | PK; FKs owner/empresa | owner/data e empresa/data |
| `settings` | Preferências não secretas | PK; FK owner | um registro por owner |
| `automation_runs` | Resultado de cada job | PK | job/data |

## Tipos e integridade

- Valores monetários: `numeric(12,2)`.
- Datas civis: PostgreSQL `date`.
- Eventos: `timestamp with time zone`.
- Estados fechados: enums PostgreSQL.
- Metadados: JSONB somente quando a estrutura relacional fixa não é adequada.
- Frequência de contato, probabilidade e valores possuem checks.
- Exclusões usam `CASCADE`, `SET NULL` ou `RESTRICT` conforme a retenção de histórico.

## Migrations

Ordem atual:

1. `drizzle/0000_medical_sway.sql` — enums, 31 tabelas, FKs, checks, uniques e índices.

Fluxo de mudança:

```bash
npm run db:generate
# revisar o novo SQL
npm run db:migrate
npm run db:seed
npm run db:verify
```

Nunca edite uma migration já aplicada em produção. Gere uma migration incremental.

## Ambientes e backup

A operação atual utiliza somente o Neon Production. Antes de uma migration relevante, crie um restore point/branch de segurança no Neon e teste a restauração de forma isolada. Os CSVs da aplicação são portabilidade funcional, não substituem backup completo do PostgreSQL.
