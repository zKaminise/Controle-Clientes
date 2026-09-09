import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('Defina DATABASE_URL antes de executar.');

const apply = process.argv.includes('--apply');
const sql = neon(databaseUrl);

const expected = [
  {
    id: '52816827-38fc-40ba-ba50-22ebde2123ef',
    name: 'Alçar Rioma Gestão e Pessoas LTDA',
    recurring: false,
  },
  {
    id: 'ef11a344-9280-4281-abdd-c1ce1fdfaece',
    name: 'Clínica Odontológica FL',
    recurring: false,
  },
  {
    id: '48fdd768-5fe8-4243-8500-0b95ec207a34',
    name: 'Saldanha Móveis',
    recurring: false,
  },
  {
    id: '52011523-ac82-44c6-81a8-9af8fa6b0e08',
    name: 'Lucas Perazoli',
    recurring: false,
  },
  {
    id: 'eaf3bad9-2097-4a62-be31-beba25b86ba9',
    name: 'Sal e Açúcar Gastronomia',
    recurring: true,
  },
] as const;

const ids = expected.map((item) => item.id);
const companies = await sql`
  select id, owner_user_id, name, lifecycle_status, relationship_status,
         prospecting_status, archived_at
  from companies
  where id = any(${ids}::uuid[])
  order by name
`;
if (companies.length !== expected.length)
  throw new Error(
    `Esperava 5 clientes conhecidos; encontrei ${companies.length}.`,
  );
const owners = new Set(companies.map((row) => String(row.owner_user_id)));
if (owners.size !== 1)
  throw new Error('Os clientes não pertencem ao mesmo administrador.');
if (companies.some((row) => row.archived_at))
  throw new Error(
    'Há cliente conhecido arquivado; revise manualmente antes de aplicar.',
  );

const projects = await sql`
  select id, company_id, name, status, delivery_date, sold_value
  from projects
  where company_id = any(${ids}::uuid[]) and archived_at is null
  order by company_id, created_at
`;
const subscriptions = await sql`
  select id, company_id, description, amount, status, next_charge_date
  from subscriptions
  where company_id = any(${ids}::uuid[])
  order by company_id, created_at
`;
const charges = await sql`
  select id, company_id, description, amount, status, due_date
  from charges
  where company_id = any(${ids}::uuid[]) and archived_at is null
  order by company_id, due_date
`;

const sal = expected.find((item) => item.recurring)!;
const salActiveMaintenance = subscriptions.find(
  (row) =>
    String(row.company_id) === sal.id &&
    String(row.status) === 'active' &&
    Number(row.amount) === 50,
);
const otherIds = expected
  .filter((item) => !item.recurring)
  .map((item) => item.id);
const unexpectedOtherSubscriptions = subscriptions.filter((row) =>
  otherIds.includes(String(row.company_id) as (typeof otherIds)[number]),
);
const unexpectedOtherOpenCharges = charges.filter(
  (row) =>
    otherIds.includes(String(row.company_id) as (typeof otherIds)[number]) &&
    ['scheduled', 'pending', 'overdue'].includes(String(row.status)),
);
if (unexpectedOtherSubscriptions.length || unexpectedOtherOpenCharges.length)
  throw new Error(
    'Um dos quatro clientes sem recorrência possui plano ou cobrança aberta. Nada foi removido; revise manualmente.',
  );

const plan = expected.map((target) => {
  const current = companies.find((row) => String(row.id) === target.id)!;
  const linkedProjects = projects.filter(
    (row) => String(row.company_id) === target.id,
  );
  return {
    id: target.id,
    currentName: current.name,
    targetName: target.name,
    lifecycle: `${current.lifecycle_status} -> client`,
    relationship: `${current.relationship_status} -> ${target.recurring ? 'active_recurring' : 'active_non_recurring'}`,
    prospecting: `${current.prospecting_status} -> FECHADO`,
    projects: linkedProjects.map((project) => ({
      id: project.id,
      name: project.name,
      status: `${project.status} -> delivered`,
    })),
    subscriptions: subscriptions.filter(
      (row) => String(row.company_id) === target.id,
    ),
    openCharges: charges.filter(
      (row) =>
        String(row.company_id) === target.id &&
        ['scheduled', 'pending', 'overdue'].includes(String(row.status)),
    ),
  };
});

console.log(
  JSON.stringify({ mode: apply ? 'apply' : 'dry-run', plan }, null, 2),
);
if (!apply) {
  console.log(
    'Dry-run concluído. Execute novamente com --apply após revisar o plano.',
  );
  process.exit(0);
}

const queries = expected.flatMap((target) => [
  sql`
    update companies
    set name = ${target.name},
        lifecycle_status = 'client',
        relationship_status = ${target.recurring ? 'active_recurring' : 'active_non_recurring'}::relationship_status,
        prospecting_status = 'FECHADO',
        updated_at = now()
    where id = ${target.id}::uuid
  `,
  sql`
    update projects
    set status = 'delivered', updated_at = now()
    where company_id = ${target.id}::uuid and archived_at is null
  `,
  sql`
    insert into activities (owner_user_id, company_id, entity_type, entity_id, action, description, metadata)
    select owner_user_id, id, 'company', id, 'normalized_existing_client',
           'Cliente existente normalizado para a experiência simplificada.',
           jsonb_build_object('source', 'scripts/normalize-existing-clients.ts')
    from companies where id = ${target.id}::uuid
  `,
]);

if (!salActiveMaintenance) {
  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const nextDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 20),
  );
  if (nextDate < today) nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
  queries.push(sql`
    insert into subscriptions (
      owner_user_id, company_id, description, amount, frequency,
      billing_day, start_date, next_charge_date, status
    )
    select owner_user_id, id, 'Manutenção e Hospedagem', 50.00, 'monthly',
           20, ${startDate}::date, ${nextDate.toISOString().slice(0, 10)}::date, 'active'
    from companies where id = ${sal.id}::uuid
  `);
}

await sql.transaction(queries);
console.log(
  'Normalização aplicada de forma transacional. Nenhum histórico foi removido.',
);
