ALTER TABLE "template" ADD COLUMN "document_type" text;--> statement-breakpoint
CREATE INDEX "template_document_type_idx" ON "template" USING btree ("document_type");