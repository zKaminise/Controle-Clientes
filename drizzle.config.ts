import { defineConfig } from 'drizzle-kit';

const generationOnlyUrl = ['postgres', 'ql://placeholder:placeholder@localhost/placeholder'].join('');

export default defineConfig({
  out: './drizzle',
  schema: './db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? generationOnlyUrl,
  },
  strict: true,
});
