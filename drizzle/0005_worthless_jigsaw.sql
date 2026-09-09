CREATE TYPE "public"."agent_integration_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "agent_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"token_prefix" varchar(24) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"integration_id" uuid,
	"owner_user_id" uuid,
	"token_prefix" varchar(24),
	"method" varchar(12) NOT NULL,
	"path" text NOT NULL,
	"required_scope" varchar(80),
	"status_code" integer NOT NULL,
	"error_code" varchar(80),
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"client_id" varchar(96) NOT NULL,
	"name" text NOT NULL,
	"audience" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "agent_integration_status" DEFAULT 'active' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_integrations_rate_limit_range" CHECK ("agent_integrations"."rate_limit_per_minute" between 1 and 600)
);
--> statement-breakpoint
CREATE TABLE "agent_rate_limit_buckets" (
	"bucket_key" varchar(128) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_rate_limit_buckets_pk" PRIMARY KEY("bucket_key","window_start"),
	CONSTRAINT "agent_rate_limit_buckets_count_positive" CHECK ("agent_rate_limit_buckets"."request_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "agent_access_tokens" ADD CONSTRAINT "agent_access_tokens_integration_id_agent_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."agent_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_integration_id_agent_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."agent_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_integrations" ADD CONSTRAINT "agent_integrations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_access_tokens_hash_uq" ON "agent_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "agent_access_tokens_integration_expiry_idx" ON "agent_access_tokens" USING btree ("integration_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_audit_logs_request_id_uq" ON "agent_audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "agent_audit_logs_integration_date_idx" ON "agent_audit_logs" USING btree ("integration_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_audit_logs_owner_date_idx" ON "agent_audit_logs" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_integrations_client_id_uq" ON "agent_integrations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "agent_integrations_owner_status_idx" ON "agent_integrations" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "agent_rate_limit_buckets_window_idx" ON "agent_rate_limit_buckets" USING btree ("window_start");