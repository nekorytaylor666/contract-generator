CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisite" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'ТОО' NOT NULL,
	"inn" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"bank" text DEFAULT '' NOT NULL,
	"iban" text DEFAULT '' NOT NULL,
	"bik" text DEFAULT '' NOT NULL,
	"kbe" text DEFAULT '' NOT NULL,
	"knp" text DEFAULT '' NOT NULL,
	"signatory" text DEFAULT '' NOT NULL,
	"position" text DEFAULT '' NOT NULL,
	"basis" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "contract_language" text DEFAULT 'ru';--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "subscription_plan_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "subscription_period" text;--> statement-breakpoint
ALTER TABLE "subscription_plan" ADD COLUMN "price_quarterly" integer;--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "preview_images" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisite" ADD CONSTRAINT "requisite_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "two_factor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "requisite_organization_id_idx" ON "requisite" USING btree ("organization_id");