import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt } from 'better-auth/plugins';
import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { mcp } from '@better-auth/mcp';
import { db } from '@/db';
import {
  accounts,
  jwks,
  oauthAccessTokens,
  oauthClientAssertions,
  oauthClientResources,
  oauthClients,
  oauthConsents,
  oauthRefreshTokens,
  oauthResources,
  rateLimits,
  sessions,
  users,
  verifications,
} from '@/db/schema';
import { sendEmail } from '@/lib/email';
import { passwordResetEmail } from '@/lib/email-templates';
import { env } from '@/lib/env';
import {
  MCP_OIDC_SCOPES,
  MCP_READ_SCOPES,
  MCP_WRITE_SCOPES,
  mcpAllowedAdminEmail,
  mcpResourceUrl,
} from '@/lib/mcp-config';

const baseURL = env.BETTER_AUTH_URL;

function vercelProductionOrigin() {
  const hostname = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().toLowerCase();
  if (!hostname || !hostname.endsWith('.vercel.app') || hostname.includes('/')) return null;
  return `https://${hostname}`;
}

const trustedOrigins = [...new Set([baseURL, vercelProductionOrigin()].filter((value): value is string => Boolean(value)))];

export const auth = betterAuth({
  appName: 'Minha Operação',
  baseURL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      rateLimit: rateLimits,
      jwks,
      oauthClient: oauthClients,
      oauthResource: oauthResources,
      oauthClientResource: oauthClientResources,
      oauthRefreshToken: oauthRefreshTokens,
      oauthAccessToken: oauthAccessTokens,
      oauthConsent: oauthConsents,
      oauthClientAssertion: oauthClientAssertions,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true',
    minPasswordLength: 12,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const message = passwordResetEmail({ name: user.name, url });
      await sendEmail({
        to: user.email,
        subject: message.subject,
        html: message.html,
        idempotencyKey: `password-reset-${user.id}-${Date.now()}`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    modelName: 'rateLimit',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/request-password-reset': { window: 900, max: 3 },
      '/reset-password': { window: 900, max: 5 },
    },
  },
  trustedOrigins,
  plugins: [
    jwt(),
    mcp({
      loginPage: '/login',
      consentPage: '/oauth/consent',
      resource: mcpResourceUrl(),
      scopes: [...MCP_OIDC_SCOPES, ...MCP_READ_SCOPES, ...MCP_WRITE_SCOPES],
      grantTypes: ['authorization_code', 'refresh_token'],
      accessTokenExpiresIn: 15 * 60,
      refreshTokenExpiresIn: 30 * 24 * 60 * 60,
      codeExpiresIn: 5 * 60,
      refreshTokenReuseInterval: 0,
      allowDynamicClientRegistration: false,
      allowUnauthenticatedClientRegistration: false,
      clientRegistrationRequirePKCE: true,
      enforcePerClientResources: true,
      clientPrivileges: () => false,
      resourcePrivileges: () => false,
      customAccessTokenClaims: ({ user }) => {
        if (!user || user.email.toLowerCase() !== mcpAllowedAdminEmail()) {
          throw new Error('Conta não autorizada para integração MCP.');
        }
        return { crm_role: 'admin' };
      },
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: 'mcp-2026-07-28',
      metadataRevalidationInterval: '60m',
      maxCacheEntries: 100,
      metadataFetchPolicy: {
        minimumFetchInterval: 2,
        maximumConcurrentFetches: 8,
        maximumConcurrentFetchesPerOrigin: 2,
        maximumFetchesPerMinute: 60,
        maximumFetchesPerOriginPerMinute: 20,
      },
    }),
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    database: {
      generateId: 'uuid',
    },
  },
});

export type Session = typeof auth.$Infer.Session;
