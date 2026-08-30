import { and, eq, ilike, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { companies, contacts, domains, projects } from '@/db/schema';
import { requireUser } from '@/lib/require-user';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = z.string().trim().min(2).max(100).parse(new URL(request.url).searchParams.get('q'));
    const pattern = `%${query}%`;
    const [companyRows, contactRows, domainRows, projectRows] = await Promise.all([
      db.select({ id: companies.id, title: companies.name, subtitle: companies.legalName, type: companies.lifecycleStatus }).from(companies).where(and(eq(companies.ownerUserId, user.id), isNull(companies.archivedAt), or(ilike(companies.name, pattern), ilike(companies.legalName, pattern), ilike(companies.email, pattern), ilike(companies.phone, pattern), ilike(companies.whatsapp, pattern), ilike(companies.website, pattern)))).limit(20),
      db.select({ id: contacts.id, companyId: contacts.companyId, title: contacts.name, subtitle: contacts.email, type: contacts.role }).from(contacts).where(and(eq(contacts.ownerUserId, user.id), isNull(contacts.archivedAt), or(ilike(contacts.name, pattern), ilike(contacts.email, pattern), ilike(contacts.phone, pattern), ilike(contacts.whatsapp, pattern)))).limit(20),
      db.select({ id: domains.id, companyId: domains.companyId, title: domains.domain, subtitle: domains.registrar }).from(domains).where(and(eq(domains.ownerUserId, user.id), isNull(domains.archivedAt), ilike(domains.domain, pattern))).limit(20),
      db.select({ id: projects.id, companyId: projects.companyId, title: projects.name, subtitle: projects.productionUrl }).from(projects).where(and(eq(projects.ownerUserId, user.id), isNull(projects.archivedAt), ilike(projects.name, pattern))).limit(20),
    ]);
    return Response.json({ companies: companyRows, contacts: contactRows, domains: domainRows, projects: projectRows });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Não autorizado.' : 'Busca inválida.' }, { status: error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 400 });
  }
}
