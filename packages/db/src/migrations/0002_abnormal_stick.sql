CREATE TABLE "document" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"template_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logo" text,
	"style" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_version" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"version" integer NOT NULL,
	"variables" jsonb NOT NULL,
	"logo" text,
	"style" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_version_unique" UNIQUE("document_id","version")
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_organization_id_idx" ON "document" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "document_created_by_idx" ON "document" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "document_template_id_idx" ON "document" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "document_version_document_id_idx" ON "document_version" USING btree ("document_id");