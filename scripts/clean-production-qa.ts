import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

const input = z
  .object({
    DATABASE_URL: z.string().trim().url(),
    QA_OWNER_EMAIL: z.string().trim().email(),
    QA_RUN_ID: z.string().uuid(),
    QA_AUTOMATION_RUN_ID: z.string().uuid().optional(),
    QA_AUTOMATION_RUN_IDS: z.string().trim().optional(),
    QA_MESSAGE_LOG_ID: z.string().uuid().optional(),
    QA_MESSAGE_LOG_IDS: z.string().trim().optional(),
    QA_CSV_COMPANY_NAME: z.string().trim().optional(),
    CLEAN_QA_CONFIRM: z.literal('DELETE_ONLY_MARKED_QA_DATA'),
  })
  .parse(process.env);

function exactIds(single: string | undefined, list: string | undefined) {
  return z
    .array(z.string().uuid())
    .max(20)
    .parse([
      ...new Set([
        ...(single ? [single] : []),
        ...(list
          ? list
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : []),
      ]),
    ]);
}

const automationRunIds = exactIds(
  input.QA_AUTOMATION_RUN_ID,
  input.QA_AUTOMATION_RUN_IDS,
);
const messageLogIds = exactIds(
  input.QA_MESSAGE_LOG_ID,
  input.QA_MESSAGE_LOG_IDS,
);

const sql = neon(input.DATABASE_URL);
const marker = `__QA__:${input.QA_RUN_ID}`;
const csvCompanyName = `${marker}:CSV`;
if (input.QA_CSV_COMPANY_NAME && input.QA_CSV_COMPANY_NAME !== csvCompanyName) {
  throw new Error(
    'A limpeza foi recusada: QA_CSV_COMPANY_NAME não corresponde ao run informado.',
  );
}

const owners = await sql`
  select id from users where lower(email) = lower(${input.QA_OWNER_EMAIL}) limit 2
`;
if (owners.length !== 1) {
  throw new Error(
    'A limpeza foi recusada: QA_OWNER_EMAIL não identifica exatamente um usuário.',
  );
}

const ownerUserId = String(owners[0].id);
const markedCompanies = await sql`
  select id from companies
  where owner_user_id = ${ownerUserId}::uuid and name = ${marker}
`;
if (markedCompanies.length !== 1) {
  throw new Error(
    'A limpeza foi recusada: o marcador QA não identifica exatamente uma empresa.',
  );
}

if (input.QA_CSV_COMPANY_NAME) {
  const csvCompanies = await sql`
    select id from companies
    where owner_user_id = ${ownerUserId}::uuid and name = ${csvCompanyName}
  `;
  if (csvCompanies.length !== 1) {
    throw new Error(
      'A limpeza foi recusada: a empresa QA de importação não foi encontrada exatamente uma vez.',
    );
  }
}

await sql.transaction((tx) => [
  tx`create temporary table qa_company_ids on commit drop as
    select id from companies
    where owner_user_id = ${ownerUserId}::uuid and (
      name = ${marker} or
      (${input.QA_CSV_COMPANY_NAME ?? null}::text is not null and name = ${csvCompanyName})
    )`,
  tx`delete from notifications where user_id = ${ownerUserId}::uuid and (
    (entity_type = 'company' and entity_id in (select id from qa_company_ids)) or
    (entity_type = 'domain' and entity_id in (select id from domains where company_id in (select id from qa_company_ids))) or
    (entity_type = 'charge' and entity_id in (select id from charges where company_id in (select id from qa_company_ids))) or
    (entity_type = 'opportunity' and entity_id in (select id from opportunities where company_id in (select id from qa_company_ids))) or
    (entity_type = 'meeting' and entity_id in (select id from meetings where company_id in (select id from qa_company_ids)))
  )`,
  tx`delete from message_logs where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  ...messageLogIds.map(
    (id) =>
      tx`delete from message_logs where owner_user_id = ${ownerUserId}::uuid and id = ${id}::uuid`,
  ),
  tx`delete from activities where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from tasks where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from payments where owner_user_id = ${ownerUserId}::uuid and charge_id in (select id from charges where company_id in (select id from qa_company_ids))`,
  tx`delete from charges where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from subscriptions where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from proposals where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from meetings where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from interactions where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from opportunities where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from project_technologies where project_id in (select id from projects where company_id in (select id from qa_company_ids))`,
  tx`delete from domains where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from hosting_services where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from email_services where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from projects where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from contacts where owner_user_id = ${ownerUserId}::uuid and company_id in (select id from qa_company_ids)`,
  tx`delete from company_tags where company_id in (select id from qa_company_ids)`,
  tx`delete from companies where owner_user_id = ${ownerUserId}::uuid and id in (select id from qa_company_ids)`,
  ...automationRunIds.map(
    (id) => tx`delete from automation_runs where id = ${id}::uuid`,
  ),
]);

console.log('Limpeza QA concluída para o marcador e os IDs exatos informados.');
