'use client';

import { ArrowRight, Command, LoaderCircle, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function LoginForm() {
  const [email, setEmail] = useState('gabriel.misao08@gmail.com');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || 'E-mail ou senha inválidos.');
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid min-h-screen bg-login lg:grid-cols-[1.1fr_.9fr]">
      <section className="hidden flex-col justify-between border-r border-white/10 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-200"><Command className="size-5" /></div>
          <div><p className="font-semibold">Minha Operação</p><p className="text-xs text-white/55">clientes.gabrielmisao.com.br</p></div>
        </div>
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-300">Central operacional privada</p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-.045em]">Nada importante fica esquecido.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/60">Clientes, oportunidades, cobranças, domínios e próximos contatos em um único lugar.</p>
        </div>
        <p className="text-xs text-white/35">Acesso privado · somente administrador</p>
      </section>
      <main className="grid place-items-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-[410px] rounded-2xl border bg-card p-7 shadow-2xl shadow-emerald-950/10 sm:p-9">
          <div className="mb-6 grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden"><Command className="size-5" /></div>
          <p className="flex items-center gap-2 text-xs font-medium text-primary"><LockKeyhole className="size-3.5" /> Acesso protegido</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">Bem-vindo de volta</h2>
          <p className="mt-2 text-sm text-muted-foreground">Entre com seu usuário administrador.</p>
          <label htmlFor="email" className="mt-7 block text-xs font-medium">E-mail</label>
          <Input id="email" autoComplete="username" className="mt-2 h-10" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="password" className="mt-4 block text-xs font-medium">Senha</label>
          <Input id="password" autoComplete="current-password" className="mt-2 h-10" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">{error}</p>}
          <Button type="submit" className="mt-6 h-10 w-full" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : 'Entrar'} {!busy && <ArrowRight />}</Button>
          <Link href="/forgot-password" className="mt-5 block text-center text-xs text-muted-foreground hover:text-foreground">Esqueci minha senha</Link>
        </form>
      </main>
    </div>
  );
}
