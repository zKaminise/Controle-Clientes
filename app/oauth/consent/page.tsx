import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { mcpAllowedAdminEmail } from '@/lib/mcp-config';
import { OAuthConsentForm } from './oauth-consent-form';

export const dynamic = 'force-dynamic';

type ConsentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OAuthConsentPage({ searchParams }: ConsentPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value) query.set(key, value);
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/login?${query.toString()}`);
  if (session.user.email.toLowerCase() !== mcpAllowedAdminEmail()) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 px-5">
        <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-xl">
          <h1 className="text-xl font-semibold">Conta não autorizada</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Somente a conta administrativa do Controle de Clientes pode autorizar integrações.
          </p>
        </div>
      </main>
    );
  }

  const requestedScopes = String(params.scope || '')
    .split(' ')
    .map((scope) => scope.trim())
    .filter(Boolean);

  return (
    <OAuthConsentForm
      clientId={String(params.client_id || 'Cliente MCP')}
      requestedScopes={requestedScopes}
    />
  );
}

