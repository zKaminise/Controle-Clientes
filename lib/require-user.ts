import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { requireRuntimeEnv } from '@/lib/env';

export async function requireUser() {
  requireRuntimeEnv();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error('UNAUTHORIZED');
  return session.user;
}
