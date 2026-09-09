CREATE TABLE "agent_idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"actor_key" varchar(64) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"operation" varchar(96) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"response" jsonb NOT NULL,
	"status_code" integer NOT NULL,
	"entity_type" varchar(80),
	"entity_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_idempotency_keys" ADD CONSTRAINT "agent_idempotency_keys_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_idempotency_actor_key_uq" ON "agent_idempotency_keys" USING btree ("owner_user_id","actor_key","idempotency_key");--> statement-breakpoint
CREATE INDEX "agent_idempotency_expiry_idx" ON "agent_idempotency_keys" USING btree ("expires_at");