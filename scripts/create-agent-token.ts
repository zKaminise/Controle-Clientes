import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { agentAccessTokens, agentIntegrations, users } from '@/db/schema';
import {
  AGENT_SCOPES,
  agentTokenPrefix,
  allowedAgentAdminEmail,
  expectedAgentAudience,
  generateAgentToken,
  hashAgentToken,
  type AgentScope,
} from '@/lib/agent-auth';

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const name = argument('name')?.trim() || 'ChatGPT/Codex somente leitura';
const expiresInDays = Number(argument('expires-in-days') || 90);
const rateLimitPerMinute = Number(argument('rate-limit') || 60);
const requestedScopes = (argument('scopes') || AGENT_SCOPES.join(','))
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);

if (
  !Number.isInteger(expiresInDays) ||
  expiresInDays < 1 ||
  expiresInDays > 365
)
  throw new Error('--expires-in-days deve estar entre 1 e 365.');
if (
  !Number.isInteger(rateLimitPerMinute) ||
  rateLimitPerMinute < 1 ||
  rateLimitPerMinute > 600
)
  throw new Error('--rate-limit deve estar entre 1 e 600.');
const invalidScopes = requestedScopes.filter(
  (scope) => !AGENT_SCOPES.includes(scope as AgentScope),
);
if (invalidScopes.length)
  throw new Error(`Scopes inválidos: ${invalidScopes.join(', ')}`);

const adminEmail = allowedAgentAdminEmail();
const [owner] = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(sql`lower(${users.email}) = ${adminEmail}`)
  .limit(1);
if (!owner)
  throw new Error(
    `Conta administrativa autorizada não encontrada: ${adminEmail}`,
  );

const integrationId = randomUUID();
const tokenId = randomUUID();
const clientId = `cca_client_${randomBytes(12).toString('hex')}`;
const token = generateAgentToken();
const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);
const audience = expectedAgentAudience();

await db.batch([
  db.insert(agentIntegrations).values({
    id: integrationId,
    ownerUserId: owner.id,
    clientId,
    name,
    audience,
    scopes: requestedScopes,
    rateLimitPerMinute,
  }),
  db.insert(agentAccessTokens).values({
    id: tokenId,
    integrationId,
    tokenPrefix: agentTokenPrefix(token),
    tokenHash: hashAgentToken(token),
    expiresAt,
  }),
]);

console.log(
  JSON.stringify(
    {
      clientId,
      token,
      tokenType: 'Bearer',
      audience,
      scopes: requestedScopes,
      expiresAt: expiresAt.toISOString(),
      warning: 'Copie o token agora. O valor em texto puro não foi armazenado.',
    },
    null,
    2,
  ),
);
