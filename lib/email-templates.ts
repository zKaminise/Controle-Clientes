const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function layout(title: string, body: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f3f5f1;font-family:Arial,sans-serif;color:#21352f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;border:1px solid #dfe5df;border-radius:16px"><tr><td style="padding:32px"><p style="margin:0 0 8px;color:#467366;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Minha Operação</p><h1 style="margin:0 0 20px;font-size:24px">${escapeHtml(title)}</h1>${body}<p style="margin:28px 0 0;color:#728078;font-size:12px">Mensagem enviada pelo sistema privado de Gabriel Misao.</p></td></tr></table></td></tr></table></body></html>`;
}

export function passwordResetEmail(input: { name: string; url: string }) {
  const name = escapeHtml(input.name || 'Gabriel');
  const url = escapeHtml(input.url);
  return {
    subject: 'Redefina sua senha — Minha Operação',
    html: layout('Redefinição de senha', `<p>Olá, ${name}.</p><p>Use o botão abaixo para criar uma nova senha. O link é temporário e deve ser usado apenas por você.</p><p style="margin:28px 0"><a href="${url}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#356a5a;color:#fff;text-decoration:none;font-weight:700">Redefinir senha</a></p><p style="color:#728078;font-size:13px">Se você não solicitou isso, ignore esta mensagem.</p>`),
  };
}

export function operationalEmail(input: { title: string; greeting?: string; content: string }) {
  const paragraphs = input.content.split(/\n{2,}/).map((part) => `<p>${escapeHtml(part).replaceAll('\n', '<br>')}</p>`).join('');
  return {
    subject: input.title,
    html: layout(input.title, `${input.greeting ? `<p>${escapeHtml(input.greeting)}</p>` : ''}${paragraphs}`),
  };
}

export function renderTemplate(template: string, variables: Record<string, string | number | undefined>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? match : String(value);
  });
}
