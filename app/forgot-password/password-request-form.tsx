'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function PasswordRequestForm() {
  const [email, setEmail] = useState('gabriel.misao08@gmail.com');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
    setMessage('Se o e-mail estiver cadastrado e o Resend configurado, você receberá um link em instantes.');
  }

  return <main className="grid min-h-screen place-items-center bg-muted/40 p-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-xl"><h1 className="text-2xl font-semibold">Recuperar acesso</h1><p className="mt-2 text-sm text-muted-foreground">Enviaremos um link temporário para o e-mail do administrador.</p><label htmlFor="email" className="mt-6 block text-xs font-medium">E-mail</label><Input id="email" type="email" className="mt-2" value={email} onChange={(event) => setEmail(event.target.value)} required /><Button type="submit" className="mt-5 w-full">Enviar link</Button>{message && <p className="mt-4 rounded-lg bg-muted p-3 text-xs">{message}</p>}<Link href="/login" className="mt-5 block text-center text-xs text-muted-foreground">Voltar ao login</Link></form></main>;
}
