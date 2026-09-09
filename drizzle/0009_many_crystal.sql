CREATE TYPE "public"."prospecting_batch_status" AS ENUM('draft', 'researching', 'review', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."prospecting_candidate_status" AS ENUM('review', 'approved', 'ignored', 'later', 'promoted');--> statement-breakpoint
CREATE TABLE "prospecting_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"industry" text,
	"city" text,
	"state" varchar(2),
	"desired_quantity" integer DEFAULT 20 NOT NULL,
	"criteria" text,
	"status" "prospecting_batch_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospecting_batches_quantity_range" CHECK ("prospecting_batches"."desired_quantity" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "prospecting_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"industry" text,
	"city" text,
	"state" varchar(2),
	"public_phone" varchar(32),
	"public_email" varchar(320),
	"website" text,
	"instagram" text,
	"other_networks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"digital_presence" text,
	"has_site" boolean DEFAULT false NOT NULL,
	"site_status" "site_analysis_status" DEFAULT 'NAO_ANALISADO' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"score_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observations" text,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_message" text,
	"status" "prospecting_candidate_status" DEFAULT 'review' NOT NULL,
	"promoted_company_id" uuid,
	"source_fingerprint" varchar(64),
	"researched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospecting_candidates_score_range" CHECK ("prospecting_candidates"."score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "first_post_sale_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "recurring_post_sale_days" integer DEFAULT 180 NOT NULL;--> statement-breakpoint
ALTER TABLE "prospecting_batches" ADD CONSTRAINT "prospecting_batches_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospecting_candidates" ADD CONSTRAINT "prospecting_candidates_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospecting_candidates" ADD CONSTRAINT "prospecting_candidates_batch_id_prospecting_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."prospecting_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospecting_candidates" ADD CONSTRAINT "prospecting_candidates_promoted_company_id_companies_id_fk" FOREIGN KEY ("promoted_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospecting_batches_owner_status_idx" ON "prospecting_batches" USING btree ("owner_user_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "prospecting_candidates_batch_fingerprint_uq" ON "prospecting_candidates" USING btree ("batch_id","source_fingerprint");--> statement-breakpoint
CREATE INDEX "prospecting_candidates_batch_status_idx" ON "prospecting_candidates" USING btree ("batch_id","status","score");--> statement-breakpoint
CREATE INDEX "prospecting_candidates_owner_company_idx" ON "prospecting_candidates" USING btree ("owner_user_id","company_name");