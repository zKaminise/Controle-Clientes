# API de agentes — fase 1 (somente leitura)

Base de produção: `https://clientes.gabrielmisao.com.br/api/agent/v1`

Esta API é exclusiva para integrações estruturadas. Ela não expõe `/api/app`, não aceita o cookie/sessão do Better Auth e não dá acesso ao Drizzle, PostgreSQL ou `DATABASE_URL`. Nesta fase, todas as rotas aceitam somente `GET`.

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

Crie a credencial em ambiente administrativo seguro, com as variáveis de produção carregadas:

```bash
npm run agent:create-token -- --name "ChatGPT/Codex leitura" --expires-in-days 90 --rate-limit 60
```

Para limitar os scopes:

```bash
npm run agent:create-token -- --name "Consulta de leads" --scopes crm:leads:read,crm:analysis:read
```

O comando mostra o token completo uma única vez. Guarde-o em um cofre de segredos e envie:

```http
Authorization: Bearer cca_...
Accept: application/json
```

Nunca configure esse token como variável `NEXT_PUBLIC_*`, não o salve no navegador e não o envie como query string.

Revogação imediata pelo identificador público da integração:

```bash
npm run agent:revoke -- --client-id cca_client_...
```

## Scopes

| Scope                | Autoriza                                        |
| -------------------- | ----------------------------------------------- |
| `crm:leads:read`     | pesquisa, detalhe e etapa de prospecção do lead |
| `crm:pipeline:read`  | etapa de uma oportunidade                       |
| `crm:followups:read` | follow-ups e Minha Atenção                      |
| `crm:analysis:read`  | score reduzido do lead                          |
| `crm:metrics:read`   | métricas comerciais                             |

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

Ferramenta equivalente: `crm_list_follow_ups`. Aceita `bucket=overdue|today|upcoming|without_action` e `limit` de 1 a 100. Sem `bucket`, retorna os quatro grupos. As fronteiras de hoje usam `America/Sao_Paulo` explicitamente.

### `GET /leads/:id/score`

Ferramenta equivalente: `crm_get_lead_score`. Resposta reduzida a `leadId`, `leadName`, `leadScore`, `scoreLevel`, `priority`, `scoreBreakdown` e `analyzedAt`.

### `GET /attention`

Ferramenta equivalente: `crm_get_attention`. Consolida tarefas/follow-ups, cobranças atrasadas, domínios vencendo, reuniões próximas e leads sem ação. Aceita `type=task|charge|domain|meeting|lead_without_action`, `priority=low|normal|high|urgent`, `from`, `to` no formato `YYYY-MM-DD` e `limit` de 1 a 100.

### `GET /metrics/commercial`

Ferramenta equivalente: `crm_get_commercial_metrics`. Aceita `from`, `to`, `timezone=America/Sao_Paulo` e `comparePrevious=true|false`. Sem período, usa o mês corrente em São Paulo. Retorna novos leads, contatos, sem resposta, interessados, reuniões, propostas, negociações, clientes fechados, taxa de conversão e receita de projetos. A comparação usa um período anterior de igual duração.

As contagens e somas são calculadas no banco. Transições comerciais são lidas da auditoria de atividades; por isso, métricas históricas anteriores à adoção desse registro podem não reconstruir estados antigos.

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

Códigos usuais: `AGENT_AUTH_REQUIRED` (401), `AGENT_TOKEN_INVALID` (401), `AGENT_INTEGRATION_REVOKED` (401), `AGENT_OWNER_FORBIDDEN` (403), `AGENT_AUDIENCE_INVALID` (403), `AGENT_SCOPE_REQUIRED` (403), `AGENT_INVALID_REQUEST` (400), `AGENT_LEAD_NOT_FOUND` (404), `AGENT_OPPORTUNITY_NOT_FOUND` (404), `AGENT_RATE_LIMITED` (429) e `AGENT_INTERNAL_ERROR` (500). Respostas 429 incluem `Retry-After`.

## Configuração

Variáveis opcionais, recomendadas em produção:

```dotenv
AGENT_ALLOWED_ADMIN_EMAIL=gabriel.misao08@gmail.com
AGENT_API_AUDIENCE=https://clientes.gabrielmisao.com.br/api/agent/v1
```

Depois de mudar a audience, emita uma nova credencial; tokens criados para outro recurso são rejeitados.

## Verificação operacional

```bash
npm run agent:verify-queries
npm run db:verify
```

O primeiro comando executa somente leituras na conta administrativa. O segundo confere schema e contagens. Carregue as variáveis de ambiente antes de executar.

## Limitações e próximos passos

- Não há endpoints de escrita, endpoint genérico, scraping, MCP ou OAuth nesta fase.
- Ainda não existe credencial ativa após a migração; ela só nasce pelo comando administrativo.
- O token opaco revogável é uma credencial transitória. A identidade, audience e scopes já permitem migrar para OAuth 2.1 sem alterar os contratos de domínio.
- Uma fase futura pode publicar essas operações como ferramentas MCP com OAuth 2.1 e aprovação própria, preservando a API como única fronteira com o banco.
- Rate-limit buckets e auditoria devem receber política de retenção antes de volume elevado.
