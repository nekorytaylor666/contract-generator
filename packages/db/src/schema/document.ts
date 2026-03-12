import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { template } from "./template";

export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    templateId: text("template_id")
      .notNull()
      .references(() => template.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    currentVersion: integer("current_version").notNull().default(1),
    variables: jsonb("variables").notNull().default({}),
    logo: text("logo"),
    style: jsonb("style"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("document_organization_id_idx").on(table.organizationId),
    index("document_created_by_idx").on(table.createdBy),
    index("document_template_id_idx").on(table.templateId),
  ]
);

export const documentVersion = pgTable(
  "document_version",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    variables: jsonb("variables").notNull(),
    logo: text("logo"),
    style: jsonb("style"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_version_document_id_idx").on(table.documentId),
    unique("document_version_unique").on(table.documentId, table.version),
  ]
);

export const documentRelations = relations(document, ({ one, many }) => ({
  template: one(template, {
    fields: [document.templateId],
    references: [template.id],
  }),
  organization: one(organization, {
    fields: [document.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [document.createdBy],
    references: [user.id],
  }),
  versions: many(documentVersion),
}));

export const documentVersionRelations = relations(
  documentVersion,
  ({ one }) => ({
    document: one(document, {
      fields: [documentVersion.documentId],
      references: [document.id],
    }),
    creator: one(user, {
      fields: [documentVersion.createdBy],
      references: [user.id],
    }),
  })
);
