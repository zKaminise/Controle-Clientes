import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl)
  throw new Error('Defina DATABASE_URL antes de verificar o banco.');

const expectedTables = [
  'accounts',
  'activities',
  'automation_runs',
  'charges',
  'companies',
  'company_tags',
  'contacts',
  'digital_analyses',
  'domains',
  'email_services',
  'hosting_services',
  'interactions',
  'lead_score_rules',
  'meetings',
  'message_logs',
  'message_templates',
  'notifications',
  'opportunities',
  'payments',
  'pipeline_history',
  'pipeline_stages',
  'project_technologies',
  'projects',
  'proposals',
  'rate_limits',
  'referrals',
  'services',
  'sessions',
  'settings',
  'subscriptions',
  'tags',
  'tasks',
  'technologies',
  'users',
  'verifications',
] as const;

const commercialTables = [
  'companies',
  'contacts',
  'opportunities',
  'projects',
  'domains',
  'hosting_services',
  'email_services',
  'subscriptions',
  'charges',
  'payments',
  'proposals',
  'meetings',
  'tasks',
  'interactions',
  'digital_analyses',
  'pipeline_history',
  'referrals',
  'message_logs',
  'notifications',
  'activities',
] as const;

const sql = neon(databaseUrl);

const tableRows = await sql`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`;
const actualTables = tableRows.map((row) => String(row.table_name));
const missingTables = expectedTables.filter(
  (table) => !actualTables.includes(table),
);
const unexpectedTables = actualTables.filter(
  (table) => !expectedTables.includes(table as (typeof expectedTables)[number]),
);

const constraintRows = await sql`
  select constraint_type, count(*)::int as total
  from information_schema.table_constraints
  where table_schema = 'public'
  group by constraint_type
  order by constraint_type
`;
const constraintCounts = Object.fromEntries(
  constraintRows.map((row) => [String(row.constraint_type), Number(row.total)]),
);

const indexRows = await sql`
  select count(*)::int as total
  from pg_indexes
  where schemaname = 'public'
`;

const invalidMoneyRows = await sql`
  select table_name, column_name, data_type, numeric_precision, numeric_scale
  from information_schema.columns
  where table_schema = 'public'
    and column_name in ('amount', 'default_amount', 'subtotal', 'discount', 'final_amount')
    and (data_type <> 'numeric' or numeric_precision <> 12 or numeric_scale <> 2)
  order by table_name, column_name
`;

const countRows = await Promise.all(
  [
    ...commercialTables,
    'users',
    'pipeline_stages',
    'lead_score_rules',
    'message_templates',
    'settings',
  ].map(async (table) => {
    if (!actualTables.includes(table)) return [table, null] as const;
    const result = await sql.query(
      `select count(*)::int as total from \"${table}\"`,
      [],
    );
    return [table, Number(result[0]?.total ?? 0)] as const;
  }),
);

const report = {
  schema: {
    expectedTableCount: expectedTables.length,
    actualTableCount: actualTables.length,
    missingTables,
    unexpectedTables,
    constraints: constraintCounts,
    indexes: Number(indexRows[0]?.total ?? 0),
    invalidMoneyColumns: invalidMoneyRows,
  },
  counts: Object.fromEntries(countRows),
};

console.log(JSON.stringify(report, null, 2));

if (
  missingTables.length ||
  unexpectedTables.length ||
  invalidMoneyRows.length
) {
  process.exitCode = 1;
}
