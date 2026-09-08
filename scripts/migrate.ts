import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from '@/db';

if (!process.env.DATABASE_URL) {
  throw new Error('Defina DATABASE_URL antes de executar as migrations.');
}

await migrate(db, { migrationsFolder: 'drizzle' });
console.log('Migrations aplicadas com sucesso.');
