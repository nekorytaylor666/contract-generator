CREATE TABLE "counterparty" (
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
--> statement-breakpoint
ALTER TABLE "counterparty" ADD CONSTRAINT "counterparty_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "counterparty_organization_id_idx" ON "counterparty" USING btree ("organization_id");