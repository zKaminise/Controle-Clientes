import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { agentAccessTokens, agentIntegrations, users } from '@/db/schema';
import { allowedAgentAdminEmail } from '@/lib/agent-auth';

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const clientId = argument('client-id')?.trim();
if (!clientId) throw new Error('Informe --client-id.');

const adminEmail = allowedAgentAdminEmail();
const [integration] = await db
  .select({
    id: agentIntegrations.id,
    clientId: agentIntegrations.clientId,
  })
  .from(agentIntegrations)
  .innerJoin(users, eq(agentIntegrations.ownerUserId, users.id))
  .where(
    and(
      eq(agentIntegrations.clientId, clientId),
      sql`lower(${users.email}) = ${adminEmail}`,
    ),
  )
  .limit(1);
if (!integration) throw new Error('Integração autorizada não encontrada.');

const now = new Date();
await db.batch([
  db
    .update(agentIntegrations)
    .set({ status: 'revoked', revokedAt: now, updatedAt: now })
    .where(eq(agentIntegrations.id, integration.id)),
  db
    .update(agentAccessTokens)
    .set({ revokedAt: now })
    .where(eq(agentAccessTokens.integrationId, integration.id)),
]);

console.log(
  JSON.stringify(
    { clientId: integration.clientId, revokedAt: now.toISOString() },
    null,
    2,
  ),
);
