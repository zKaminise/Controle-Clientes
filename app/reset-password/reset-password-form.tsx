'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) return setMessage('As senhas não coincidem.');
    const result = await authClient.resetPassword({ token, newPassword: password });
    setMessage(result.error ? (result.error.message || 'Não foi possível redefinir a senha.') : 'Senha redefinida. Você já pode entrar.');
  }

  return <main className="grid min-h-screen place-items-center bg-muted/40 p-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-xl"><h1 className="text-2xl font-semibold">Criar nova senha</h1><p className="mt-2 text-sm text-muted-foreground">Use ao menos 12 caracteres e não reutilize a senha provisória antiga.</p><label htmlFor="password" className="mt-6 block text-xs font-medium">Nova senha</label><Input id="password" type="password" className="mt-2" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /><label htmlFor="confirm" className="mt-4 block text-xs font-medium">Confirmar senha</label><Input id="confirm" type="password" className="mt-2" minLength={12} value={confirm} onChange={(event) => setConfirm(event.target.value)} required /><Button type="submit" className="mt-5 w-full" disabled={!token}>Salvar nova senha</Button>{message && <p className="mt-4 rounded-lg bg-muted p-3 text-xs">{message}</p>}</form></main>;
}
