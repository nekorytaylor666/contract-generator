CREATE TABLE "subscription_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_monthly" integer DEFAULT 0 NOT NULL,
	"price_yearly" integer,
	"discount_label" text,
	"download_quota" integer DEFAULT 0 NOT NULL,
	"edit_quota" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_key" text NOT NULL,
	"downloads_used" integer DEFAULT 0 NOT NULL,
	"edits_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_usage_user_period_unique" UNIQUE("user_id","period_key")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "subscription_plan_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "subscription_period" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "subscription_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_usage_user_id_idx" ON "subscription_usage" USING btree ("user_id");