CREATE TYPE "public"."automation_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."billing_frequency" AS ENUM('monthly', 'quarterly', 'semiannual', 'annual', 'custom');--> statement-breakpoint
CREATE TYPE "public"."charge_status" AS ENUM('scheduled', 'pending', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."domain_responsibility" AS ENUM('me', 'client', 'third_party');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('active', 'expiring', 'expired', 'transferred');--> statement-breakpoint
CREATE TYPE "public"."health_status" AS ENUM('good', 'attention', 'critical');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('whatsapp', 'email', 'call', 'meeting', 'note', 'system', 'other');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_status" AS ENUM('prospect', 'client', 'former_client');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('google_meet', 'teams', 'phone', 'in_person', 'other');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('whatsapp', 'email');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('draft', 'sent', 'failed', 'copied');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('proposal', 'development', 'review', 'delivered', 'maintenance', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('landing_page', 'institutional', 'ecommerce', 'web_system', 'maintenance', 'other');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'negotiation', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."relationship_status" AS ENUM('active_recurring', 'active_non_recurring', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('active', 'inactive', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled', 'finished');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_source" AS ENUM('manual', 'automation');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'completed', 'snoozed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"issuer" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "automation_run_status" DEFAULT 'running' NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"subscription_id" uuid,
	"description" text NOT NULL,
	"category" text DEFAULT 'service' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"due_date" date NOT NULL,
	"billing_period" varchar(7),
	"status" charge_status DEFAULT 'pending' NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"document" varchar(32),
	"website" text,
	"email" varchar(320),
	"phone" varchar(32),
	"whatsapp" varchar(32),
	"city" text,
	"state" varchar(2),
	"industry" text,
	"lifecycle_status" "lifecycle_status" DEFAULT 'prospect' NOT NULL,
	"relationship_status" "relationship_status" DEFAULT 'inactive' NOT NULL,
	"lead_source" text,
	"referred_by_company_id" uuid,
	"health_status" "health_status" DEFAULT 'good' NOT NULL,
	"last_contact_at" timestamp with time zone,
	"next_contact_at" timestamp with time zone,
	"contact_frequency_months" integer,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"notes_summary" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_contact_frequency_positive" CHECK ("companies"."contact_frequency_months" is null or "companies"."contact_frequency_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "company_tags" (
	"company_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "company_tags_pk" PRIMARY KEY("company_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" varchar(320),
	"phone" varchar(32),
	"whatsapp" varchar(32),
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_financial_contact" boolean DEFAULT false NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"domain" text NOT NULL,
	"registrar" text,
	"registration_date" date,
	"expiration_date" date NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"responsibility" "domain_responsibility" DEFAULT 'client' NOT NULL,
	"registered_under_my_account" boolean DEFAULT false NOT NULL,
	"registered_under_client_document" boolean DEFAULT false NOT NULL,
	"renewal_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"client_renewal_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "domain_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"provider" text NOT NULL,
	"account_email" varchar(320),
	"verified_domain" text,
	"sender_domain" text,
	"sender_address" varchar(320),
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"dashboard_url" text,
	"credential_reference" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"provider" text NOT NULL,
	"plan" text,
	"is_free" boolean DEFAULT false NOT NULL,
	"billing_frequency" "billing_frequency" DEFAULT 'monthly' NOT NULL,
	"cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"paid_by" varchar(32) DEFAULT 'me' NOT NULL,
	"renewal_date" date,
	"dashboard_url" text,
	"notes" text,
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"type" "interaction_type" DEFAULT 'note' NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"title" text NOT NULL,
	"meeting_at" timestamp with time zone NOT NULL,
	"type" "meeting_type" DEFAULT 'other' NOT NULL,
	"meeting_url" text,
	"location" text,
	"notes" text,
	"result" text,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid,
	"channel" "message_channel" NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"template_id" uuid,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" "message_status" NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"channel" "message_channel" DEFAULT 'whatsapp' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"read_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"pipeline_stage_id" uuid NOT NULL,
	"title" text NOT NULL,
	"estimated_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"probability" integer DEFAULT 20 NOT NULL,
	"lead_source" text,
	"expected_close_date" date,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"lost_reason" text,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunities_probability_range" CHECK ("opportunities"."probability" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"payment_method" text,
	"reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(64) NOT NULL,
	"position" integer NOT NULL,
	"color" varchar(32),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_stages_terminal_exclusive" CHECK (not ("pipeline_stages"."is_won" and "pipeline_stages"."is_lost"))
);
--> statement-breakpoint
CREATE TABLE "project_technologies" (
	"project_id" uuid NOT NULL,
	"technology_id" uuid NOT NULL,
	CONSTRAINT "project_technologies_pk" PRIMARY KEY("project_id","technology_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "project_type" DEFAULT 'other' NOT NULL,
	"status" "project_status" DEFAULT 'proposal' NOT NULL,
	"production_url" text,
	"staging_url" text,
	"repository_url" text,
	"start_date" date,
	"delivery_date" date,
	"sold_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cost_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"final_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_terms" text,
	"valid_until" date,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"business_name" text DEFAULT 'Minha Operação' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"theme" "theme_preference" DEFAULT 'system' NOT NULL,
	"domain_alert_days" jsonb DEFAULT '[60,30,15,7,3,0]'::jsonb NOT NULL,
	"default_post_sale_months" integer DEFAULT 6 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"service_id" uuid,
	"description" text NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"frequency" "billing_frequency" DEFAULT 'monthly' NOT NULL,
	"custom_interval_months" integer,
	"billing_day" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_charge_date" date NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_billing_day_range" CHECK ("subscriptions"."billing_day" between 1 and 31),
	CONSTRAINT "subscriptions_custom_interval_positive" CHECK ("subscriptions"."custom_interval_months" is null or "subscriptions"."custom_interval_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid,
	"opportunity_id" uuid,
	"project_id" uuid,
	"charge_id" uuid,
	"domain_id" uuid,
	"meeting_id" uuid,
	"type" text DEFAULT 'general' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"source" "task_source" DEFAULT 'manual' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" varchar(32) DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_referred_by_company_id_companies_id_fk" FOREIGN KEY ("referred_by_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_tags" ADD CONSTRAINT "company_tags_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_tags" ADD CONSTRAINT "company_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_services" ADD CONSTRAINT "email_services_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_services" ADD CONSTRAINT "email_services_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_services" ADD CONSTRAINT "email_services_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_services" ADD CONSTRAINT "hosting_services_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_services" ADD CONSTRAINT "hosting_services_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_services" ADD CONSTRAINT "hosting_services_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_template_id_message_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_pipeline_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("pipeline_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_technologies" ADD CONSTRAINT "project_technologies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_technologies" ADD CONSTRAINT "project_technologies_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_account_uq" ON "accounts" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activities_owner_date_idx" ON "activities" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_company_date_idx" ON "activities" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "automation_runs_job_date_idx" ON "automation_runs" USING btree ("job_name","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "charges_subscription_period_uq" ON "charges" USING btree ("subscription_id","billing_period");--> statement-breakpoint
CREATE INDEX "charges_due_status_idx" ON "charges" USING btree ("owner_user_id","due_date","status");--> statement-breakpoint
CREATE INDEX "charges_company_idx" ON "charges" USING btree ("company_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_owner_name_uq" ON "companies" USING btree ("owner_user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_owner_document_uq" ON "companies" USING btree ("owner_user_id","document");--> statement-breakpoint
CREATE INDEX "companies_owner_lifecycle_idx" ON "companies" USING btree ("owner_user_id","lifecycle_status","archived_at");--> statement-breakpoint
CREATE INDEX "companies_next_contact_idx" ON "companies" USING btree ("owner_user_id","next_contact_at");--> statement-breakpoint
CREATE INDEX "contacts_company_idx" ON "contacts" USING btree ("company_id","archived_at");--> statement-breakpoint
CREATE INDEX "contacts_owner_email_idx" ON "contacts" USING btree ("owner_user_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "domains_owner_domain_uq" ON "domains" USING btree ("owner_user_id","domain");--> statement-breakpoint
CREATE INDEX "domains_expiration_idx" ON "domains" USING btree ("owner_user_id","expiration_date","archived_at");--> statement-breakpoint
CREATE INDEX "domains_company_idx" ON "domains" USING btree ("company_id","archived_at");--> statement-breakpoint
CREATE INDEX "email_services_company_idx" ON "email_services" USING btree ("company_id","archived_at");--> statement-breakpoint
CREATE INDEX "hosting_company_idx" ON "hosting_services" USING btree ("company_id","archived_at");--> statement-breakpoint
CREATE INDEX "interactions_company_date_idx" ON "interactions" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE INDEX "meetings_schedule_idx" ON "meetings" USING btree ("owner_user_id","meeting_at","archived_at");--> statement-breakpoint
CREATE INDEX "message_logs_owner_date_idx" ON "message_logs" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_templates_owner_name_uq" ON "message_templates" USING btree ("owner_user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_idempotency_uq" ON "notifications" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "opportunities_stage_idx" ON "opportunities" USING btree ("owner_user_id","pipeline_stage_id","archived_at");--> statement-breakpoint
CREATE INDEX "opportunities_next_action_idx" ON "opportunities" USING btree ("owner_user_id","next_action_at");--> statement-breakpoint
CREATE INDEX "opportunities_company_idx" ON "opportunities" USING btree ("company_id","archived_at");--> statement-breakpoint
CREATE INDEX "payments_charge_idx" ON "payments" USING btree ("charge_id","paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stages_owner_slug_uq" ON "pipeline_stages" USING btree ("owner_user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stages_owner_position_uq" ON "pipeline_stages" USING btree ("owner_user_id","position");--> statement-breakpoint
CREATE INDEX "projects_company_idx" ON "projects" USING btree ("company_id","archived_at");--> statement-breakpoint
CREATE INDEX "proposals_company_idx" ON "proposals" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "proposals_followup_idx" ON "proposals" USING btree ("owner_user_id","status","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_key_uq" ON "rate_limits" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "services_owner_name_uq" ON "services" USING btree ("owner_user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_expires_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_owner_uq" ON "settings" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_next_charge_idx" ON "subscriptions" USING btree ("owner_user_id","status","next_charge_date");--> statement-breakpoint
CREATE INDEX "subscriptions_company_idx" ON "subscriptions" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_owner_name_uq" ON "tags" USING btree ("owner_user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_owner_idempotency_uq" ON "tasks" USING btree ("owner_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "tasks_due_status_idx" ON "tasks" USING btree ("owner_user_id","due_at","status");--> statement-breakpoint
CREATE INDEX "tasks_company_idx" ON "tasks" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "technologies_owner_name_uq" ON "technologies" USING btree ("owner_user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");