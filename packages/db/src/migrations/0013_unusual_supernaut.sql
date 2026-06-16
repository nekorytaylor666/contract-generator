CREATE TABLE "template_bookmark" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_bookmark_unique" UNIQUE("user_id","template_id")
);
--> statement-breakpoint
ALTER TABLE "template_bookmark" ADD CONSTRAINT "template_bookmark_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_bookmark" ADD CONSTRAINT "template_bookmark_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_bookmark_user_id_idx" ON "template_bookmark" USING btree ("user_id");