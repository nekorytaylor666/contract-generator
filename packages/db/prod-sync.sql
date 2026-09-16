-- Идемпотентная синхронизация прод-схемы с packages/db/src/schema (сгенерировано drizzle-kit generate + пост-обработка).
-- Только добавляет: таблицы, колонки, FK, индексы. Ничего не удаляет и не меняет типы существующих колонок.
-- Применение: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prod-sync.sql
BEGIN;

CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "account_id" text NOT NULL;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "provider_id" text NOT NULL;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "access_token" text;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "refresh_token" text;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "id_token" text;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "access_token_expires_at" timestamp;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "refresh_token_expires_at" timestamp;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "scope" text;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "password" text;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL;

CREATE TABLE IF NOT EXISTS "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "email" text NOT NULL;
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "inviter_id" text NOT NULL;
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "organization_id" text NOT NULL;
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "role" text NOT NULL;
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "status" text NOT NULL;
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "expires_at" timestamp NOT NULL;

CREATE TABLE IF NOT EXISTS "member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "organization_id" text NOT NULL;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "role" text NOT NULL;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"bin" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "slug" text NOT NULL;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "logo" text;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "metadata" text;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "bin" text;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "expires_at" timestamp NOT NULL;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "token" text NOT NULL;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "ip_address" text;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "active_organization_id" text;

CREATE TABLE IF NOT EXISTS "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "secret" text NOT NULL;
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "backup_codes" text NOT NULL;
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL;
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "verified" boolean DEFAULT true;
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "failed_verification_count" integer DEFAULT 0;
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "locked_until" timestamp;

CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"account_type" text,
	"contract_language" text DEFAULT 'ru',
	"onboarding_goals" jsonb,
	"onboarding_legals" jsonb,
	"onboarding_industries" jsonb,
	"onboarding_outreach" text,
	"onboarding_policy_accepted_at" timestamp,
	"onboarding_completed_at" timestamp,
	"product_tour_completed_at" timestamp,
	"position" text,
	"subscription_plan_id" text,
	"subscription_period" text,
	"subscription_expires_at" timestamp,
	"subscription_started_at" timestamp,
	"subscription_cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_phone_number_unique" UNIQUE("phone_number")
);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "image" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "account_type" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "contract_language" text DEFAULT 'ru';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_goals" jsonb;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_legals" jsonb;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_industries" jsonb;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_outreach" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_policy_accepted_at" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "product_tour_completed_at" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "position" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscription_plan_id" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscription_period" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscription_expires_at" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscription_started_at" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscription_cancelled_at" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "identifier" text NOT NULL;
ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "value" text NOT NULL;
ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "expires_at" timestamp NOT NULL;
ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "verification" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "counterparty" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'ТОО' NOT NULL,
	"bin" text DEFAULT '' NOT NULL,
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
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "organization_id" text NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'ТОО' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "bin" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "address" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "phone" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "email" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "bank" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "iban" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "bik" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "kbe" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "knp" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "signatory" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "position" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "basis" text DEFAULT '' NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "counterparty" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "document" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"template_id" text NOT NULL,
	"template_version_id" text,
	"organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"downloaded_at" timestamp,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logo" text,
	"style" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "title" text NOT NULL;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "template_id" text NOT NULL;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "template_version_id" text;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "organization_id" text NOT NULL;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "created_by" text NOT NULL;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "current_version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft' NOT NULL;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "downloaded_at" timestamp;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "variables" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "logo" text;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "style" jsonb;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "document_version" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"version" integer NOT NULL,
	"template_version_id" text,
	"variables" jsonb NOT NULL,
	"logo" text,
	"style" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_version_unique" UNIQUE("document_id","version")
);
ALTER TABLE "document_version" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "document_version" ADD COLUMN IF NOT EXISTS "document_id" text NOT NULL;
ALTER TABLE "document_version" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL;
ALTER TABLE "document_version" ADD COLUMN IF NOT EXISTS "template_version_id" text;
ALTER TABLE "document_version" ADD COLUMN IF NOT EXISTS "variables" jsonb NOT NULL;
ALTER TABLE "document_version" ADD COLUMN IF NOT EXISTS "logo" text;
ALTER TABLE "document_version" ADD COLUMN IF NOT EXISTS "style" jsonb;
ALTER TABLE "document_version" ADD COLUMN IF NOT EXISTS "created_by" text;
ALTER TABLE "document_version" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"inv_id" integer GENERATED ALWAYS AS IDENTITY (sequence name "payment_inv_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"organization_id" text,
	"template_id" text,
	"purpose" text DEFAULT 'template_purchase' NOT NULL,
	"subscription_plan_id" text,
	"subscription_period" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"document_id" text,
	"is_test" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	CONSTRAINT "payment_inv_id_unique" UNIQUE("inv_id")
);
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "inv_id" integer GENERATED ALWAYS AS IDENTITY (sequence name "payment_inv_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "organization_id" text;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "template_id" text;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "purpose" text DEFAULT 'template_purchase' NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "subscription_plan_id" text;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "subscription_period" text;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "amount" integer NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'RUB' NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "document_id" text;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "is_test" boolean DEFAULT true NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;

CREATE TABLE IF NOT EXISTS "requisite" (
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
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "organization_id" text NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'ТОО' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "inn" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "address" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "phone" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "email" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "bank" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "iban" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "bik" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "kbe" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "knp" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "signatory" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "position" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "basis" text DEFAULT '' NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "requisite" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "subscription_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_monthly" integer DEFAULT 0 NOT NULL,
	"price_quarterly" integer,
	"price_yearly" integer,
	"discount_label" text,
	"download_quota" integer DEFAULT 0 NOT NULL,
	"edit_quota" integer DEFAULT 0 NOT NULL,
	"review_quota" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "description" text DEFAULT '' NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "price_monthly" integer DEFAULT 0 NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "price_quarterly" integer;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "price_yearly" integer;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "discount_label" text;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "download_quota" integer DEFAULT 0 NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "edit_quota" integer DEFAULT 0 NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "review_quota" integer DEFAULT 0 NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "features" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "subscription_plan" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "subscription_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_key" text NOT NULL,
	"downloads_used" integer DEFAULT 0 NOT NULL,
	"edits_used" integer DEFAULT 0 NOT NULL,
	"reviews_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_usage_user_period_unique" UNIQUE("user_id","period_key")
);
ALTER TABLE "subscription_usage" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "subscription_usage" ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL;
ALTER TABLE "subscription_usage" ADD COLUMN IF NOT EXISTS "period_key" text NOT NULL;
ALTER TABLE "subscription_usage" ADD COLUMN IF NOT EXISTS "downloads_used" integer DEFAULT 0 NOT NULL;
ALTER TABLE "subscription_usage" ADD COLUMN IF NOT EXISTS "edits_used" integer DEFAULT 0 NOT NULL;
ALTER TABLE "subscription_usage" ADD COLUMN IF NOT EXISTS "reviews_used" integer DEFAULT 0 NOT NULL;
ALTER TABLE "subscription_usage" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "subscription_usage" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "template" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price" integer DEFAULT 0 NOT NULL,
	"download_price" integer DEFAULT 0 NOT NULL,
	"typst_content" text NOT NULL,
	"localized_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"industries" text[] DEFAULT '{}'::text[] NOT NULL,
	"contract_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"payment_terms" text[] DEFAULT '{}'::text[] NOT NULL,
	"participants" text[] DEFAULT '{}'::text[] NOT NULL,
	"document_type" text,
	"related_template_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"validity_seconds" integer,
	"preview_images" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "title" text NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "price" integer DEFAULT 0 NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "download_price" integer DEFAULT 0 NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "typst_content" text NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "localized_content" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "variables" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "current_version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT false NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "categories" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "industries" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "contract_types" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "payment_terms" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "participants" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "document_type" text;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "related_template_ids" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "validity_seconds" integer;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "preview_images" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "template_bookmark" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_bookmark_unique" UNIQUE("user_id","template_id")
);
ALTER TABLE "template_bookmark" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "template_bookmark" ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL;
ALTER TABLE "template_bookmark" ADD COLUMN IF NOT EXISTS "template_id" text NOT NULL;
ALTER TABLE "template_bookmark" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

CREATE TABLE IF NOT EXISTS "template_version" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"version" integer NOT NULL,
	"typst_content" text NOT NULL,
	"variables" jsonb NOT NULL,
	"changelog" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_version_unique" UNIQUE("template_id","version")
);
ALTER TABLE "template_version" ADD COLUMN IF NOT EXISTS "id" text PRIMARY KEY NOT NULL;
ALTER TABLE "template_version" ADD COLUMN IF NOT EXISTS "template_id" text NOT NULL;
ALTER TABLE "template_version" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL;
ALTER TABLE "template_version" ADD COLUMN IF NOT EXISTS "typst_content" text NOT NULL;
ALTER TABLE "template_version" ADD COLUMN IF NOT EXISTS "variables" jsonb NOT NULL;
ALTER TABLE "template_version" ADD COLUMN IF NOT EXISTS "changelog" text;
ALTER TABLE "template_version" ADD COLUMN IF NOT EXISTS "created_by" text;
ALTER TABLE "template_version" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

DO $$ BEGIN
  ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "counterparty" ADD CONSTRAINT "counterparty_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document" ADD CONSTRAINT "document_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document" ADD CONSTRAINT "document_template_version_id_template_version_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_version"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document" ADD CONSTRAINT "document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document" ADD CONSTRAINT "document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document_version" ADD CONSTRAINT "document_version_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document_version" ADD CONSTRAINT "document_version_template_version_id_template_version_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_version"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "document_version" ADD CONSTRAINT "document_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment" ADD CONSTRAINT "payment_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "requisite" ADD CONSTRAINT "requisite_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "template_bookmark" ADD CONSTRAINT "template_bookmark_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "template_bookmark" ADD CONSTRAINT "template_bookmark_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "template_version" ADD CONSTRAINT "template_version_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "template_version" ADD CONSTRAINT "template_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "invitation" USING btree ("email");
CREATE INDEX IF NOT EXISTS "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "member_userId_idx" ON "member" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "member_organizationId_idx" ON "member" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "two_factor_userId_idx" ON "two_factor" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" USING btree ("identifier");
CREATE INDEX IF NOT EXISTS "counterparty_organization_id_idx" ON "counterparty" USING btree ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "counterparty_org_bin_unique" ON "counterparty" USING btree ("organization_id","bin") WHERE "counterparty"."bin" <> '';
CREATE INDEX IF NOT EXISTS "document_organization_id_idx" ON "document" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "document_created_by_idx" ON "document" USING btree ("created_by");
CREATE INDEX IF NOT EXISTS "document_template_id_idx" ON "document" USING btree ("template_id");
CREATE INDEX IF NOT EXISTS "document_version_document_id_idx" ON "document_version" USING btree ("document_id");
CREATE INDEX IF NOT EXISTS "payment_user_id_idx" ON "payment" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "payment_template_id_idx" ON "payment" USING btree ("template_id");
CREATE INDEX IF NOT EXISTS "requisite_organization_id_idx" ON "requisite" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "subscription_usage_user_id_idx" ON "subscription_usage" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "template_categories_idx" ON "template" USING gin ("categories");
CREATE INDEX IF NOT EXISTS "template_industries_idx" ON "template" USING gin ("industries");
CREATE INDEX IF NOT EXISTS "template_document_type_idx" ON "template" USING btree ("document_type");
CREATE INDEX IF NOT EXISTS "template_validity_seconds_idx" ON "template" USING btree ("validity_seconds");
CREATE INDEX IF NOT EXISTS "template_bookmark_user_id_idx" ON "template_bookmark" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "template_version_template_id_idx" ON "template_version" USING btree ("template_id");

COMMIT;
