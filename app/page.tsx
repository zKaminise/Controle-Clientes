import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireRuntimeEnv } from '@/lib/env';
import { OperationsApp } from './operations-app';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let session = null;
  try {
    requireRuntimeEnv();
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    // A fresh checkout without DATABASE_URL must still build and show setup/login.
  }
  if (!session) redirect('/login');
  return <OperationsApp initialUser={{ id: session.user.id, email: session.user.email, name: session.user.name, mustChangePassword: false }} />;
}
