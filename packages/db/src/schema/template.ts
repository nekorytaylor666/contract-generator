import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const template = pgTable("template", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  price: integer("price").notNull().default(0),
  typstContent: text("typst_content").notNull(),
  variables: jsonb("variables").notNull().default([]),
  currentVersion: integer("current_version").notNull().default(1),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const templateVersion = pgTable(
  "template_version",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => template.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    typstContent: text("typst_content").notNull(),
    variables: jsonb("variables").notNull(),
    changelog: text("changelog"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("template_version_template_id_idx").on(table.templateId),
    unique("template_version_unique").on(table.templateId, table.version),
  ]
);

export const templateRelations = relations(template, ({ many }) => ({
  versions: many(templateVersion),
}));

export const templateVersionRelations = relations(
  templateVersion,
  ({ one }) => ({
    template: one(template, {
      fields: [templateVersion.templateId],
      references: [template.id],
    }),
    creator: one(user, {
      fields: [templateVersion.createdBy],
      references: [user.id],
    }),
  })
);
