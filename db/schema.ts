import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').defaultRandom().primaryKey();
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
const money = (name: string) => numeric(name, { precision: 12, scale: 2 }).default('0').notNull();

export const lifecycleStatus = pgEnum('lifecycle_status', ['prospect', 'client', 'former_client']);
export const relationshipStatus = pgEnum('relationship_status', ['active_recurring', 'active_non_recurring', 'inactive']);
export const healthStatus = pgEnum('health_status', ['good', 'attention', 'critical']);
export const projectType = pgEnum('project_type', ['landing_page', 'institutional', 'ecommerce', 'web_system', 'maintenance', 'other']);
export const projectStatus = pgEnum('project_status', ['proposal', 'development', 'review', 'delivered', 'maintenance', 'archived']);
export const domainResponsibility = pgEnum('domain_responsibility', ['me', 'client', 'third_party']);
export const domainStatus = pgEnum('domain_status', ['active', 'expiring', 'expired', 'transferred']);
export const serviceStatus = pgEnum('service_status', ['active', 'inactive', 'cancelled']);
export const billingFrequency = pgEnum('billing_frequency', ['monthly', 'quarterly', 'semiannual', 'annual', 'custom']);
export const subscriptionStatus = pgEnum('subscription_status', ['active', 'paused', 'cancelled', 'finished']);
export const chargeStatus = pgEnum('charge_status', ['scheduled', 'pending', 'paid', 'overdue', 'cancelled']);
export const proposalStatus = pgEnum('proposal_status', ['draft', 'sent', 'negotiation', 'accepted', 'rejected', 'expired']);
export const taskStatus = pgEnum('task_status', ['open', 'completed', 'snoozed', 'cancelled']);
export const taskPriority = pgEnum('task_priority', ['low', 'normal', 'high', 'urgent']);
export const taskSource = pgEnum('task_source', ['manual', 'automation']);
export const interactionType = pgEnum('interaction_type', ['whatsapp', 'email', 'call', 'meeting', 'note', 'system', 'other']);
export const meetingType = pgEnum('meeting_type', ['google_meet', 'teams', 'phone', 'in_person', 'other']);
export const messageChannel = pgEnum('message_channel', ['whatsapp', 'email']);
export const messageStatus = pgEnum('message_status', ['draft', 'sent', 'failed', 'copied']);
export const automationRunStatus = pgEnum('automation_run_status', ['running', 'succeeded', 'failed']);
export const themePreference = pgEnum('theme_preference', ['light', 'dark', 'system']);

// Better Auth core tables. Password hashes live only in accounts.password.
export const users = pgTable('users', {
  id: id(),
  name: text('name').notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: varchar('role', { length: 32 }).default('admin').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex('users_email_uq').on(table.email)]);

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('sessions_token_uq').on(table.token),
  index('sessions_user_expires_idx').on(table.userId, table.expiresAt),
]);

export const accounts = pgTable('accounts', {
  id: id(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  issuer: text('issuer').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('accounts_issuer_account_uq').on(table.issuer, table.accountId),
  index('accounts_user_idx').on(table.userId),
]);

export const verifications = pgTable('verifications', {
  id: id(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index('verifications_identifier_idx').on(table.identifier)]);

export const rateLimits = pgTable('rate_limits', {
  id: id(),
  key: text('key').notNull(),
  count: integer('count').default(0).notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
}, (table) => [uniqueIndex('rate_limits_key_uq').on(table.key)]);

export const companies = pgTable('companies', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  document: varchar('document', { length: 32 }),
  website: text('website'),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 32 }),
  whatsapp: varchar('whatsapp', { length: 32 }),
  city: text('city'),
  state: varchar('state', { length: 2 }),
  industry: text('industry'),
  lifecycleStatus: lifecycleStatus('lifecycle_status').default('prospect').notNull(),
  relationshipStatus: relationshipStatus('relationship_status').default('inactive').notNull(),
  leadSource: text('lead_source'),
  referredByCompanyId: uuid('referred_by_company_id').references((): AnyPgColumn => companies.id, { onDelete: 'set null' }),
  healthStatus: healthStatus('health_status').default('good').notNull(),
  lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
  nextContactAt: timestamp('next_contact_at', { withTimezone: true }),
  contactFrequencyMonths: integer('contact_frequency_months'),
  nextAction: text('next_action'),
  nextActionAt: timestamp('next_action_at', { withTimezone: true }),
  notesSummary: text('notes_summary'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('companies_owner_name_uq').on(table.ownerUserId, table.name),
  uniqueIndex('companies_owner_document_uq').on(table.ownerUserId, table.document),
  index('companies_owner_lifecycle_idx').on(table.ownerUserId, table.lifecycleStatus, table.archivedAt),
  index('companies_next_contact_idx').on(table.ownerUserId, table.nextContactAt),
  check('companies_contact_frequency_positive', sql`${table.contactFrequencyMonths} is null or ${table.contactFrequencyMonths} > 0`),
]);

export const contacts = pgTable('contacts', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role'),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 32 }),
  whatsapp: varchar('whatsapp', { length: 32 }),
  isPrimary: boolean('is_primary').default(false).notNull(),
  isFinancialContact: boolean('is_financial_contact').default(false).notNull(),
  notes: text('notes'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('contacts_company_idx').on(table.companyId, table.archivedAt),
  index('contacts_owner_email_idx').on(table.ownerUserId, table.email),
]);

export const pipelineStages = pgTable('pipeline_stages', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  position: integer('position').notNull(),
  color: varchar('color', { length: 32 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  isWon: boolean('is_won').default(false).notNull(),
  isLost: boolean('is_lost').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('pipeline_stages_owner_slug_uq').on(table.ownerUserId, table.slug),
  uniqueIndex('pipeline_stages_owner_position_uq').on(table.ownerUserId, table.position),
  check('pipeline_stages_terminal_exclusive', sql`not (${table.isWon} and ${table.isLost})`),
]);

export const opportunities = pgTable('opportunities', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  pipelineStageId: uuid('pipeline_stage_id').notNull().references(() => pipelineStages.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  estimatedValue: money('estimated_value'),
  probability: integer('probability').default(20).notNull(),
  leadSource: text('lead_source'),
  expectedCloseDate: date('expected_close_date'),
  nextAction: text('next_action'),
  nextActionAt: timestamp('next_action_at', { withTimezone: true }),
  lostReason: text('lost_reason'),
  wonAt: timestamp('won_at', { withTimezone: true }),
  lostAt: timestamp('lost_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('opportunities_stage_idx').on(table.ownerUserId, table.pipelineStageId, table.archivedAt),
  index('opportunities_next_action_idx').on(table.ownerUserId, table.nextActionAt),
  index('opportunities_company_idx').on(table.companyId, table.archivedAt),
  check('opportunities_probability_range', sql`${table.probability} between 0 and 100`),
]);

export const projects = pgTable('projects', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  type: projectType('type').default('other').notNull(),
  status: projectStatus('status').default('proposal').notNull(),
  productionUrl: text('production_url'),
  stagingUrl: text('staging_url'),
  repositoryUrl: text('repository_url'),
  startDate: date('start_date'),
  deliveryDate: date('delivery_date'),
  soldValue: money('sold_value'),
  costValue: money('cost_value'),
  notes: text('notes'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index('projects_company_idx').on(table.companyId, table.archivedAt)]);

export const technologies = pgTable('technologies', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('technologies_owner_name_uq').on(table.ownerUserId, table.name)]);

export const projectTechnologies = pgTable('project_technologies', {
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  technologyId: uuid('technology_id').notNull().references(() => technologies.id, { onDelete: 'cascade' }),
}, (table) => [primaryKey({ columns: [table.projectId, table.technologyId], name: 'project_technologies_pk' })]);

export const domains = pgTable('domains', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  domain: text('domain').notNull(),
  registrar: text('registrar'),
  registrationDate: date('registration_date'),
  expirationDate: date('expiration_date').notNull(),
  autoRenew: boolean('auto_renew').default(false).notNull(),
  responsibility: domainResponsibility('responsibility').default('client').notNull(),
  registeredUnderMyAccount: boolean('registered_under_my_account').default(false).notNull(),
  registeredUnderClientDocument: boolean('registered_under_client_document').default(false).notNull(),
  renewalCost: money('renewal_cost'),
  clientRenewalPrice: money('client_renewal_price'),
  status: domainStatus('status').default('active').notNull(),
  notes: text('notes'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('domains_owner_domain_uq').on(table.ownerUserId, table.domain),
  index('domains_expiration_idx').on(table.ownerUserId, table.expirationDate, table.archivedAt),
  index('domains_company_idx').on(table.companyId, table.archivedAt),
]);

export const hostingServices = pgTable('hosting_services', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  plan: text('plan'),
  isFree: boolean('is_free').default(false).notNull(),
  billingFrequency: billingFrequency('billing_frequency').default('monthly').notNull(),
  cost: money('cost'),
  paidBy: varchar('paid_by', { length: 32 }).default('me').notNull(),
  renewalDate: date('renewal_date'),
  dashboardUrl: text('dashboard_url'),
  notes: text('notes'),
  status: serviceStatus('status').default('active').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index('hosting_company_idx').on(table.companyId, table.archivedAt)]);

export const emailServices = pgTable('email_services', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  accountEmail: varchar('account_email', { length: 320 }),
  verifiedDomain: text('verified_domain'),
  senderDomain: text('sender_domain'),
  senderAddress: varchar('sender_address', { length: 320 }),
  status: serviceStatus('status').default('active').notNull(),
  dashboardUrl: text('dashboard_url'),
  credentialReference: text('credential_reference'),
  notes: text('notes'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index('email_services_company_idx').on(table.companyId, table.archivedAt)]);

export const services = pgTable('services', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultAmount: money('default_amount'),
  active: boolean('active').default(true).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex('services_owner_name_uq').on(table.ownerUserId, table.name)]);

export const subscriptions = pgTable('subscriptions', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  amount: money('amount'),
  frequency: billingFrequency('frequency').default('monthly').notNull(),
  customIntervalMonths: integer('custom_interval_months'),
  billingDay: integer('billing_day').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  nextChargeDate: date('next_charge_date').notNull(),
  status: subscriptionStatus('status').default('active').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('subscriptions_next_charge_idx').on(table.ownerUserId, table.status, table.nextChargeDate),
  index('subscriptions_company_idx').on(table.companyId, table.status),
  check('subscriptions_billing_day_range', sql`${table.billingDay} between 1 and 31`),
  check('subscriptions_custom_interval_positive', sql`${table.customIntervalMonths} is null or ${table.customIntervalMonths} > 0`),
]);

export const charges = pgTable('charges', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  category: text('category').default('service').notNull(),
  amount: money('amount'),
  dueDate: date('due_date').notNull(),
  billingPeriod: varchar('billing_period', { length: 7 }),
  status: chargeStatus('status').default('pending').notNull(),
  notes: text('notes'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('charges_subscription_period_uq').on(table.subscriptionId, table.billingPeriod),
  index('charges_due_status_idx').on(table.ownerUserId, table.dueDate, table.status),
  index('charges_company_idx').on(table.companyId, table.archivedAt),
]);

export const payments = pgTable('payments', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  chargeId: uuid('charge_id').notNull().references(() => charges.id, { onDelete: 'restrict' }),
  amount: money('amount'),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: createdAt(),
}, (table) => [index('payments_charge_idx').on(table.chargeId, table.paidAt)]);

export const proposals = pgTable('proposals', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  subtotal: money('subtotal'),
  discount: money('discount'),
  finalAmount: money('final_amount'),
  paymentTerms: text('payment_terms'),
  validUntil: date('valid_until'),
  status: proposalStatus('status').default('draft').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  notes: text('notes'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('proposals_company_idx').on(table.companyId, table.status),
  index('proposals_followup_idx').on(table.ownerUserId, table.status, table.sentAt),
]);

export const meetings = pgTable('meetings', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  meetingAt: timestamp('meeting_at', { withTimezone: true }).notNull(),
  type: meetingType('type').default('other').notNull(),
  meetingUrl: text('meeting_url'),
  location: text('location'),
  notes: text('notes'),
  result: text('result'),
  nextAction: text('next_action'),
  nextActionAt: timestamp('next_action_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index('meetings_schedule_idx').on(table.ownerUserId, table.meetingAt, table.archivedAt)]);

export const tasks = pgTable('tasks', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  chargeId: uuid('charge_id').references(() => charges.id, { onDelete: 'set null' }),
  domainId: uuid('domain_id').references(() => domains.id, { onDelete: 'set null' }),
  meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'set null' }),
  type: text('type').default('general').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  priority: taskPriority('priority').default('normal').notNull(),
  status: taskStatus('status').default('open').notNull(),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  source: taskSource('source').default('manual').notNull(),
  idempotencyKey: text('idempotency_key'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('tasks_owner_idempotency_uq').on(table.ownerUserId, table.idempotencyKey),
  index('tasks_due_status_idx').on(table.ownerUserId, table.dueAt, table.status),
  index('tasks_company_idx').on(table.companyId, table.createdAt),
]);

export const interactions = pgTable('interactions', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  type: interactionType('type').default('note').notNull(),
  subject: text('subject'),
  content: text('content').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  nextAction: text('next_action'),
  nextActionAt: timestamp('next_action_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [index('interactions_company_date_idx').on(table.companyId, table.occurredAt)]);

export const messageTemplates = pgTable('message_templates', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  subject: text('subject'),
  content: text('content').notNull(),
  channel: messageChannel('channel').default('whatsapp').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex('message_templates_owner_name_uq').on(table.ownerUserId, table.name)]);

export const messageLogs = pgTable('message_logs', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  channel: messageChannel('channel').notNull(),
  recipient: text('recipient').notNull(),
  subject: text('subject'),
  templateId: uuid('template_id').references(() => messageTemplates.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  providerMessageId: text('provider_message_id'),
  status: messageStatus('status').notNull(),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [index('message_logs_owner_date_idx').on(table.ownerUserId, table.createdAt)]);

export const notifications = pgTable('notifications', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  readAt: timestamp('read_at', { withTimezone: true }),
  idempotencyKey: text('idempotency_key'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('notifications_user_idempotency_uq').on(table.userId, table.idempotencyKey),
  index('notifications_user_read_idx').on(table.userId, table.readAt, table.createdAt),
]);

export const tags = pgTable('tags', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: varchar('color', { length: 32 }),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('tags_owner_name_uq').on(table.ownerUserId, table.name)]);

export const companyTags = pgTable('company_tags', {
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [primaryKey({ columns: [table.companyId, table.tagId], name: 'company_tags_pk' })]);

export const activities = pgTable('activities', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  action: text('action').notNull(),
  description: text('description').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: createdAt(),
}, (table) => [
  index('activities_owner_date_idx').on(table.ownerUserId, table.createdAt),
  index('activities_company_date_idx').on(table.companyId, table.createdAt),
]);

export const settings = pgTable('settings', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').default('Minha Operação').notNull(),
  timezone: text('timezone').default('America/Sao_Paulo').notNull(),
  currency: varchar('currency', { length: 3 }).default('BRL').notNull(),
  theme: themePreference('theme').default('system').notNull(),
  domainAlertDays: jsonb('domain_alert_days').$type<number[]>().default([60, 30, 15, 7, 3, 0]).notNull(),
  defaultPostSaleMonths: integer('default_post_sale_months').default(6).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex('settings_owner_uq').on(table.ownerUserId)]);

export const automationRuns = pgTable('automation_runs', {
  id: id(),
  jobName: text('job_name').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: automationRunStatus('status').default('running').notNull(),
  processedCount: integer('processed_count').default(0).notNull(),
  errorSummary: text('error_summary'),
}, (table) => [index('automation_runs_job_date_idx').on(table.jobName, table.startedAt)]);

export const schema = {
  users, sessions, accounts, verifications, rateLimits,
  companies, contacts, pipelineStages, opportunities, projects, technologies,
  projectTechnologies, domains, hostingServices, emailServices, services,
  subscriptions, charges, payments, proposals, meetings, tasks, interactions,
  messageTemplates, messageLogs, notifications, tags, companyTags, activities,
  settings, automationRuns,
};
