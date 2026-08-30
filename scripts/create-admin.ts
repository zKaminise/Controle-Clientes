import { z } from 'zod';

const input = z.object({
  DATABASE_URL: z.string().trim().url(),
  ADMIN_EMAIL: z.string().trim().email(),
  ADMIN_INITIAL_PASSWORD: z.string().min(12).max(128),
}).parse(process.env);

process.env.ALLOW_ADMIN_BOOTSTRAP = 'true';

async function main() {
  const [{ auth }, { db }, { users }, { eq }, { seedForUser }] = await Promise.all([
    import('@/lib/auth'),
    import('@/db'),
    import('@/db/schema'),
    import('drizzle-orm'),
    import('./seed'),
  ]);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.ADMIN_EMAIL.toLowerCase())).limit(1);
  if (existing[0]) {
    console.log('O administrador já existe. Nenhum usuário foi duplicado e a senha existente não foi alterada.');
    return;
  }
  const result = await auth.api.signUpEmail({ body: { email: input.ADMIN_EMAIL.toLowerCase(), password: input.ADMIN_INITIAL_PASSWORD, name: 'Gabriel Misao' } });
  if (!result.user?.id) throw new Error('Não foi possível criar o administrador.');
  await seedForUser(result.user.id);
  console.log(`Administrador ${input.ADMIN_EMAIL} criado com segurança. Remova ADMIN_INITIAL_PASSWORD do ambiente agora.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
