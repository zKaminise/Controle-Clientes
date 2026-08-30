# Runbook de produção

## Topologia oficial

```text
GitHub main → Vercel Production → clientes.gabrielmisao.com.br → Neon Production
```

Não há banco de Preview, staging, usuário demo ou seed comercial. Deploy não executa seed, limpeza ou recriação do banco automaticamente.

## Variáveis

Configure em **Vercel → Project → Settings → Environment Variables**, somente para Production. Remova espaços e quebras de linha acidentais; URLs devem ser absolutas e sem aspas.

| Variável                 | Valor ou formato                                         |         Manter? | Secret? |
| ------------------------ | -------------------------------------------------------- | --------------: | ------: |
| `DATABASE_URL`           | connection string **pooled** do Neon, `postgresql://...` |             Sim |     Sim |
| `NEXT_PUBLIC_APP_URL`    | `https://clientes.gabrielmisao.com.br`                   |             Sim |     Não |
| `APP_TIMEZONE`           | `America/Sao_Paulo`                                      |             Sim |     Não |
| `BETTER_AUTH_SECRET`     | Base64 de 32 bytes aleatórios ou mais                    |             Sim |     Sim |
| `BETTER_AUTH_URL`        | `https://clientes.gabrielmisao.com.br`                   |             Sim |     Não |
| `CRON_SECRET`            | Base64 de 32 bytes aleatórios, diferente do auth secret  |             Sim |     Sim |
| `RESEND_API_KEY`         | API key de envio do Resend                               | Se e-mail ativo |     Sim |
| `RESEND_FROM_EMAIL`      | endereço completo dentro do domínio verificado           | Se e-mail ativo |     Não |
| `RESEND_FROM_NAME`       | `Gabriel Misao` ou outro nome visível                    |        Opcional |     Não |
| `ADMIN_EMAIL`            | e-mail do administrador                                  |    Só bootstrap |     Não |
| `ADMIN_INITIAL_PASSWORD` | senha inicial entre 12 e 128 caracteres                  |    Só bootstrap |     Sim |

`RESEND_API_KEY` e `RESEND_FROM_EMAIL` devem existir juntas. O remetente é um endereço, não um domínio: se o domínio verificado for `gabrielmisao.com.br`, um formato possível é `no-reply@gabrielmisao.com.br`; se for `no-reply.gabrielmisao.com.br`, use algo como `sistema@no-reply.gabrielmisao.com.br`. Confirme o domínio real no painel do Resend antes de escolher.

Gere cada secret separadamente:

```powershell
[Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
)
```

O equivalente em sistemas Unix é `openssl rand -base64 32`. Não gere secrets automaticamente no deploy e não reutilize um secret em outra finalidade.

## Deploy

1. Faça merge/push do código revisado para `main`.
2. Confirme na Vercel que o projeto está conectado a `zKaminise/Controle-Clientes`, branch Production `main` e Node `22.x`.
3. Cadastre as variáveis acima em Production.
4. Aguarde o deployment ficar `Ready` e valide primeiro a URL `*.vercel.app`.
5. Em **Settings → Domains**, vincule `clientes.gabrielmisao.com.br`. Use somente os registros DNS mostrados pela Vercel.
6. Confirme `Valid Configuration`, certificado HTTPS e ausência de Deployment Protection na URL Production.
7. Refaça o deploy sempre que alterar variáveis usadas no build.

## Migration e schema

Para a primeira implantação e para cada migration futura:

```bash
npm run db:generate
# revisar o SQL gerado
npm run db:migrate
npm run db:verify
```

Em produção, use `generate → revisar SQL → migrate → verify`. Não use `db:push`, não edite uma migration já aplicada e não execute truncate/drop como rotina de deploy.

## Seed e administrador

1. Defina temporariamente `ADMIN_EMAIL` e `ADMIN_INITIAL_PASSWORD` no ambiente que executará o comando.
2. Execute `npm run create-admin`. O comando é idempotente: se o e-mail já existir, não duplica e não altera sua senha.
3. O próprio bootstrap aplica o seed idempotente para esse usuário. `npm run db:seed` pode ser repetido sem duplicar pipeline, templates, configurações ou catálogos.
4. Entre, altere a senha em **Configurações → Alterar senha** e encerre outras sessões.
5. Remova `ADMIN_INITIAL_PASSWORD` e `ADMIN_EMAIL` da Vercel e de qualquer ambiente de bootstrap.

## Health check

`GET /api/health` deve responder `200` com:

```json
{ "status": "ok", "database": "ok" }
```

Em falha, responde `503` sem connection string, secrets ou stack trace no corpo.

## Cron

- Endpoint: `GET /api/cron/automations`.
- Agenda: `15 9 * * *`, ou 09:15 UTC / 06:15 em São Paulo (UTC−3).
- Autenticação: `Authorization: Bearer <CRON_SECRET>`; a Vercel envia esse header quando a variável possui o mesmo valor no Production.
- Auditoria: `automation_runs` registra início, fim, status, total processado e resumo de erro.

Teste manual sem imprimir o secret:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://clientes.gabrielmisao.com.br/api/cron/automations
```

As automações são idempotentes: cobranças usam assinatura/período; tarefas e notificações usam chaves únicas. Remova registros de QA antes do uso real.

Para QA em produção, crie a empresa com o nome exato `__QA__:<UUID do run>`. A limpeza protegida exige `QA_OWNER_EMAIL`, `QA_RUN_ID` e a confirmação literal `CLEAN_QA_CONFIRM=DELETE_ONLY_MARKED_QA_DATA`; IDs exatos podem ser fornecidos individualmente em `QA_AUTOMATION_RUN_ID`/`QA_MESSAGE_LOG_ID` ou, quando houver mais de um, nas listas separadas por vírgula `QA_AUTOMATION_RUN_IDS`/`QA_MESSAGE_LOG_IDS` (máximo de 20 UUIDs por lista). Se o teste de CSV criar uma empresa, ela deve ter o nome exato `__QA__:<UUID do run>:CSV` e esse mesmo valor deve ser informado em `QA_CSV_COMPANY_NAME`. Só então execute `npm run db:clean-qa`. O script recusa marcadores ausentes/ambíguos, valida todos os IDs e nunca faz truncate.

## Resend e reset de senha

1. Confirme o domínio como `Verified` no Resend.
2. Configure API key e remetente completo permitido.
3. No sistema, use **Configurações → Enviar e-mail de teste**. O envio vai somente para o usuário autenticado e gera `message_logs`.
4. Valide **Esqueci minha senha**, recebimento, link em `clientes.gabrielmisao.com.br`, redefinição e revogação das sessões antigas.
5. O remetente ou a API key nunca devem aparecer em código, URL ou log público.

## Backup e restauração

- Exporte semanalmente, pela tela Configurações, CSV de empresas, contatos, projetos, domínios, cobranças, pagamentos e oportunidades.
- Antes de migration relevante, crie um restore point/branch de segurança no Neon conforme os recursos do plano.
- Teste restauração em uma branch isolada do Neon; somente depois promova/restaure produção.
- CSV é portabilidade operacional, não substitui backup completo do PostgreSQL.

## Segurança e dependências

Produção envia `nosniff`, `DENY` para frames, política de referência restrita, Permissions Policy e HSTS. Source maps do navegador ficam desativados. Uma CSP ampla não foi adicionada sem nonce porque uma política incompleta poderia bloquear scripts do Next.js; frame protection já está ativa.

Os avisos `@esbuild-kit/esm-loader` e `@esbuild-kit/core-utils` vêm transitivamente do `drizzle-kit`, usado só em desenvolvimento/migrations. `unrs-resolver` vem do resolver do ESLint. `eslint` 9 é a major compatível com a configuração atual do Next. `esbuild` está fixado por override em versão auditada. Os scripts sinalizados não são aprovados cegamente; lint, typecheck, testes e build devem provar funcionamento. Reavalie ao atualizar Drizzle/Next.

## Troubleshooting

- Build cita `BETTER_AUTH_SECRET`: **Vercel → Settings → Environment Variables → BETTER_AUTH_SECRET**; mínimo 32 caracteres, recomendado Base64 de 32 bytes aleatórios.
- Build cita `CRON_SECRET`: mesmo caminho, outro secret Base64 de 32 bytes.
- Build cita URL: use exatamente `https://clientes.gabrielmisao.com.br`, sem aspas, Markdown ou espaços.
- Build cita `RESEND_FROM_EMAIL`: informe um endereço completo permitido pelo domínio verificado, não o domínio isolado.
- Login retorna erro de origem: confira `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` e o domínio vinculado à Vercel.
- Cron retorna 401: confirme que `CRON_SECRET` existe em Production e refaça o deploy.
- Health retorna 503: confira `DATABASE_URL`, status do Neon e logs da função.
- Domínio retorna `DEPLOYMENT_NOT_FOUND`: vincule o domínio ao projeto/deployment correto em **Vercel → Project → Settings → Domains**.
