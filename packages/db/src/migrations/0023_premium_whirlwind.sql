ALTER TABLE "subscription_plan" ADD COLUMN "review_quota" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_usage" ADD COLUMN "reviews_used" integer DEFAULT 0 NOT NULL;