# Relatório final — CRM de prospecção

Data: 08/09/2026  
Branch: `feat/crm-prospeccao`

## 1. Situação anterior

O sistema já possuía autenticação privada, empresas, contatos, projetos, infraestrutura, recorrências, cobranças, pagamentos, tarefas, propostas, reuniões, comunicação, automações, exportação e uma visão 360º. Lint, tipos, testes e build estavam aprovados.

O diagnóstico completo está em [CRM-AUDIT.md](./CRM-AUDIT.md). Os principais limites eram análise digital inexistente, ausência de lead score, pipeline curto, importador rígido, filtros básicos, indicações incompletas e API genérica demais.

## 2. Correções realizadas

- Pagamentos foram removidos do CRUD genérico; uma cobrança só é quitada pelo fluxo que cria o pagamento e calcula o saldo.
- Edição genérica de cobranças não aceita marcar “paga” sem recebimento.
- Arquivar e restaurar agora registra a empresa na atividade/timeline.
- Vínculos com empresas são validados pelo proprietário autenticado.
- A unicidade de empresa passou de `proprietário + nome` para `proprietário + nome + cidade`, permitindo homônimos reais.
- O comando de migração agora usa o driver HTTP do projeto e imprime confirmação verificável. O CLI anterior podia encerrar sem aplicar as novas migrations.

## 3. Funcionalidades criadas

### Empresas e prospecção

- Nome fantasia, Instagram, contato responsável, URL da origem e etapa de prospecção.
- Lifecycle: lead, prospect, cliente, ex-cliente e parceiro.
- 21 estados comerciais sugeridos no briefing, com alteração rápida na grade.
- Nova área **Prospecção**, com busca e filtros combináveis por segmento, local, situação do site, prioridade, etapa, inatividade, contato futuro e propostas abertas.

### Análise digital e lead score

- Análise de site, qualidade geral, mobile, velocidade, design, proposta, CTA, WhatsApp, SEO, HTTPS, links quebrados e presença digital.
- Problemas e oportunidades em campos separados.
- Score de 0 a 100 e níveis Baixa, Média, Alta e Muito alta.
- Nove regras padrão configuráveis em Configurações.
- Recalculo automático ao alterar análise, telefone/e-mail da empresa ou regras.
- Pontuação manual opcional para dados importados ou avaliação excepcional.

### Histórico, follow-up e indicação

- Contato individual com data, canal, responsável, mensagem, resultado e observação.
- Instagram adicionado aos canais.
- Próxima ação pode gerar follow-up automaticamente.
- Tarefas ganharam motivo, lembrete e responsável.
- **Minha atenção** separa atrasados, hoje, futuros e leads sem ação.
- Indicações registram quem indicou, empresa indicada, status e conversão.
- Movimentações de oportunidades recebem histórico próprio e aparecem na visão 360º.

### Dashboard

Além das métricas financeiras existentes, o dashboard agora mostra novos leads, contatos realizados, sem resposta, interessados, reuniões, propostas, negociações, fechamentos, conversão e receita de projetos. Os valores são calculados dos dados reais.

## 4. Banco e migrations

Novas tabelas:

- `digital_analyses`
- `lead_score_rules`
- `pipeline_history`
- `referrals`

Novas colunas foram adicionadas a `companies`, `interactions` e `tasks`. As migrations `0001` a `0004` são incrementais; não apagam clientes, projetos, cobranças nem histórico.

Aplicação em produção validada em 08/09/2026:

- 35 tabelas
- 77 chaves estrangeiras
- 284 checks
- 94 índices
- 9 regras de lead score
- os 5 clientes, 5 projetos, 1 assinatura e 1 cobrança existentes foram preservados

## 5. Importação

O importador CSV agora possui:

1. leitura e mapeamento automático das colunas;
2. ajuste manual do mapeamento;
3. revalidação;
4. prévia das primeiras 100 linhas e validação de todo o lote;
5. erros por linha;
6. detecção por telefone/WhatsApp, e-mail, domínio ou nome + cidade;
7. escolha entre parar, ignorar ou atualizar duplicados;
8. confirmação explícita e resumo de criados, atualizados e ignorados;
9. limite de 2.000 linhas por lote.

CSV UTF-8 é o formato oficial. XLSX ficou como melhoria opcional porque a stack não tinha parser de planilhas; Excel e Google Sheets exportam CSV sem introduzir uma dependência pesada ou ampliar a superfície de segurança.

## 6. APIs

Foram criadas rotas autenticadas para listar/criar/atualizar leads, registrar contatos, consultar/criar follow-ups e consultar/mover o pipeline. Contratos e exemplos estão em [CRM-API.md](./CRM-API.md).

## 7. Validações executadas

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm test`: 24 testes aprovados.
- `npm run build`: aprovado com Next.js 16.3.3.
- `npm audit --audit-level=high`: zero vulnerabilidades antes da implementação; nenhuma dependência foi adicionada.
- Smoke test de leitura: 5 empresas, 9 regras de score e consultas do CRM aprovadas.
- Rotas privadas sem sessão: respostas `401` confirmadas.
- Migração executada duas vezes: segunda execução idempotente.

## 8. Configuração externa

Nenhuma variável nova foi criada. Permanecem necessárias as já documentadas: banco, Better Auth, URL pública e `CRON_SECRET`; Resend continua opcional até o envio de e-mails. Confirme no painel da Vercel que as variáveis existem para Production.

## 9. Como testar

O roteiro funcional curto está em [CRM-GUIDE.md](./CRM-GUIDE.md). Para validação técnica local:

```bash
npm install
npm run db:migrate
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Para verificar o ambiente conectado:

```bash
npm run db:verify
npm run crm:smoke
```

Carregue as variáveis do ambiente antes desses dois comandos.

## 10. Publicação e commits

Fluxo seguro: aplicar migrations, enviar a branch, integrar em `main`, aguardar a Vercel e fazer smoke test autenticado no domínio.

Commits principais:

- `46512a1` — auditoria inicial
- `8fba26b` — modelo de dados do CRM
- `0c67d81` — serviços e APIs autenticadas
- `ded1cee` — interface de prospecção e importador
- `88767ba` — documentação operacional
- `4156d29` — migração Neon verificável e smoke test

## 11. Pendências conhecidas

- Importação XLSX nativa é opcional; CSV cobre o fluxo atual.
- O componente legado `operations-app.tsx` ainda concentra páginas antigas; a nova área de prospecção e o importador já foram separados, mas uma refatoração total deve ser gradual.
- As grades antigas ainda carregam o conjunto operacional completo; a nova API de leads já possui paginação, mas as telas legadas podem precisar migrar para ela quando o volume crescer.
- Testes de navegador automatizados não foram adicionados porque o projeto ainda não possui Playwright; o roteiro manual cobre a primeira publicação.

## 12. API de agentes — fase 1

Em 08/09/2026 foi adicionada uma superfície versionada e somente leitura em `/api/agent/v1`, sem alterar nem substituir as APIs de sessão usadas pelo frontend.

- autenticação Bearer separada do Better Auth, com hash de token, expiração, revogação, audience, scopes e bloqueio pela conta administrativa autorizada;
- rate limit atômico por IP antes da autenticação e por integração após a autenticação;
- auditoria com request ID, identidade, scope, rota, status e duração, sem persistir o token completo;
- oito consultas específicas para leads, etapas, follow-ups, score, Minha Atenção e métricas;
- filtros estritos, paginação no banco e timezone `America/Sao_Paulo` nas fronteiras operacionais;
- transações em lote nos efeitos relacionados de contato/follow-up, mudança de etapa e conclusão de tarefa;
- testes de contrato das principais APIs atuais para impedir mudanças silenciosas no frontend.

A migration incremental `0005_worthless_jigsaw.sql` adiciona apenas quatro tabelas internas da integração. Após a aplicação, as contagens comerciais anteriores e posteriores permaneceram idênticas. Arquitetura, uso, contratos e limitações estão em [AGENT-API.md](./AGENT-API.md).

## 13. Primeiro consumidor real — fase 2

Em 09/09/2026 foi ativada a integração `codex-readonly`, com audience exclusiva da API em produção, cinco scopes somente leitura, expiração de 60 dias e limite de 60 requisições por minuto. O token completo foi entregue somente pelo clipboard local e permanece armazenado no banco apenas como hash.

Um consumidor HTTP independente validou em produção pesquisa e detalhe de leads, etapa de prospecção, score, follow-ups, Minha Atenção e métricas comerciais. Testes negativos confirmaram 401 sem token, token inválido, expirado ou revogado; 403 para audience e scope incorretos; 429 após quatro chamadas em uma credencial descartável limitada a três por minuto; e 405 para tentativa de escrita.

Também foram adicionados comandos administrativos para listar integrações sem segredos, revogar uma integração ou token individual e repetir os testes. Nenhum endpoint de escrita, OAuth ou MCP foi introduzido.
