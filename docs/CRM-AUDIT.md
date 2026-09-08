# Auditoria do CRM — Controle de Clientes

Data: 08/09/2026  
Branch de evolução: `feat/crm-prospeccao`

## Resumo executivo

O projeto atual é uma base funcional e segura de operação do cliente, projetos, cobranças recorrentes e cobran operacionais. Ele já resolve bem a operação de uma operação de sites com poucos clientes, mas ainda não oferece a profundidade necessária para prospecção em volume. A evolução deve preservar a tabela `companies`, adicionar entidades complementares e evitar uma reescrita destrutiva.

O banco conectado possui dados reais e deve ser preservado. Na auditoria foram encontrados 5 empresas, 1 contato, 5 projetos, 1 hospedagem, 1 assinatura, 1 cobrança e 14 atividades. Não há oportunidades, pagamentos, propostas, reuniões, tarefas, interações ou notificações cadastradas neste momento.

## Validações executadas

- `npm run dev`: aplicação iniciou em `http://localhost:3000` e `/api/health` respondeu `200` com banco `ok`.
- `npm run lint`: aprovado sem avisos.
- `npm run typecheck`: aprovado.
- `npm test`: 20 testes aprovados.
- `npm run build`: aprovado com Next.js 16.3.3 e Node.js 22.
- `npm audit --audit-level=high`: zero vulnerabilidades conhecidas.
- Neon Production: 31 tabelas, 63 FKs, 239 checks, 31 PKs, 79 índices e nenhum campo monetário inválido.
- Produção: interface autenticada inspecionada no Zen Browser sem modificar registros.

## Funcionalidades existentes

| Estado                                     | Funcionalidade            | Diagnóstico                                                                                                                                              |
| ------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Funcional                               | Autenticação privada      | Better Auth com usuário/senha, sessão no PostgreSQL, cadastro público bloqueado, reset de senha e rate limit.                                            |
| ✅ Funcional                               | Empresas e clientes       | CRUD, soft delete, restauração, lifecycle, relacionamento, saúde, origem, endereço resumido e observações.                                               |
| ✅ Funcional                               | Contatos                  | Múltiplos contatos por empresa, principal único e responsável financeiro.                                                                                |
| ✅ Funcional                               | Visão 360º                | Reúne dados comerciais, projetos, infraestrutura, financeiro, tarefas, interações e timeline.                                                            |
| ✅ Funcional                               | Projetos                  | Cadastro de projetos, status, URLs, datas, valores e vínculo com cliente.                                                                                |
| ✅ Funcional                               | Financeiro                | Assinaturas, cobranças recorrentes, pagamentos parciais, quitação por saldo e MRR.                                                                       |
| ✅ Funcional                               | Domínios e infraestrutura | Domínios, alertas, hospedagem e serviços de e-mail sem armazenar senha.                                                                                  |
| ✅ Funcional                               | Propostas e reuniões      | Cadastro, estados, valores, agenda, resultados e próxima ação.                                                                                           |
| ✅ Funcional                               | Tarefas e alertas         | Agenda, conclusão, adiamento, cancelamento, notificações e prioridades.                                                                                  |
| ✅ Funcional                               | Histórico básico          | Interações individuais e atividades de sistema com data, canal e conteúdo.                                                                               |
| ✅ Funcional                               | Comunicação               | Templates, preview, cópia, Resend e abertura de conversa no WhatsApp.                                                                                    |
| ✅ Funcional                               | Automação diária          | Recorrência, vencimentos, domínios, follow-ups, pós-venda, propostas e reuniões com idempotência.                                                        |
| ✅ Funcional                               | Exportação                | CSV de empresas, contatos, projetos, domínios, cobranças, pagamentos e oportunidades.                                                                    |
| ⚠️ Parcialmente funcional                  | Pipeline                  | É configurável e registra mudanças, ganho e perda, mas o seed atual possui 12 etapas e não cobre todo o funil de prospecção solicitado.                  |
| ⚠️ Parcialmente funcional                  | Follow-up                 | Próximas ações e tarefas existem, porém não há visão específica de leads sem ação nem motivo/responsável/lembrete separados.                             |
| ⚠️ Parcialmente funcional                  | Histórico de contatos     | Há canal, assunto, conteúdo, data e autor, mas resultado e observação não são campos próprios.                                                           |
| ⚠️ Parcialmente funcional                  | Indicações                | `referred_by_company_id` registra quem indicou, porém não existe entidade com status e conversão da indicação.                                           |
| ⚠️ Parcialmente funcional                  | Importação CSV            | Possui preview e bloqueio de duplicidade, mas não mapeia colunas, não permite ignorar/atualizar duplicados e não usa todas as chaves solicitadas.        |
| ⚠️ Parcialmente funcional                  | Busca e filtros           | Busca textual e filtros básicos existem, mas não suportam os recortes avançados de prospecção.                                                           |
| ⚠️ Parcialmente funcional                  | Dashboard e relatórios    | Métricas financeiras e de clientes são reais, mas faltam métricas do funil de prospecção e atividade comercial.                                          |
| ⚠️ Parcialmente funcional                  | Camada de serviços        | `app-service` centraliza regras, mas uma única rota genérica mistura todos os casos de uso e não há contratos de API documentados para automação futura. |
| 🟡 Existe no código mas não está concluída | Tecnologias por projeto   | As tabelas N:N existem, mas a interface não permite gerenciá-las.                                                                                        |
| ❌ Não funcional                           | Análise digital           | Não há entidade nem campos para qualidade, mobile, velocidade, design, CTA, SEO, HTTPS ou problemas do site.                                             |
| ❌ Não funcional                           | Lead score                | Não há pontuação, classificação nem regras configuráveis.                                                                                                |
| ❌ Não funcional                           | Importação XLSX           | Não implementada.                                                                                                                                        |
| ❌ Não funcional                           | Atualização de duplicados | A importação atual recusa toda linha marcada como duplicada.                                                                                             |

## Arquitetura atual

### Frontend

Next.js 16 App Router com React 19 e Tailwind CSS 4. A página autenticada do servidor entrega o usuário para `OperationsApp`, um Client Component que carrega todo o estado por `/api/app`. A interface contém navegação, dashboards, tabelas, cartões e diálogos reutilizando componentes de `components/ui`.

O ponto de atenção é `app/operations-app.tsx`, com mais de 4.300 linhas. Ele concentra tipos, estado, páginas, formulários, filtros e helpers, aumentando o custo de manutenção e teste.

### Backend

Route Handlers autenticados expõem dados, mutações, busca, importação, exportação e e-mail. `lib/app-service.ts` concentra leitura e mutações; `lib/automation-service.ts` processa o cron; `lib/business.ts` contém regras puras testáveis.

### Banco

PostgreSQL no Neon via Drizzle ORM. O modelo possui 31 tabelas, UUIDs, enums, FKs, checks, índices, soft delete e valores monetários em `numeric(12,2)`. `owner_user_id` separa os dados por usuário.

### Autenticação

Better Auth persiste usuários, credenciais, sessões, verificações e rate limits no Neon. APIs privadas chamam `requireUser`; o cron usa um segredo próprio com comparação em tempo constante.

### Deploy

O fluxo atual é `GitHub main → Vercel Production → Neon Production`, com domínio `clientes.gabrielmisao.com.br`. O cron é executado diariamente pela Vercel e o Resend faz o transporte de e-mail.

### Principais entidades

`companies`, `contacts`, `pipeline_stages`, `opportunities`, `projects`, `domains`, `hosting_services`, `email_services`, `services`, `subscriptions`, `charges`, `payments`, `proposals`, `meetings`, `tasks`, `interactions`, `message_templates`, `message_logs`, `notifications`, `tags`, `activities` e `settings`.

### Fluxo de dados

1. A página do servidor valida a sessão.
2. O cliente chama `/api/app` para buscar o conjunto operacional.
3. Formulários enviam mutações para a mesma rota.
4. A rota valida o payload com Zod e chama `app-service`.
5. O serviço aplica regras e usa Drizzle/Neon.
6. Após cada mutação, a interface recarrega todo o conjunto de dados.

## Problemas encontrados

### Bugs e inconsistências

- A importação considera nome igual como duplicidade sem combinar cidade, mas ignora telefone/WhatsApp e domínio normalizado.
- Importações são inseridas linha a linha sem transação; uma falha intermediária pode produzir lote parcial.
- Pagamentos ainda fazem parte do allowlist genérico do servidor, permitindo criar um pagamento sem atualizar corretamente a cobrança caso a API seja chamada diretamente.
- O status `paid` pode ser escolhido ao editar a cobrança, mesmo sem pagamento correspondente.
- Atividades de arquivar/restaurar não recebem `company_id`, então podem não aparecer na timeline da empresa.
- “Clientes ativos” no dashboard conta todo lifecycle `client`, inclusive relacionamento inativo.
- `companies` possui unique por `owner + name`, o que pode impedir empresas reais homônimas.

### Riscos arquiteturais

- Um Client Component monolítico controla praticamente toda a aplicação.
- `/api/app` e `getAppData` carregam coleções inteiras; não há paginação nas grades principais.
- O serviço usa casts de tabela para sustentar CRUD genérico, reduzindo a segurança de tipos.
- Operações compostas importantes não usam transação: interação + follow-up, ganho + conversão e pagamento + atualização de cobrança.
- FKs simples não garantem que todos os IDs relacionados pertençam ao mesmo `owner_user_id`; hoje o único administrador reduz a exposição, mas a regra deve ser validada no serviço.
- Testes cobrem regras puras e CSV, mas não cobrem banco, rotas, componentes ou fluxos ponta a ponta.

### Problemas de UX

- O cadastro de empresa mistura cliente, prospect e próxima ação sem uma seção clara de prospecção.
- Não existe resumo visual “quem é / oportunidade / contato / histórico / próximo passo”.
- Não há filtros combináveis nem busca orientada a perguntas comerciais.
- O preview de importação aparece somente como contagem em toast; não permite revisar ou decidir linha por linha.
- O pipeline horizontal pode ficar extenso ao receber as novas etapas.

### Segurança e operação

- A proteção de sessão e a validação de entrada estão corretas no núcleo.
- Secrets não aparecem no código versionado.
- A rota genérica precisa de regras de autorização por relacionamento, não apenas filtro pelo ID do registro principal.
- O `.env.local` conectado ao Neon Production exige cuidado: testes de mutação não devem ser executados sem marcadores e limpeza controlada.
- A documentação de deploy contém trechos históricos que devem ser atualizados para o estado atual já publicado.

### Código legado e duplicação

- O remote `sites-legacy` e a branch `legacy_bot`/`legacy-sites` são apenas rollback e não participam da aplicação atual.
- Há muitos componentes de UI instalados, mas não usados; isso não afeta o runtime porque o bundler elimina imports ausentes, porém aumenta o inventário do repositório.
- Helpers de formatação e tipos de DTO vivem dentro do componente gigante e devem ser extraídos ao evoluir a aplicação.

## Preparação para o novo CRM

### O que pode ser preservado

- `companies` como registro central de leads e clientes.
- `contacts`, `opportunities`, `interactions`, `tasks` e `activities` como base comercial.
- Pipeline configurável e histórico de atividades.
- Projetos, recorrência, financeiro, domínios e comunicação.
- Better Auth, `owner_user_id`, Zod, Drizzle, Neon e deploy Vercel.
- Automação idempotente e padrões de data/moeda existentes.

### O que precisa ser criado ou ampliado

1. Novos campos de empresa: nome fantasia explícito, Instagram, URL da origem, tipo de relacionamento ampliado e dados de prospecção.
2. Entidade `digital_analyses` para diagnóstico de presença/site e oportunidades.
3. Entidade `pipeline_history` para histórico explícito de status.
4. Campos de resultado/observação/responsável em interações.
5. Entidade de follow-up ou extensão segura de tarefas com motivo, lembrete e responsável.
6. Entidade `referrals` para indicador, indicado, status e conversão.
7. Regras configuráveis e resultados de lead score.
8. Pipeline inicial ampliado sem destruir etapas já existentes.
9. Importador em etapas: upload, mapeamento, preview, duplicidades e ações `ignorar/criar/atualizar`.
10. Filtros avançados de prospecção e dashboard comercial real.
11. APIs autenticadas e orientadas a casos de uso, documentadas para futura automação por IA.
12. Refatoração gradual de `operations-app.tsx` em módulos menores, sem reescrever o que funciona.

## Estratégia de implementação segura

- Criar somente migrations incrementais e aditivas.
- Manter valores padrão/nulos para preservar os cinco clientes atuais.
- Criar índices e constraints antes de depender dos novos campos.
- Migrar os dados existentes para os novos conceitos com defaults conservadores.
- Implementar regras puras e testes antes das telas.
- Bloquear mutações genéricas que contornem regras financeiras/comerciais.
- Aplicar a migration no Neon antes de publicar código que dependa dela.
- Validar lint, tipos, testes, build, banco e smoke test em cada marco.
