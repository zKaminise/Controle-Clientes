import { eq } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { db } from '@/db';
import {
  leadScoreRules,
  messageTemplates,
  pipelineStages,
  services,
  settings,
  tags,
  technologies,
  users,
} from '@/db/schema';
import { DEFAULT_LEAD_SCORE_RULES } from '@/lib/crm';

const defaultStages = [
  ['Novo lead', 'novo_lead', '#64748b', false, false],
  ['Pesquisando', 'pesquisando', '#475569', false, false],
  ['Pronto para contato', 'pronto_para_contato', '#0284c7', false, false],
  ['Contato por WhatsApp', 'contato_whatsapp', '#16a34a', false, false],
  ['Contato por e-mail', 'contato_email', '#2563eb', false, false],
  ['Contato por telefone', 'contato_telefone', '#0891b2', false, false],
  ['Sem resposta', 'sem_resposta', '#f59e0b', false, false],
  ['Respondeu', 'respondeu', '#06b6d4', false, false],
  ['Interessado', 'interessado', '#8b5cf6', false, false],
  ['Reunião agendada', 'reuniao_agendada', '#a855f7', false, false],
  ['Reunião realizada', 'reuniao_realizada', '#c026d3', false, false],
  ['Proposta enviada', 'proposta_enviada', '#f97316', false, false],
  ['Negociação', 'negociacao', '#ea580c', false, false],
  ['Follow-up futuro', 'followup_futuro', '#84cc16', false, false],
  ['Fechado', 'fechado', '#10b981', true, false],
  ['Perdido', 'perdido', '#ef4444', false, true],
  ['Descartado', 'descartado', '#991b1b', false, true],
  ['Número inválido', 'numero_invalido', '#78716c', false, true],
  ['E-mail inválido', 'email_invalido', '#78716c', false, true],
  ['Já possui fornecedor', 'ja_possui_fornecedor', '#57534e', false, true],
  ['Sem interesse', 'sem_interesse', '#7f1d1d', false, true],
] as const;

const defaultTemplates = [
  [
    'Cobrança',
    'charge',
    'Lembrete de cobrança',
    'Olá {{nome}}, tudo bem?\n\nPassando para lembrar que a cobrança referente a {{descricao}}, no valor de {{valor}}, vence em {{vencimento}}.\n\nCaso já tenha realizado o pagamento, pode desconsiderar. Obrigado!',
    'whatsapp',
  ],
  [
    'Domínio',
    'domain',
    'Renovação do domínio {{dominio}}',
    'Olá {{nome}}, o domínio {{dominio}} precisa de atenção para renovação. O vencimento é {{vencimento}}.',
    'email',
  ],
  [
    'Pós-venda',
    'post_sale',
    'Como estão as coisas por aí?',
    'Olá {{nome}}, tudo bem? Passando para saber como está o projeto e se posso ajudar em algo.',
    'whatsapp',
  ],
  [
    'Follow-up',
    'follow_up',
    'Retomando nosso contato',
    'Olá {{nome}}, retomando nosso contato sobre {{descricao}}. Faz sentido avançarmos?',
    'whatsapp',
  ],
  [
    'Contato futuro',
    'future_contact',
    'Conforme combinamos',
    'Olá {{nome}}, tudo bem? Conforme combinamos, estou retomando nosso contato.',
    'whatsapp',
  ],
  [
    'Indicação',
    'referral',
    'Obrigado pela indicação',
    'Olá {{nome}}, muito obrigado pela indicação de {{empresa}}. Vou cuidar desse contato com atenção.',
    'whatsapp',
  ],
] as const;

export async function seedForUser(ownerUserId: string) {
  for (const [position, stage] of defaultStages.entries()) {
    await db
      .insert(pipelineStages)
      .values({
        ownerUserId,
        name: stage[0],
        slug: stage[1],
        color: stage[2],
        isWon: stage[3],
        isLost: stage[4],
        position,
      })
      .onConflictDoNothing();
  }
  for (const rule of DEFAULT_LEAD_SCORE_RULES) {
    await db
      .insert(leadScoreRules)
      .values({ ownerUserId, ...rule })
      .onConflictDoNothing();
  }
  for (const template of defaultTemplates) {
    await db
      .insert(messageTemplates)
      .values({
        ownerUserId,
        name: template[0],
        category: template[1],
        subject: template[2],
        content: template[3],
        channel: template[4],
      })
      .onConflictDoNothing();
  }
  for (const name of [
    'Manutenção',
    'Hospedagem',
    'SEO',
    'Suporte',
    'Domínio',
    'Landing page',
    'Outro',
  ])
    await db
      .insert(services)
      .values({ ownerUserId, name })
      .onConflictDoNothing();
  for (const name of [
    'Next.js',
    'React',
    'Node.js',
    'WordPress',
    'Supabase',
    'Neon',
    'Vercel',
    'Resend',
    'Cloudflare',
  ])
    await db
      .insert(technologies)
      .values({ ownerUserId, name })
      .onConflictDoNothing();
  for (const [name, color] of [
    ['VIP', '#f59e0b'],
    ['Indicação', '#8b5cf6'],
    ['Recorrente', '#10b981'],
    ['Domínio comigo', '#ef4444'],
  ])
    await db
      .insert(tags)
      .values({ ownerUserId, name, color })
      .onConflictDoNothing();
  await db.insert(settings).values({ ownerUserId }).onConflictDoNothing();
}

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error('Defina DATABASE_URL antes de executar o seed.');
  const allUsers = await db.select({ id: users.id }).from(users);
  if (!allUsers.length)
    throw new Error('Crie o administrador primeiro com npm run create-admin.');
  for (const user of allUsers) await seedForUser(user.id);
  const seeded = await db
    .select({ id: settings.id })
    .from(settings)
    .where(eq(settings.ownerUserId, allUsers[0].id));
  console.log(
    `Seed concluído para ${allUsers.length} usuário(s); configurações: ${seeded.length}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
