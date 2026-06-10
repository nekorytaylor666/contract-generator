import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";
import { template } from "./template";

export const payment = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    // Numeric invoice id sent to Robokassa as InvId. Auto-assigned by Postgres
    // so it's unique and monotonically increasing.
    invId: integer("inv_id").generatedAlwaysAsIdentity().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    templateId: text("template_id").references(() => template.id, {
      onDelete: "set null",
    }),
    purpose: text("purpose").notNull().default("template_purchase"),
    // Amount in minor units (copy of template.price at purchase time).
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("RUB"),
    // pending | paid | failed
    status: text("status").notNull().default("pending"),
    isTest: boolean("is_test").notNull().default(true),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),
  },
  (table) => [
    unique("payment_inv_id_unique").on(table.invId),
    index("payment_user_id_idx").on(table.userId),
    index("payment_template_id_idx").on(table.templateId),
  ]
);

export const paymentRelations = relations(payment, ({ one }) => ({
  user: one(user, {
    fields: [payment.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [payment.organizationId],
    references: [organization.id],
  }),
  template: one(template, {
    fields: [payment.templateId],
    references: [template.id],
  }),
}));
