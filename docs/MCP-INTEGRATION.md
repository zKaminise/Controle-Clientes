# Integração MCP do Controle de Clientes

Última atualização: 09/09/2026  
Servidor de produção: `https://clientes.gabrielmisao.com.br/mcp`

O transporte usa a revisão MCP `2026-07-28` e mantém o fallback stateless oficial para clientes Codex que ainda negociam `2025-06-18`. A autenticação, os scopes e o catálogo de ferramentas são idênticos nas duas revisões.

## Estado

A integração remota está implementada em duas camadas compatíveis:

1. MCP Streamable HTTP com OAuth 2.1 para ChatGPT, Codex e outros clientes MCP autorizados;
2. API HTTP `/api/agent/v1` com Bearer opaco revogável, mantida temporariamente para o consumidor `codex-readonly` da fase anterior.

Nenhum consumidor recebe credenciais do PostgreSQL, `DATABASE_URL`, acesso ao Drizzle ou uma API CRUD genérica. Toda leitura e escrita passa por operações específicas, validação de proprietário e escopo, rate limit e auditoria.

## Arquitetura e fronteiras de confiança

```text
ChatGPT / Codex
    | HTTPS + OAuth 2.1 (Authorization Code + PKCE S256)
    v
/mcp  ---> valida assinatura, issuer, audience, expiração, usuário e scopes
    | ---> filtra a lista de ferramentas pelos scopes concedidos
    v
serviços de domínio do agente
    | ---> valida payload, ownerUserId, idempotência e versão esperada
    v
Drizzle / PostgreSQL
```

O `ownerUserId` nunca vem do cliente. Ele é resolvido da identidade autenticada, aceita somente a conta administrativa configurada e é aplicado em todas as consultas e mutações. O e-mail padrão autorizado é `gabriel.misao08@gmail.com`.

## OAuth 2.1

O provedor é o Better Auth com os plugins oficiais JWT, MCP, OAuth Provider e CIMD.

- Fluxo: Authorization Code com PKCE `S256`.
- Identificação do cliente: Client ID Metadata Document (CIMD), sem registro dinâmico aberto.
- Consentimento: tela própria em `/oauth/consent`, acessível somente ao administrador autenticado.
- Access token: JWT assinado, validade de 15 minutos.
- Refresh token: validade de 30 dias, rotação sem janela de reuso.
- Authorization code: validade de 5 minutos.
- Audience/resource obrigatório e exato: `https://clientes.gabrielmisao.com.br/mcp`.
- Claims adicionais: `crm_role=admin` e identidade do usuário.
- Revogação e introspecção: endpoints publicados pelo provedor OAuth.

Descoberta:

- recurso protegido: `GET /.well-known/oauth-protected-resource/mcp`;
- autorização: `GET /api/auth/.well-known/oauth-authorization-server`;
- chaves públicas: `GET /api/auth/jwks`.

Uma chamada anônima a `POST /mcp` retorna `401` com `WWW-Authenticate` e `resource_metadata`, permitindo descoberta automática. O token deve ter `aud` igual ao recurso MCP; um token de outra API é recusado.

## Scopes

| Scope | Permissão |
| --- | --- |
| `crm:leads:read` | pesquisar e consultar leads/etapa |
| `crm:pipeline:read` | consultar etapa de oportunidade |
| `crm:followups:read` | consultar follow-ups e Minha Atenção |
| `crm:analysis:read` | consultar lead score |
| `crm:metrics:read` | consultar métricas comerciais |
| `crm:prospecting:read` | consultar lotes e candidatos pesquisados |
| `crm:leads:write` | cadastrar/atualizar lead e alterar etapa |
| `crm:pipeline:write` | mover oportunidade |
| `crm:interactions:write` | criar contato e registrar resultado |
| `crm:followups:write` | criar follow-up |
| `crm:referrals:write` | registrar indicação |
| `crm:analysis:write` | criar/atualizar análise digital |
| `crm:prospecting:write` | criar lotes, incluir/revisar/promover candidatos |

Também são anunciados `openid`, `profile`, `email` e `offline_access`. A lista retornada por `tools/list` contém somente as ferramentas permitidas pelos scopes efetivamente concedidos.

## Ferramentas MCP

### Leituras automáticas

| Ferramenta | Scope | Entrada principal |
| --- | --- | --- |
| `crm_search_leads` | `crm:leads:read` | filtros, `page`, `pageSize` |
| `crm_get_lead` | `crm:leads:read` | `leadId` |
| `crm_get_lead_stage` | `crm:leads:read` | `leadId` |
| `crm_get_opportunity_stage` | `crm:pipeline:read` | `opportunityId` |
| `crm_get_follow_ups` | `crm:followups:read` | `bucket`, `limit` |
| `crm_get_lead_score` | `crm:analysis:read` | `leadId` |
| `crm_get_attention` | `crm:followups:read` | tipo, prioridade, período, limite |
| `crm_get_commercial_metrics` | `crm:metrics:read` | período e comparação |
| `crm_list_prospecting_batches` | `crm:prospecting:read` | status e paginação |
| `crm_get_prospecting_batch` | `crm:prospecting:read` | `batchId` |
| `crm_list_prospecting_candidates` | `crm:prospecting:read` | `batchId`, status e paginação |

### Escritas operacionais automáticas

| Ferramenta | Scope | Objeto de entrada |
| --- | --- | --- |
| `crm_create_lead` | `crm:leads:write` | `idempotencyKey`, `lead` |
| `crm_update_lead` | `crm:leads:write` | `idempotencyKey`, `leadId`, `patch` |
| `crm_set_lead_stage` | `crm:leads:write` | `idempotencyKey`, `leadId`, `change` |
| `crm_move_opportunity` | `crm:pipeline:write` | `idempotencyKey`, `opportunityId`, `change` |
| `crm_create_interaction` | `crm:interactions:write` | `idempotencyKey`, `interaction` |
| `crm_set_interaction_result` | `crm:interactions:write` | `idempotencyKey`, `interactionId`, `result` |
| `crm_create_follow_up` | `crm:followups:write` | `idempotencyKey`, `followUp` |
| `crm_create_referral` | `crm:referrals:write` | `idempotencyKey`, `referral` |
| `crm_upsert_digital_analysis` | `crm:analysis:write` | `idempotencyKey`, `leadId`, `analysis` |
| `crm_create_prospecting_batch` | `crm:prospecting:write` | `idempotencyKey`, `batch` |
| `crm_add_prospecting_candidate` | `crm:prospecting:write` | `idempotencyKey`, `candidate` com evidências |
| `crm_update_prospecting_candidate` | `crm:prospecting:write` | `idempotencyKey`, `candidateId`, `patch` |
| `crm_promote_prospecting_candidate` | `crm:prospecting:write` | `idempotencyKey`, `candidateId` |

Os dois scopes de prospecção não são acrescentados a autorizações antigas. Depois da implantação, o consumidor precisa iniciar um novo consentimento OAuth para recebê-los. As ferramentas organizam pesquisa pública e não enviam WhatsApp, e-mail ou qualquer mensagem.

As anotações MCP marcam leituras como `readOnly`, e as escritas atuais como não destrutivas, idempotentes e sem acesso aberto à internet. Essas anotações são dicas ao cliente; o servidor sempre aplica a autorização de forma determinística.

## Idempotência, concorrência e atomicidade

Toda escrita exige uma chave de 8 a 128 caracteres (`A-Z`, `a-z`, números, `.`, `_`, `:`, `-`). No MCP ela é `idempotencyKey`; na API HTTP é o header `Idempotency-Key`.

- Repetir a mesma operação, ator, chave e payload retorna o resultado já gravado com `idempotentReplay=true`.
- Reutilizar a chave com outro payload ou operação retorna `AGENT_IDEMPOTENCY_CONFLICT`.
- Registros de idempotência expiram após 90 dias.
- Atualizações exigem `expectedUpdatedAt` ISO 8601 retornado pela leitura anterior.
- Uma versão obsoleta retorna `AGENT_VERSION_CONFLICT`; o agente deve reler, reconciliar e usar uma nova chave.
- Mutação, histórico/atividade, efeitos relacionados e conclusão da idempotência são enviados em lote transacional ao banco.

Registrar contato ou resultado com `nextAction` e `nextActionAt` cria o follow-up relacionado atomicamente. Alterar análise digital recalcula o score no servidor. Mover oportunidade registra o histórico do pipeline.

## Operações sensíveis

Não existem ferramentas MCP nem endpoints de agente para:

- exclusão ou restauração;
- pagamentos, cobranças ou dados financeiros mutáveis;
- usuários, sessões, permissões ou credenciais;
- configurações críticas e regras administrativas;
- importação, exportação ou alteração em massa;
- acesso SQL, schema ou segredos.

Essas operações continuam exclusivamente na interface administrativa. Se alguma delas for adicionada no futuro, deve usar scope separado, confirmação explícita do usuário no host OpenAI e `require_approval: always`; não deve reutilizar os scopes operacionais existentes.

## Auditoria e proteção

Cada chamada registra request ID, protocolo (`mcp` ou `http`), identidade, integração/cliente, ferramenta/rota, scope, status e duração. Escritas registram entidade, ID e resumo antes/depois. Tokens completos, senhas e `DATABASE_URL` nunca são auditados.

Há rate limit pré-autenticação por origem e pós-autenticação por integração/cliente. Erros de autenticação, audience, scope, validação, concorrência, idempotência e limite possuem códigos distintos.

## Conectar no Codex / ChatGPT desktop

Pela interface:

1. Abra **Settings > MCP servers > Add server**.
2. Nome: `controle-clientes`.
3. Tipo: **Streamable HTTP**.
4. URL: `https://clientes.gabrielmisao.com.br/mcp`.
5. Salve e reinicie o cliente.
6. Clique em **Authenticate**, entre com `gabriel.misao08@gmail.com`, revise os scopes e autorize.
7. Use `/mcp` para conferir o servidor e as 17 ferramentas.

Pelo Codex CLI:

```bash
codex mcp add controle-clientes --url https://clientes.gabrielmisao.com.br/mcp
codex mcp login controle-clientes
codex mcp list
```

Se a versão instalada não aceitar `--url`, adicione ao `config.toml` compartilhado pelo host:

```toml
[mcp_servers.controle-clientes]
url = "https://clientes.gabrielmisao.com.br/mcp"
auth = "oauth"
```

O ChatGPT web usa plugins MCP instalados no workspace; ele não lê o `config.toml` local. Para uso pessoal imediato, use o ChatGPT desktop/Codex. Para distribuir no ChatGPT web, empacote e instale um plugin privado com esse MCP remoto.

## Roteiro de aceite

1. Verifique os três endpoints de descoberta e o `401` com challenge em `/mcp`.
2. Conecte com OAuth e confirme que somente a conta administrativa entra.
3. Liste as 17 ferramentas e confira seus schemas.
4. Execute uma pesquisa de lead e as demais sete leituras.
5. Crie um lead de teste com uma chave única.
6. Repita a mesma chamada e confirme `idempotentReplay=true` sem duplicação.
7. Reutilize a chave com payload diferente e confirme o conflito.
8. Atualize o lead com a versão atual e tente novamente com a versão antiga.
9. Valide contato, resultado, follow-up, indicação, pipeline e análise/score.
10. Confirme os eventos em `agent_audit_logs`.
11. Remova os registros de aceite pela interface administrativa.

Validação técnica local:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run db:verify
npm run agent:test-writes
```

`agent:test-writes` cria um conjunto isolado de QA diretamente pelos serviços, cobre replay/conflito/concorrência e remove tudo em `finally`. Não execute dois testes desse script com o mesmo identificador.

## Migração e rollback

As migrations `0006_melodic_tag.sql`, `0007_silly_vengeance.sql` e `0008_small_stingray.sql` são aditivas. Elas introduzem o provedor OAuth, ajustam a compatibilidade da conta e adicionam idempotência/versão de contatos. Não removem dados comerciais.

Em incidente:

1. revogue tokens/consentimentos OAuth no provedor;
2. remova ou desative o servidor MCP no cliente;
3. faça rollback do deploy para o checkpoint somente leitura;
4. preserve tabelas de auditoria e idempotência para investigação;
5. mantenha a integração opaca `codex-readonly` somente enquanto for necessária e nunca copie seu segredo para código ou documentação.

O fallback opaco só deve ser removido depois de OAuth validado ponta a ponta, consumidor migrado, tokens antigos revogados e período de observação sem dependências.

## Referências normativas

- OpenAI — autenticação de plugins MCP: <https://developers.openai.com/plugins/build/auth>
- OpenAI — MCP e Connectors na Responses API: <https://developers.openai.com/api/docs/guides/tools-connectors-mcp>
- OpenAI — configuração MCP do Codex: <https://developers.openai.com/codex/mcp>
- MCP — especificação atual: <https://modelcontextprotocol.io/specification/2026-07-28>
- Better Auth — plugin MCP: <https://better-auth.com/docs/plugins/mcp>
- Better Auth — OAuth Provider: <https://better-auth.com/docs/plugins/oauth-provider>
