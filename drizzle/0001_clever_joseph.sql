CREATE TABLE "integration_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text,
	"metadata" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_identities" ADD CONSTRAINT "integration_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_identity_unique" ON "integration_identities" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "integration_identity_user_idx" ON "integration_identities" USING btree ("user_id");