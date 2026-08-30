import { eq } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { db } from '@/db';
import { messageTemplates, pipelineStages, services, settings, tags, technologies, users } from '@/db/schema';

const defaultStages = [
  ['Novo lead', 'new_lead', '#64748b', false, false],
  ['Contato realizado', 'contacted', '#0ea5e9', false, false],
  ['Respondeu', 'replied', '#06b6d4', false, false],
  ['Qualificado', 'qualified', '#8b5cf6', false, false],
  ['Reunião agendada', 'meeting', '#a855f7', false, false],
  ['Levantamento de requisitos', 'requirements', '#d946ef', false, false],
  ['Proposta enviada', 'proposal', '#f59e0b', false, false],
  ['Negociação', 'negotiation', '#f97316', false, false],
  ['Follow-up', 'follow_up', '#eab308', false, false],
  ['Contato futuro', 'future_contact', '#84cc16', false, false],
  ['Ganho', 'won', '#10b981', true, false],
  ['Perdido', 'lost', '#ef4444', false, true],
] as const;

const defaultTemplates = [
  ['Cobrança', 'charge', 'Lembrete de cobrança', 'Olá {{nome}}, tudo bem?\n\nPassando para lembrar que a cobrança referente a {{descricao}}, no valor de {{valor}}, vence em {{vencimento}}.\n\nCaso já tenha realizado o pagamento, pode desconsiderar. Obrigado!', 'whatsapp'],
  ['Domínio', 'domain', 'Renovação do domínio {{dominio}}', 'Olá {{nome}}, o domínio {{dominio}} precisa de atenção para renovação. O vencimento é {{vencimento}}.', 'email'],
  ['Pós-venda', 'post_sale', 'Como estão as coisas por aí?', 'Olá {{nome}}, tudo bem? Passando para saber como está o projeto e se posso ajudar em algo.', 'whatsapp'],
  ['Follow-up', 'follow_up', 'Retomando nosso contato', 'Olá {{nome}}, retomando nosso contato sobre {{descricao}}. Faz sentido avançarmos?', 'whatsapp'],
  ['Contato futuro', 'future_contact', 'Conforme combinamos', 'Olá {{nome}}, tudo bem? Conforme combinamos, estou retomando nosso contato.', 'whatsapp'],
  ['Indicação', 'referral', 'Obrigado pela indicação', 'Olá {{nome}}, muito obrigado pela indicação de {{empresa}}. Vou cuidar desse contato com atenção.', 'whatsapp'],
] as const;

export async function seedForUser(ownerUserId: string) {
  for (const [position, stage] of defaultStages.entries()) {
    await db.insert(pipelineStages).values({ ownerUserId, name: stage[0], slug: stage[1], color: stage[2], isWon: stage[3], isLost: stage[4], position }).onConflictDoNothing();
  }
  for (const template of defaultTemplates) {
    await db.insert(messageTemplates).values({ ownerUserId, name: template[0], category: template[1], subject: template[2], content: template[3], channel: template[4] }).onConflictDoNothing();
  }
  for (const name of ['Manutenção', 'Hospedagem', 'SEO', 'Suporte', 'Domínio', 'Landing page', 'Outro']) await db.insert(services).values({ ownerUserId, name }).onConflictDoNothing();
  for (const name of ['Next.js', 'React', 'Node.js', 'WordPress', 'Supabase', 'Neon', 'Vercel', 'Resend', 'Cloudflare']) await db.insert(technologies).values({ ownerUserId, name }).onConflictDoNothing();
  for (const [name, color] of [['VIP', '#f59e0b'], ['Indicação', '#8b5cf6'], ['Recorrente', '#10b981'], ['Domínio comigo', '#ef4444']]) await db.insert(tags).values({ ownerUserId, name, color }).onConflictDoNothing();
  await db.insert(settings).values({ ownerUserId }).onConflictDoNothing();
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL antes de executar o seed.');
  const allUsers = await db.select({ id: users.id }).from(users);
  if (!allUsers.length) throw new Error('Crie o administrador primeiro com npm run create-admin.');
  for (const user of allUsers) await seedForUser(user.id);
  const seeded = await db.select({ id: settings.id }).from(settings).where(eq(settings.ownerUserId, allUsers[0].id));
  console.log(`Seed concluído para ${allUsers.length} usuário(s); configurações: ${seeded.length}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
