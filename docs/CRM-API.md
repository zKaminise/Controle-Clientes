# API privada do CRM

Todas as rotas abaixo exigem uma sessão válida do administrador. Elas não aceitam acesso anônimo nem chaves públicas. Respostas de erro usam `{ "error": "mensagem" }`.

Estes contratos são os usados pelo frontend e permanecem separados da API externa de agentes descrita em [AGENT-API.md](./AGENT-API.md). O cookie administrativo nunca autentica `/api/agent/v1`.

## Leads

### `GET /api/crm/leads`

Lista leads com paginação e filtros combináveis.

Parâmetros opcionais: `query`, `industry`, `city`, `state`, `lifecycleStatus`, `prospectingStatus`, `siteStatus`, `priority`, `contactedBefore`, `noAction`, `proposalPending`, `page` e `pageSize` (máximo 100).

Exemplos:

- Odontologistas sem site: `?industry=odontologia&siteStatus=SEM_SITE`
- Alta prioridade: `?priority=ALTA`
- Sem ação: `?noAction=true`
- Propostas ainda abertas: `?proposalPending=true`

### `POST /api/crm/leads`

Cria empresa/lead e, opcionalmente, a análise digital no mesmo caso de uso.

```json
{
  "company": {
    "name": "Empresa Exemplo",
    "lifecycleStatus": "lead",
    "prospectingStatus": "NOVO_LEAD"
  },
  "digitalAnalysis": {
    "hasSite": false,
    "siteStatus": "SEM_SITE",
    "priority": "ALTA"
  }
}
```

### `GET /api/crm/leads/:id`

Retorna empresa, análise digital, contatos realizados, follow-ups, oportunidades, indicações e histórico do pipeline.

### `PATCH /api/crm/leads/:id`

Atualiza `company`, `digitalAnalysis` ou ambos. A pontuação é recalculada no servidor.

## Contatos e follow-ups

### `POST /api/crm/interactions`

Registra um contato individual com empresa, canal, data, mensagem, resultado, observação e próxima ação. Quando há próxima ação e data, o sistema cria o follow-up correspondente.

### `GET /api/crm/follow-ups`

Retorna quatro grupos: `overdue`, `today`, `upcoming` e `leadsWithoutAction`.

### `POST /api/crm/follow-ups`

Cria um follow-up usando o contrato de tarefa: empresa, título, tipo, motivo, prioridade, vencimento, lembrete e descrição.

## Pipeline

### Dois conceitos de etapa

`company.prospectingStatus` é a situação operacional da empresa na cadência de prospecção. `opportunity.pipelineStageId` é a posição de uma oportunidade específica no funil configurável. Uma empresa pode não ter oportunidade ou pode ter várias; portanto, esses campos são independentes e não devem ser tratados como aliases.

### `GET /api/crm/pipeline`

Retorna etapas configuradas, oportunidades e histórico de mudanças.

### `PATCH /api/crm/pipeline`

Move uma oportunidade e registra a mudança.

```json
{
  "id": "uuid-da-oportunidade",
  "pipelineStageId": "uuid-da-etapa",
  "lostReason": null
}
```

## Importação

### `POST /api/import/companies`

Fluxo em duas chamadas:

1. `confirm: false` devolve cabeçalhos, mapeamento sugerido, prévia, erros e duplicidades.
2. `confirm: true` executa com `duplicateAction` igual a `reject`, `ignore` ou `update`.

Duplicidades são verificadas por telefone/WhatsApp, e-mail, domínio normalizado e nome + cidade. O lote aceita até 2.000 linhas e nunca cria duplicados silenciosamente.

## Regras de segurança

- `requireUser()` valida a sessão em todas as rotas.
- O servidor substitui qualquer `ownerUserId` recebido pelo ID autenticado.
- Empresas relacionadas são conferidas contra o proprietário autenticado.
- Pagamentos não fazem parte do CRUD genérico; somente `markPaid` registra pagamento e quitação.
- Pontuação e datas de conversão são calculadas no servidor.
