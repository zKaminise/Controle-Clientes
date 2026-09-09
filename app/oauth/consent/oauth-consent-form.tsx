'use client';

import { Bot, Check, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

const SCOPE_LABELS: Record<string, string> = {
  openid: 'Confirmar sua identidade',
  profile: 'Ler seu nome de administrador',
  email: 'Confirmar seu e-mail de administrador',
  offline_access: 'Manter a conexão com renovação segura',
  'crm:leads:read': 'Consultar empresas e leads',
  'crm:pipeline:read': 'Consultar etapas e oportunidades',
  'crm:followups:read': 'Consultar follow-ups',
  'crm:analysis:read': 'Consultar análises e lead score',
  'crm:metrics:read': 'Consultar atenção e métricas comerciais',
  'crm:leads:write': 'Cadastrar e atualizar leads',
  'crm:pipeline:write': 'Alterar etapas comerciais',
  'crm:interactions:write': 'Registrar contatos e resultados',
  'crm:followups:write': 'Criar follow-ups',
  'crm:referrals:write': 'Registrar indicações',
  'crm:analysis:write': 'Criar ou atualizar análises digitais',
};

export function OAuthConsentForm({
  clientId,
  requestedScopes,
}: {
  clientId: string;
  requestedScopes: string[];
}) {
  const [busy, setBusy] = useState<'accept' | 'deny' | null>(null);
  const [error, setError] = useState('');

  async function decide(accept: boolean) {
    setBusy(accept ? 'accept' : 'deny');
    setError('');
    const result = await authClient.oauth2.consent({
      accept,
      scope: requestedScopes.join(' '),
    });
    if (result.error) {
      setError(result.error.message || 'Não foi possível concluir a autorização.');
      setBusy(null);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-5 py-10">
      <section className="w-full max-w-xl rounded-2xl border bg-card p-7 shadow-xl sm:p-9">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Bot className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-primary">Integração protegida</p>
            <h1 className="text-xl font-semibold">Autorizar acesso ao CRM</h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">{clientId}</span> solicita acesso ao seu
          Controle de Clientes. O acesso fica limitado às permissões abaixo e pode ser revogado.
        </p>

        <div className="mt-5 rounded-xl border bg-muted/25 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-primary" /> Permissões solicitadas
          </div>
          <ul className="space-y-2">
            {requestedScopes.map((scope) => (
              <li key={scope} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{SCOPE_LABELS[scope] || scope}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Exclusões, pagamentos, usuários, configurações críticas e operações em massa não são
          expostos por esta integração.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" disabled={Boolean(busy)} onClick={() => decide(false)}>
            {busy === 'deny' ? <LoaderCircle className="animate-spin" /> : <X />} Recusar
          </Button>
          <Button size="lg" disabled={Boolean(busy)} onClick={() => decide(true)}>
            {busy === 'accept' ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Autorizar
          </Button>
        </div>
      </section>
    </main>
  );
}

