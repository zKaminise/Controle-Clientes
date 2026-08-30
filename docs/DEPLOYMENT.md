# Deploy na Vercel com Neon

## 1. Neon

1. Crie um projeto PostgreSQL na região mais próxima dos usuários.
2. Mantenha a branch padrão para Production.
3. Crie uma branch separada para desenvolvimento e outra estratégia para Preview.
4. Copie a connection string pooled de cada ambiente.
5. Defina a string local em `.env.local` e execute `npm run db:migrate`.
6. Execute `npm run create-admin` com as variáveis temporárias.

Uma Neon API Key não é necessária: a aplicação usa apenas `DATABASE_URL`.

## 2. GitHub e Vercel

1. Na Vercel, escolha Add New Project e importe `zKaminise/Controle-Clientes`.
2. Confirme Framework Preset `Next.js`, diretório raiz do repositório e comandos padrão.
3. Cadastre as variáveis abaixo nos escopos corretos.
4. Faça deploy primeiro no domínio `*.vercel.app`.
5. Confira Build Logs, Function Logs e Cron Jobs.
6. Execute o smoke test completo antes de conectar domínio próprio.

## 3. Variáveis por ambiente

| Variável | Development | Preview | Production |
|---|---|---|---|
| `DATABASE_URL` | branch dev | branch preview | branch production |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL do preview | URL canônica |
| `APP_TIMEZONE` | `America/Sao_Paulo` | igual | igual |
| `BETTER_AUTH_SECRET` | secret local | secret exclusivo | secret exclusivo |
| `BETTER_AUTH_URL` | URL local | URL do preview | URL canônica |
| `CRON_SECRET` | secret local | secret preview | secret production |
| `RESEND_*` | opcional/teste | opcional/teste | remetente verificado |

Não exponha secrets com `NEXT_PUBLIC_`. Não use o banco de Production em Preview.

## 4. Migrations e administrador

Antes do primeiro tráfego de cada banco:

```bash
npm run db:migrate
npm run create-admin
```

O bootstrap pode ser executado localmente apontando temporariamente `DATABASE_URL` para o banco desejado. Remova `ADMIN_EMAIL` e `ADMIN_INITIAL_PASSWORD` logo após a criação e altere a senha pela aplicação.

## 5. Cron

`vercel.json` agenda a rota diariamente às 09:15 UTC (06:15 em São Paulo enquanto UTC−3). A Vercel envia `CRON_SECRET` como Bearer token. Após deploy, valide no painel e nos registros de `automation_runs`.

## 6. Resend

No painel do Resend, adicione o domínio que será usado para envio. Copie exatamente os registros DNS apresentados pelo painel, aguarde verificação, crie uma API Key restrita ao envio e configure um endereço `From` dentro do domínio verificado. Não invente registros DNS nem use uma chave no repositório.

## 7. Domínio final

Após validar a URL da Vercel:

1. Adicione `clientes.gabrielmisao.com.br` em Project → Settings → Domains.
2. Copie os registros DNS que a Vercel mostrar naquele momento.
3. Configure-os no provedor DNS.
4. Aguarde a confirmação e o certificado HTTPS.
5. Atualize `NEXT_PUBLIC_APP_URL` e `BETTER_AUTH_URL` para `https://clientes.gabrielmisao.com.br`.
6. Faça redeploy e repita auth, cron e e-mail.

O DNS não foi alterado durante a migração.

## 8. Rollback

- Código: reverta para um commit conhecido do GitHub e redeploy.
- Banco: restaure uma branch/restore point Neon compatível com o código.
- Legado: `sites-legacy` existe apenas como rollback temporário; não é a produção nova.
