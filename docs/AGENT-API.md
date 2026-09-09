# API de agentes — leituras e escritas controladas

Base de produção: `https://clientes.gabrielmisao.com.br/api/agent/v1`

Esta API é exclusiva para integrações estruturadas. Ela não expõe `/api/app`, não aceita o cookie/sessão do Better Auth e não dá acesso ao Drizzle, PostgreSQL ou `DATABASE_URL`. Leituras usam `GET`; as escritas operacionais permitidas usam `POST`, `PATCH` ou `PUT` com scope próprio e idempotência obrigatória.

Para ChatGPT e Codex, a interface preferencial é o MCP remoto com OAuth 2.1 documentado em [MCP-INTEGRATION.md](./MCP-INTEGRATION.md). O Bearer opaco desta página permanece como fallback de migração e não deve ser ampliado sem necessidade.

## Arquitetura e limites de confiança

O consumidor envia um token Bearer opaco. O servidor armazena somente SHA-256 do token e associa a credencial a uma integração identificada, um único proprietário, audience, scopes, expiração, estado de revogação e limite por minuto. Toda consulta recebe `ownerUserId` da identidade validada no servidor; esse valor nunca é aceito da requisição.

O acesso é permitido apenas quando o e-mail do proprietário coincide com `AGENT_ALLOWED_ADMIN_EMAIL` (ou `ADMIN_EMAIL`; na ausência de ambos, `gabriel.misao08@gmail.com`). A audience padrão é `${NEXT_PUBLIC_APP_URL}/api/agent/v1`.

Há dois limites por minuto: um limite pré-autenticação por hash do IP e outro por integração. Cada resposta tem `X-Request-Id`; chamadas autenticadas registram integração, proprietário, token prefixado, rota, scope, código HTTP e duração. O token completo e os dados retornados nunca entram na auditoria.

Tabelas internas:

- `agent_integrations`: identidade, proprietário, audience, scopes, limite e revogação;
- `agent_access_tokens`: hash, prefixo identificável, expiração, uso e revogação;
- `agent_rate_limit_buckets`: contadores atômicos por minuto;
- `agent_audit_logs`: trilha técnica de chamadas.

## Autenticação

### Primeiro consumidor / Getting Started

1. Confirme que `.env.local` está fora do Git e contém as variáveis server-side necessárias. Para o consumidor local, use:

```dotenv
AGENT_API_BASE_URL=https://clientes.gabrielmisao.com.br/api/agent/v1
AGENT_API_TOKEN=
```

Nunca grave o token real em `.env.example` ou em outro arquivo versionado.

2. Emita uma credencial de 60 dias para o primeiro consumidor. No Windows, a opção recomendada entrega o segredo diretamente ao clipboard sem imprimi-lo:

```bash
npm run agent:create-token -- --name codex-readonly --audience https://clientes.gabrielmisao.com.br/api/agent/v1 --scopes crm:leads:read,crm:pipeline:read,crm:followups:read,crm:analysis:read,crm:metrics:read --expires-in-days 60 --rate-limit 60 --copy-to-clipboard
```

O banco recebe apenas o hash SHA-256. O valor completo fica somente no processo e no clipboard. Se o administrador preferir visualizá-lo, `--show-token` funciona exclusivamente em um terminal interativo TTY e deve ser usado longe de gravações ou compartilhamento de tela.

3. Execute o consumidor real sem salvar ou imprimir o segredo:

```powershell
$env:AGENT_API_BASE_URL='https://clientes.gabrielmisao.com.br/api/agent/v1'
$env:AGENT_API_TOKEN=Get-Clipboard
npm run agent:test-api
Remove-Item Env:AGENT_API_TOKEN
```

O relatório do consumidor contém apenas códigos HTTP, contagens, campos validados e request IDs. Não mostra nomes, IDs de leads, contatos ou o Bearer token.

4. Para uma consulta manual segura com variável de ambiente:

```bash
curl \
  -H "Authorization: Bearer $AGENT_API_TOKEN" \
  "$AGENT_API_BASE_URL/leads?page=1&pageSize=5"
```

5. Liste integrações e tokens sem revelar segredos:

```bash
npm run agent:list
```

A listagem mostra `clientId`, token ID, fingerprint, status, expiração, último uso, audience, scopes e rate limit. O hash também não é exibido.

6. Revogue uma integração inteira ou somente um token:

```bash
npm run agent:revoke -- --client-id cca_client_EXEMPLO
npm run agent:revoke -- --token-id 00000000-0000-4000-8000-000000000000
```

A revogação tem efeito imediato e não depende da expiração.

### Uso do Bearer

```http
Authorization: Bearer cca_...
Accept: application/json
```

Nunca configure esse token como variável `NEXT_PUBLIC_*`, não o salve no navegador e não o envie como query string.

Boas práticas: armazene o segredo em cofre de credenciais, conceda somente os scopes necessários, use HTTPS, prefira credenciais diferentes por consumidor, revise `lastUsedAt`, revogue credenciais sem uso e faça rotação antes do vencimento. Nunca coloque o token em código, argumentos de processo, query string, frontend, Git, documentação, screenshots ou logs.

## Scopes

| Scope                | Autoriza                                        |
| -------------------- | ----------------------------------------------- |
| `crm:leads:read`     | pesquisa, detalhe e etapa de prospecção do lead |
| `crm:pipeline:read`  | etapa de uma oportunidade                       |
| `crm:followups:read` | follow-ups e Minha Atenção                      |
| `crm:analysis:read`  | score reduzido do lead                          |
| `crm:metrics:read`   | métricas comerciais                             |
| `crm:leads:write` | cadastrar/atualizar lead e alterar etapa |
| `crm:pipeline:write` | mover oportunidade |
| `crm:interactions:write` | criar contato e registrar resultado |
| `crm:followups:write` | criar follow-up |
| `crm:referrals:write` | registrar indicação |
| `crm:analysis:write` | criar/atualizar análise digital |

Uma credencial sem o scope exigido recebe `403 AGENT_SCOPE_REQUIRED`.

## Endpoints

### `GET /leads`

Ferramenta equivalente: `crm_search_leads`. Filtros opcionais: `query`, `industry`, `city`, `state`, `lifecycleStatus`, `prospectingStatus`, `siteStatus`, `priority`, `page` e `pageSize`. `pageSize` varia de 1 a 100 e assume 25. Parâmetros desconhecidos ou repetidos são rejeitados.

```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Empresa",
        "lifecycleStatus": "lead",
        "prospectingStatus": "NOVO_LEAD",
        "digitalAnalysis": null,
        "lastInteraction": null
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "total": 1, "pages": 1 }
  },
  "meta": { "requestId": "uuid" }
}
```

### `GET /leads/:id`

Ferramenta equivalente: `crm_get_lead`. Retorna o resumo da empresa, análise digital, os 20 contatos recentes, até 20 follow-ups abertos, oportunidades e indicações. Não retorna sessão, credenciais, configurações ou dados de pagamento.

### `GET /leads/:id/stage`

Ferramenta equivalente: `crm_get_lead_stage`. Retorna `leadId`, `leadName`, `prospectingStatus` e `updatedAt`.

`company.prospectingStatus` representa a cadência operacional de prospecção da empresa, por exemplo novo lead, contato realizado, sem resposta ou interessado. Ele pertence ao lead e pode existir sem oportunidade.

### `GET /opportunities/:id/stage`

Ferramenta equivalente: `crm_get_opportunity_stage`. Retorna a oportunidade e seu objeto `stage`, com `id`, `name`, `slug`, `position`, `isWon` e `isLost`.

`opportunity.pipelineStageId` representa a posição de uma oportunidade no funil configurável. Uma empresa pode ter várias oportunidades e cada uma pode estar em uma etapa diferente. Portanto, ele não é sinônimo de `company.prospectingStatus` e os dois valores não devem ser sincronizados implicitamente.

### `GET /follow-ups`

Ferramenta equivalente: `crm_get_follow_ups`. Aceita `bucket=overdue|today|upcoming|without_action` e `limit` de 1 a 100. Sem `bucket`, retorna os quatro grupos. As fronteiras de hoje usam `America/Sao_Paulo` explicitamente.

### `GET /leads/:id/score`

Ferramenta equivalente: `crm_get_lead_score`. Resposta reduzida a `leadId`, `leadName`, `leadScore`, `scoreLevel`, `priority`, `scoreBreakdown` e `analyzedAt`.

### `GET /attention`

Ferramenta equivalente: `crm_get_attention`. Consolida tarefas/follow-ups, cobranças atrasadas, domínios vencendo, reuniões próximas e leads sem ação. Aceita `type=task|charge|domain|meeting|lead_without_action`, `priority=low|normal|high|urgent`, `from`, `to` no formato `YYYY-MM-DD` e `limit` de 1 a 100.

### `GET /metrics/commercial`

Ferramenta equivalente: `crm_get_commercial_metrics`. Aceita `from`, `to`, `timezone=America/Sao_Paulo` e `comparePrevious=true|false`. Sem período, usa o mês corrente em São Paulo. Retorna novos leads, contatos, sem resposta, interessados, reuniões, propostas, negociações, clientes fechados, taxa de conversão e receita de projetos. A comparação usa um período anterior de igual duração.

As contagens e somas são calculadas no banco. Transições comerciais são lidas da auditoria de atividades; por isso, métricas históricas anteriores à adoção desse registro podem não reconstruir estados antigos.

## Endpoints de escrita

Toda rota abaixo exige `Authorization: Bearer`, `Content-Type: application/json` e `Idempotency-Key`. A chave deve ser única por intenção; repetir o mesmo payload devolve o resultado original, enquanto reutilizá-la com outro payload falha. Payload máximo: 64 KiB.

| Método e rota | Scope | Payload |
| --- | --- | --- |
| `POST /leads` | `crm:leads:write` | cadastro validado do lead |
| `PATCH /leads/:id` | `crm:leads:write` | `expectedUpdatedAt` e campos alterados |
| `PATCH /leads/:id/stage` | `crm:leads:write` | `expectedUpdatedAt`, `prospectingStatus`, `reason?` |
| `PATCH /opportunities/:id/stage` | `crm:pipeline:write` | `expectedUpdatedAt`, `pipelineStageId`, `reason?`, `lostReason?` |
| `POST /interactions` | `crm:interactions:write` | `companyId`, canal, conteúdo, datas e próxima ação opcionais |
| `PATCH /interactions/:id/result` | `crm:interactions:write` | `expectedUpdatedAt`, `result`, notas/próxima ação opcionais |
| `POST /follow-ups` | `crm:followups:write` | empresa, título, prioridade, vencimento e lembrete opcionais |
| `POST /referrals` | `crm:referrals:write` | empresa indicadora, indicada, status e notas |
| `PUT /leads/:id/digital-analysis` | `crm:analysis:write` | versão opcional e campos da análise |

Datas são ISO 8601 com offset. IDs são UUID. Objetos rejeitam campos desconhecidos. `nextAction` e `nextActionAt` devem ser enviados juntos. Atualizações sobre versão antiga retornam `409 AGENT_VERSION_CONFLICT`. Respostas bem-sucedidas incluem `meta.idempotentReplay`.

Exemplo:

```http
PATCH /api/agent/v1/leads/UUID/stage HTTP/1.1
Authorization: Bearer cca_...
Content-Type: application/json
Idempotency-Key: crm-stage-20260909-001

{
  "expectedUpdatedAt": "2026-09-09T14:20:00.000Z",
  "prospectingStatus": "INTERESSADO",
  "reason": "Respondeu ao contato"
}
```

Criar contato/resultado com próxima ação cria o follow-up no mesmo lote transacional. Mover oportunidade grava histórico. Atualizar análise digital recalcula o score no servidor.

## Respostas e erros

Sucesso:

```json
{ "data": {}, "meta": { "requestId": "uuid" } }
```

Erro:

```json
{
  "error": {
    "code": "AGENT_SCOPE_REQUIRED",
    "message": "A credencial não possui o scope necessário.",
    "requestId": "uuid",
    "details": { "requiredScope": "crm:pipeline:read" }
  }
}
```

Códigos usuais: `AGENT_AUTH_REQUIRED` (401), `AGENT_TOKEN_INVALID` (401), `AGENT_INTEGRATION_REVOKED` (401), `AGENT_OWNER_FORBIDDEN` (403), `AGENT_AUDIENCE_INVALID` (403), `AGENT_SCOPE_REQUIRED` (403), `AGENT_INVALID_REQUEST` (400), `AGENT_IDEMPOTENCY_REQUIRED` (400), `AGENT_IDEMPOTENCY_CONFLICT` (409), `AGENT_VERSION_CONFLICT` (409), `AGENT_LEAD_NOT_FOUND` (404), `AGENT_OPPORTUNITY_NOT_FOUND` (404), `AGENT_RATE_LIMITED` (429) e `AGENT_INTERNAL_ERROR` (500). Respostas 429 incluem `Retry-After`.

## Configuração

Variáveis opcionais, recomendadas em produção:

```dotenv
AGENT_ALLOWED_ADMIN_EMAIL=gabriel.misao08@gmail.com
AGENT_API_AUDIENCE=https://clientes.gabrielmisao.com.br/api/agent/v1
```

Depois de mudar a audience, emita uma nova credencial; tokens criados para outro recurso são rejeitados.

## Verificação operacional

```bash
npm run agent:list
npm run agent:test-api
npm run agent:test-security
npm run agent:test-writes
npm run agent:verify-queries
npm run db:verify
```

`agent:test-api` é o consumidor HTTP de ponta a ponta. `agent:test-security` cria credenciais técnicas descartáveis para expiração, revogação, audience, scope e rate limit e revoga todas no final. `agent:verify-queries` executa somente leituras diretas para diagnóstico interno; consumidores externos nunca devem usá-lo. `db:verify` confere schema e contagens. Carregue as variáveis de ambiente antes de executar.

## Limites deliberados

- Não existem endpoints de agente para exclusões, pagamentos, usuários, configurações críticas ou alterações em massa.
- O token opaco revogável é uma credencial transitória; OAuth 2.1 no MCP é o caminho preferencial.
- O token `codex-readonly` continua somente leitura. Para qualquer novo consumidor opaco, conceda o conjunto mínimo de scopes explicitamente.
- O MCP e esta API reutilizam os mesmos serviços de domínio, validações, isolamento por proprietário, idempotência e auditoria.
- Rate-limit buckets e auditoria devem receber política de retenção antes de volume elevado.
