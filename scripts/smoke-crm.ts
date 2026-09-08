import { db } from '@/db';
import { users } from '@/db/schema';
import { getAppData } from '@/lib/app-service';
import { getTodayFollowUps, listLeads } from '@/lib/crm-service';

if (!process.env.DATABASE_URL)
  throw new Error('Defina DATABASE_URL antes do smoke test.');
const [user] = await db.select({ id: users.id }).from(users).limit(1);
if (!user) throw new Error('Nenhum administrador encontrado.');

const [data, leads, followUps] = await Promise.all([
  getAppData(user.id),
  listLeads(user.id, { pageSize: 1 }),
  getTodayFollowUps(user.id),
]);

console.log(
  JSON.stringify(
    {
      appData: {
        companies: data.companies.length,
        digitalAnalyses: data.digitalAnalyses.length,
        referrals: data.referrals.length,
        leadScoreRules: data.leadScoreRules.length,
      },
      leadSearchTotal: leads.pagination.total,
      attention: {
        overdue: followUps.overdue.length,
        today: followUps.today.length,
        upcoming: followUps.upcoming.length,
        leadsWithoutAction: followUps.leadsWithoutAction.length,
      },
    },
    null,
    2,
  ),
);
