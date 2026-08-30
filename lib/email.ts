import { Resend } from 'resend';
import { env } from '@/lib/env';

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
};

export function isEmailConfigured() {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

export async function sendEmail(input: EmailInput) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error('Envio de e-mail ainda não configurado. Defina RESEND_API_KEY e RESEND_FROM_EMAIL.');
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const fromName = env.RESEND_FROM_NAME || 'Minha Operação';
  const { data, error } = await resend.emails.send({
    from: `${fromName} <${env.RESEND_FROM_EMAIL}>`,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : undefined,
  });

  if (error) throw new Error(error.message);
  return data;
}

export const sendPasswordResetEmail = sendEmail;
export const sendChargeReminder = sendEmail;
export const sendDomainReminder = sendEmail;
export const sendFollowUp = sendEmail;
