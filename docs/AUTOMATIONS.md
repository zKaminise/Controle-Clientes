# Automações

## Execução

- Endpoint: `GET /api/cron/automations`.
- Agenda: diária, definida em `vercel.json` como `15 9 * * *` (UTC).
- Segurança: `Authorization: Bearer <CRON_SECRET>` com comparação em tempo constante.
- Auditoria: cada execução cria e finaliza um registro em `automation_runs`.

Teste local com uma credencial fictícia somente no seu ambiente:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/automations
```

## Processamento

1. Gera antecipadamente cobranças de assinaturas ativas até o horizonte de 30 dias.
2. Usa `(subscription_id, billing_period)` para impedir cobranças repetidas.
3. Avança `next_charge_date` pela frequência da assinatura, sem consultar pagamentos anteriores.
4. Muda cobranças agendadas para pendentes no vencimento.
5. Muda pendentes vencidas para atrasadas e cria atenção/notificação.
6. Gera alertas de domínio nos thresholds configurados.
7. Gera tarefas de próxima ação para oportunidades.
8. Gera tarefas de pós-venda para clientes com `next_contact_at`.
9. Sinaliza propostas enviadas/negociadas sem retorno há sete dias.
10. Sinaliza reuniões próximas.

## Idempotência

Tarefas e notificações automáticas têm `idempotency_key` única no PostgreSQL. Domínios usam o formato `domain:{domainId}:{expirationDate}:{threshold}`. Cobranças recorrentes usam constraint composta por assinatura e período. `ON CONFLICT DO NOTHING` complementa — mas não substitui — essas garantias.

## Timezone

O dia operacional é calculado em `America/Sao_Paulo`. Datas de vencimento permanecem como `date`; timestamps de execução, reunião, pagamento e atividade usam timezone.

## Falhas e reprocessamento

Uma execução falha registra mensagem resumida em `automation_runs` sem secrets. Como as saídas são idempotentes, o job pode ser executado novamente. Verifique primeiro o log da função e a conexão com o banco; depois confirme o registro do run e os contadores processados.
