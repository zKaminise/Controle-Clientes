import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('Defina DATABASE_URL antes de executar.');
const sql = neon(databaseUrl);
const expectedNames = [
  'Sal e Açúcar Gastronomia',
  'Lucas Perazoli',
  'Saldanha Móveis',
  'Clínica Odontológica FL',
  'Alçar Rioma Gestão e Pessoas LTDA',
] as const;

const rows = await sql`
  select c.id, c.name, c.lifecycle_status, c.relationship_status,
         c.prospecting_status,
         count(distinct p.id)::int as projects,
         count(distinct p.id) filter (where p.status = 'delivered')::int as delivered_projects,
         count(distinct s.id) filter (where s.status = 'active')::int as active_subscriptions,
         coalesce(sum(distinct s.amount) filter (where s.status = 'active'), 0) as active_subscription_amount
  from companies c
  left join projects p on p.company_id = c.id and p.archived_at is null
  left join subscriptions s on s.company_id = c.id
  where c.name = any(${[...expectedNames]}::text[]) and c.archived_at is null
  group by c.id
  order by c.name
`;

const failures: string[] = [];
for (const name of expectedNames) {
  const row = rows.find((item) => String(item.name) === name);
  if (!row) {
    failures.push(`${name}: não encontrado`);
    continue;
  }
  if (row.lifecycle_status !== 'client')
    failures.push(`${name}: não é cliente`);
  if (row.prospecting_status !== 'FECHADO')
    failures.push(`${name}: continua em prospecção`);
  if (Number(row.delivered_projects) < 1)
    failures.push(`${name}: sem projeto entregue`);
  if (name === 'Sal e Açúcar Gastronomia') {
    if (
      Number(row.active_subscriptions) !== 1 ||
      Number(row.active_subscription_amount) !== 50
    )
      failures.push(`${name}: manutenção deve ser única e somar R$ 50,00`);
  } else if (Number(row.active_subscriptions) !== 0) {
    failures.push(`${name}: possui assinatura ativa indevida`);
  }
}

console.log(
  JSON.stringify(
    { ok: failures.length === 0, clients: rows, failures },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
