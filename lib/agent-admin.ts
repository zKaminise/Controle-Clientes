import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { agentAccessTokens, agentIntegrations, users } from '@/db/schema';
import {
  AGENT_SCOPES,
  agentTokenPrefix,
  allowedAgentAdminEmail,
  generateAgentToken,
  hashAgentToken,
} from '@/lib/agent-auth';

export const createAgentIntegrationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    audience: z.string().trim().min(1).max(512),
    scopes: z.array(z.enum(AGENT_SCOPES)).min(1).max(AGENT_SCOPES.length),
    expiresAt: z.date(),
    rateLimitPerMinute: z.number().int().min(1).max(600),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.expiresAt.getTime() <= Date.now()) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'A expiração deve estar no futuro.',
      });
    }
  });

export type CreateAgentIntegrationInput = z.infer<
  typeof createAgentIntegrationSchema
>;

async function authorizedOwner() {
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
  return owner;
}

export async function createAgentIntegration(
  rawInput: CreateAgentIntegrationInput,
) {
  const input = createAgentIntegrationSchema.parse(rawInput);
  const owner = await authorizedOwner();
  const [existing] = await db
    .select({ id: agentIntegrations.id })
    .from(agentIntegrations)
    .where(
      and(
        eq(agentIntegrations.ownerUserId, owner.id),
        eq(agentIntegrations.name, input.name),
        eq(agentIntegrations.status, 'active'),
      ),
    )
    .limit(1);
  if (existing)
    throw new Error(`Já existe uma integração ativa chamada ${input.name}.`);

  const integrationId = randomUUID();
  const tokenId = randomUUID();
  const clientId = `cca_client_${randomBytes(12).toString('hex')}`;
  const token = generateAgentToken();

  await db.batch([
    db.insert(agentIntegrations).values({
      id: integrationId,
      ownerUserId: owner.id,
      clientId,
      name: input.name,
      audience: input.audience,
      scopes: input.scopes,
      rateLimitPerMinute: input.rateLimitPerMinute,
    }),
    db.insert(agentAccessTokens).values({
      id: tokenId,
      integrationId,
      tokenPrefix: agentTokenPrefix(token),
      tokenHash: hashAgentToken(token),
      expiresAt: input.expiresAt,
    }),
  ]);

  return {
    integrationId,
    tokenId,
    clientId,
    token,
    tokenPrefix: agentTokenPrefix(token),
    ownerEmail: owner.email,
    name: input.name,
    audience: input.audience,
    scopes: input.scopes,
    expiresAt: input.expiresAt,
    rateLimitPerMinute: input.rateLimitPerMinute,
  };
}

export async function listAgentIntegrations() {
  const owner = await authorizedOwner();
  const rows = await db
    .select({
      integrationId: agentIntegrations.id,
      clientId: agentIntegrations.clientId,
      name: agentIntegrations.name,
      audience: agentIntegrations.audience,
      scopes: agentIntegrations.scopes,
      integrationStatus: agentIntegrations.status,
      rateLimitPerMinute: agentIntegrations.rateLimitPerMinute,
      integrationLastUsedAt: agentIntegrations.lastUsedAt,
      integrationRevokedAt: agentIntegrations.revokedAt,
      createdAt: agentIntegrations.createdAt,
      tokenId: agentAccessTokens.id,
      tokenPrefix: agentAccessTokens.tokenPrefix,
      expiresAt: agentAccessTokens.expiresAt,
      tokenLastUsedAt: agentAccessTokens.lastUsedAt,
      tokenRevokedAt: agentAccessTokens.revokedAt,
      tokenCreatedAt: agentAccessTokens.createdAt,
    })
    .from(agentIntegrations)
    .leftJoin(
      agentAccessTokens,
      eq(agentAccessTokens.integrationId, agentIntegrations.id),
    )
    .where(eq(agentIntegrations.ownerUserId, owner.id))
    .orderBy(agentIntegrations.createdAt, agentAccessTokens.createdAt);
  const now = Date.now();
  const grouped = new Map<
    string,
    {
      clientId: string;
      name: string;
      audience: string;
      scopes: string[];
      status: string;
      rateLimitPerMinute: number;
      lastUsedAt: Date | null;
      revokedAt: Date | null;
      createdAt: Date;
      tokens: Array<{
        id: string;
        fingerprint: string;
        status: 'active' | 'expired' | 'revoked';
        expiresAt: Date;
        createdAt: Date;
        lastUsedAt: Date | null;
        revokedAt: Date | null;
      }>;
    }
  >();
  for (const row of rows) {
    let integration = grouped.get(row.integrationId);
    if (!integration) {
      integration = {
        clientId: row.clientId,
        name: row.name,
        audience: row.audience,
        scopes: row.scopes,
        status: row.integrationStatus,
        rateLimitPerMinute: row.rateLimitPerMinute,
        lastUsedAt: row.integrationLastUsedAt,
        revokedAt: row.integrationRevokedAt,
        createdAt: row.createdAt,
        tokens: [],
      };
      grouped.set(row.integrationId, integration);
    }
    if (row.tokenId && row.tokenPrefix && row.expiresAt && row.tokenCreatedAt) {
      integration.tokens.push({
        id: row.tokenId,
        fingerprint: row.tokenPrefix,
        status:
          row.tokenRevokedAt || row.integrationStatus === 'revoked'
            ? 'revoked'
            : row.expiresAt.getTime() <= now
              ? 'expired'
              : 'active',
        expiresAt: row.expiresAt,
        createdAt: row.tokenCreatedAt,
        lastUsedAt: row.tokenLastUsedAt,
        revokedAt: row.tokenRevokedAt,
      });
    }
  }
  return [...grouped.values()];
}

export async function revokeAgentCredential(input: {
  clientId?: string;
  tokenId?: string;
}) {
  if (Boolean(input.clientId) === Boolean(input.tokenId))
    throw new Error('Informe somente clientId ou tokenId.');
  const owner = await authorizedOwner();

  if (input.tokenId) {
    const [token] = await db
      .select({
        id: agentAccessTokens.id,
        integrationId: agentAccessTokens.integrationId,
        clientId: agentIntegrations.clientId,
      })
      .from(agentAccessTokens)
      .innerJoin(
        agentIntegrations,
        eq(agentAccessTokens.integrationId, agentIntegrations.id),
      )
      .where(
        and(
          eq(agentAccessTokens.id, input.tokenId),
          eq(agentIntegrations.ownerUserId, owner.id),
        ),
      )
      .limit(1);
    if (!token) throw new Error('Token autorizado não encontrado.');
    const [revoked] = await db
      .update(agentAccessTokens)
      .set({ revokedAt: sql`now()` })
      .where(eq(agentAccessTokens.id, token.id))
      .returning({ revokedAt: agentAccessTokens.revokedAt });
    return {
      clientId: token.clientId,
      tokenId: token.id,
      revokedAt: revoked.revokedAt!,
    };
  }

  const [integration] = await db
    .select({ id: agentIntegrations.id, clientId: agentIntegrations.clientId })
    .from(agentIntegrations)
    .where(
      and(
        eq(agentIntegrations.clientId, input.clientId!),
        eq(agentIntegrations.ownerUserId, owner.id),
      ),
    )
    .limit(1);
  if (!integration) throw new Error('Integração autorizada não encontrada.');
  await db.batch([
    db
      .update(agentIntegrations)
      .set({
        status: 'revoked',
        revokedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(agentIntegrations.id, integration.id)),
    db
      .update(agentAccessTokens)
      .set({ revokedAt: sql`now()` })
      .where(eq(agentAccessTokens.integrationId, integration.id)),
  ]);
  const [revoked] = await db
    .select({ revokedAt: agentIntegrations.revokedAt })
    .from(agentIntegrations)
    .where(eq(agentIntegrations.id, integration.id))
    .limit(1);
  return {
    clientId: integration.clientId,
    tokenId: null,
    revokedAt: revoked.revokedAt!,
  };
}
