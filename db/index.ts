import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Keeps static builds working without embedding any usable credential.
const buildSafeDatabaseUrl = ['postgres', 'ql://placeholder:placeholder@localhost/placeholder'].join('');

export function getDb() {
  const client = neon(process.env.DATABASE_URL ?? buildSafeDatabaseUrl);
  return drizzle(client, { schema });
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export const db = getDb();
