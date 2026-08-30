import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) redirect('/');
  } catch {
    // Configuration may not exist yet in a clean local checkout.
  }
  return <LoginForm />;
}
