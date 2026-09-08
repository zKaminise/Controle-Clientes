CREATE TYPE "public"."lead_score_level" AS ENUM('BAIXA', 'MEDIA', 'ALTA', 'MUITO_ALTA');--> statement-breakpoint
CREATE TYPE "public"."prospecting_status" AS ENUM('NOVO_LEAD', 'PESQUISANDO', 'PRONTO_PARA_CONTATO', 'CONTATO_WHATSAPP', 'CONTATO_EMAIL', 'CONTATO_TELEFONE', 'SEM_RESPOSTA', 'RESPONDEU', 'INTERESSADO', 'REUNIAO_AGENDADA', 'REUNIAO_REALIZADA', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'FOLLOWUP_FUTURO', 'FECHADO', 'PERDIDO', 'DESCARTADO', 'NUMERO_INVALIDO', 'EMAIL_INVALIDO', 'JA_POSSUI_FORNECEDOR', 'SEM_INTERESSE');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('PENDENTE', 'CONTATADO', 'CONVERTIDO', 'PERDIDO');--> statement-breakpoint
CREATE TYPE "public"."site_analysis_status" AS ENUM('SEM_SITE', 'SITE_RUIM', 'SITE_DEFASADO', 'SITE_MEDIANO', 'SITE_BOM', 'NAO_ANALISADO');--> statement-breakpoint
ALTER TYPE "public"."lifecycle_status" ADD VALUE 'lead' BEFORE 'prospect';--> statement-breakpoint
ALTER TYPE "public"."lifecycle_status" ADD VALUE 'partner';--> statement-breakpoint
CREATE TABLE "digital_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"has_site" boolean DEFAULT false NOT NULL,
	"website_url" text,
	"site_status" "site_analysis_status" DEFAULT 'NAO_ANALISADO' NOT NULL,
	"overall_quality" integer,
	"mobile_quality" integer,
	"speed_quality" integer,
	"design_quality" integer,
	"value_proposition_quality" integer,
	"cta_quality" integer,
	"has_whatsapp_integration" boolean,
	"has_basic_seo" boolean,
	"has_https" boolean,
	"has_broken_links" boolean,
	"has_active_digital_presence" boolean,
	"issues" text,
	"opportunities" text,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"score_level" "lead_score_level" DEFAULT 'BAIXA' NOT NULL,
	"priority" "lead_score_level" DEFAULT 'BAIXA' NOT NULL,
	"score_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digital_analyses_score_range" CHECK ("digital_analyses"."lead_score" between 0 and 100),
	CONSTRAINT "digital_analyses_overall_range" CHECK ("digital_analyses"."overall_quality" is null or "digital_analyses"."overall_quality" between 0 and 5),
	CONSTRAINT "digital_analyses_mobile_range" CHECK ("digital_analyses"."mobile_quality" is null or "digital_analyses"."mobile_quality" between 0 and 5),
	CONSTRAINT "digital_analyses_speed_range" CHECK ("digital_analyses"."speed_quality" is null or "digital_analyses"."speed_quality" between 0 and 5),
	CONSTRAINT "digital_analyses_design_range" CHECK ("digital_analyses"."design_quality" is null or "digital_analyses"."design_quality" between 0 and 5),
	CONSTRAINT "digital_analyses_value_proposition_range" CHECK ("digital_analyses"."value_proposition_quality" is null or "digital_analyses"."value_proposition_quality" between 0 and 5),
	CONSTRAINT "digital_analyses_cta_range" CHECK ("digital_analyses"."cta_quality" is null or "digital_analyses"."cta_quality" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "lead_score_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"rule_key" varchar(80) NOT NULL,
	"label" text NOT NULL,
	"points" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_score_rules_points_range" CHECK ("lead_score_rules"."points" between -100 and 100)
);
--> statement-breakpoint
CREATE TABLE "pipeline_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"reason" text,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"referrer_company_id" uuid NOT NULL,
	"referred_company_id" uuid NOT NULL,
	"status" "referral_status" DEFAULT 'PENDENTE' NOT NULL,
	"notes" text,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_not_self" CHECK ("referrals"."referrer_company_id" <> "referrals"."referred_company_id")
);
--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "lifecycle_status" SET DEFAULT 'lead';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trade_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "primary_contact_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "prospecting_status" "prospecting_status" DEFAULT 'NOVO_LEAD' NOT NULL;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "result" text;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "responsible_user_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reminder_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "responsible_user_id" uuid;--> statement-breakpoint
ALTER TABLE "digital_analyses" ADD CONSTRAINT "digital_analyses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_analyses" ADD CONSTRAINT "digital_analyses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_score_rules" ADD CONSTRAINT "lead_score_rules_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_history" ADD CONSTRAINT "pipeline_history_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_history" ADD CONSTRAINT "pipeline_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_history" ADD CONSTRAINT "pipeline_history_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_history" ADD CONSTRAINT "pipeline_history_from_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_history" ADD CONSTRAINT "pipeline_history_to_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_history" ADD CONSTRAINT "pipeline_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_company_id_companies_id_fk" FOREIGN KEY ("referrer_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_company_id_companies_id_fk" FOREIGN KEY ("referred_company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digital_analyses_owner_company_uq" ON "digital_analyses" USING btree ("owner_user_id","company_id");--> statement-breakpoint
CREATE INDEX "digital_analyses_owner_score_idx" ON "digital_analyses" USING btree ("owner_user_id","lead_score");--> statement-breakpoint
CREATE INDEX "digital_analyses_owner_site_status_idx" ON "digital_analyses" USING btree ("owner_user_id","site_status");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_score_rules_owner_key_uq" ON "lead_score_rules" USING btree ("owner_user_id","rule_key");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_score_rules_owner_position_uq" ON "lead_score_rules" USING btree ("owner_user_id","position");--> statement-breakpoint
CREATE INDEX "pipeline_history_opportunity_date_idx" ON "pipeline_history" USING btree ("opportunity_id","changed_at");--> statement-breakpoint
CREATE INDEX "pipeline_history_owner_date_idx" ON "pipeline_history" USING btree ("owner_user_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_owner_pair_uq" ON "referrals" USING btree ("owner_user_id","referrer_company_id","referred_company_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_company_id","status");--> statement-breakpoint
CREATE INDEX "referrals_referred_idx" ON "referrals" USING btree ("referred_company_id","status");--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_responsible_user_id_users_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_responsible_user_id_users_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_owner_prospecting_idx" ON "companies" USING btree ("owner_user_id","prospecting_status","archived_at");--> statement-breakpoint
INSERT INTO "lead_score_rules" ("id", "owner_user_id", "rule_key", "label", "points", "enabled", "position", "created_at", "updated_at")
SELECT gen_random_uuid(), "users"."id", rules.rule_key, rules.label, rules.points, true, rules.position, now(), now()
FROM "users"
CROSS JOIN (VALUES
  ('no_site', 'Empresa sem site', 30, 0),
  ('outdated_site', 'Site claramente defasado', 25, 1),
  ('mobile_problems', 'Site com problemas graves no celular', 20, 2),
  ('active_presence_no_site', 'Presença digital ativa, mas sem site', 20, 3),
  ('public_phone', 'Telefone ou WhatsApp disponível', 10, 4),
  ('public_email', 'E-mail disponível', 5, 5),
  ('broken_links', 'Site com links quebrados', 10, 6),
  ('weak_cta', 'CTA ausente ou fraco', 10, 7),
  ('modern_complete_site', 'Site moderno e completo', -30, 8)
) AS rules(rule_key, label, points, position)
ON CONFLICT ("owner_user_id", "rule_key") DO NOTHING;
