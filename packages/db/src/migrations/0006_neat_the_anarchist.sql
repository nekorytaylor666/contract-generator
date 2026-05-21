ALTER TABLE "user" ADD COLUMN "onboarding_goals" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_legals" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_industries" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_outreach" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_policy_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed_at" timestamp;