import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { accounts, rateLimits, sessions, users, verifications } from '@/db/schema';
import { sendEmail } from '@/lib/email';
import { passwordResetEmail } from '@/lib/email-templates';
import { env } from '@/lib/env';

const baseURL = env.BETTER_AUTH_URL || 'http://localhost:3000';
const buildOnlySecret = 'build-only-placeholder-not-for-runtime-use-000000000000';

export const auth = betterAuth({
  appName: 'Minha Operação',
  baseURL,
  secret: env.BETTER_AUTH_SECRET || buildOnlySecret,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      rateLimit: rateLimits,
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
  trustedOrigins: [baseURL],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    database: {
      generateId: 'uuid',
    },
  },
});

export type Session = typeof auth.$Infer.Session;
