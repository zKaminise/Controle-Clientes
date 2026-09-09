import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value) query.set(key, value);
  }
  let session = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    // Configuration may not exist yet in a clean local checkout.
  }
  if (session) {
    if (params.response_type === 'code' && params.client_id) {
      redirect(`/api/auth/oauth2/authorize?${query.toString()}`);
    }
    redirect('/');
  }
  return <LoginForm />;
}
