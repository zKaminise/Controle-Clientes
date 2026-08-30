# Deploy na Vercel com Neon

## 1. Neon

1. Use o projeto Neon Production já criado.
2. Copie a connection string pooled sem expô-la em logs ou commits.
3. Defina a string somente na Vercel Production e no `.env.local` ignorado usado para operação inicial.
4. Execute `npm run db:migrate`, `npm run db:verify` e depois o bootstrap do admin.

Uma Neon API Key não é necessária: a aplicação usa apenas `DATABASE_URL`.

## 2. GitHub e Vercel

1. Na Vercel, escolha Add New Project e importe `zKaminise/Controle-Clientes`.
2. Confirme Framework Preset `Next.js`, diretório raiz do repositório e comandos padrão.
3. Cadastre as variáveis somente no escopo Production.
4. Faça deploy primeiro no domínio `*.vercel.app`.
5. Confira Build Logs, Function Logs e Cron Jobs.
6. Execute o smoke test completo antes de conectar domínio próprio.

## 3. Variáveis de Production

Use a tabela completa em [PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md). As URLs canônicas são `https://clientes.gabrielmisao.com.br`; `BETTER_AUTH_SECRET` e `CRON_SECRET` devem ser secrets distintos e estáveis. Não exponha secrets com prefixo `NEXT_PUBLIC_`.

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

Em 30/08/2026, o hostname já respondia pela Vercel com HTTPS, porém retornava `DEPLOYMENT_NOT_FOUND`; ele ainda precisa ser vinculado ao projeto/deployment correto.

## 8. Rollback

- Código: reverta para um commit conhecido do GitHub e redeploy.
- Banco: restaure uma branch/restore point Neon compatível com o código.
- Legado: `sites-legacy` existe apenas como rollback temporário; não é a produção nova.
