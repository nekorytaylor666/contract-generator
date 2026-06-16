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

export interface PlanFeature {
  label: string;
  value: string;
}

export const subscriptionPlan = pgTable("subscription_plan", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  // Prices in whole tenge (0 = free).
  priceMonthly: integer("price_monthly").notNull().default(0),
  priceYearly: integer("price_yearly"),
  discountLabel: text("discount_label"),
  // Enforced quotas per calendar month. -1 = unlimited.
  downloadQuota: integer("download_quota").notNull().default(0),
  editQuota: integer("edit_quota").notNull().default(0),
  // Display-only capability rows (Поддержка, Риск-аналитика, …).
  features: jsonb("features").$type<PlanFeature[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  // The fallback plan for users without an assigned subscription.
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Per-user monthly usage counters used to enforce plan quotas.
export const subscriptionUsage = pgTable(
  "subscription_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Calendar month, e.g. "2026-06".
    periodKey: text("period_key").notNull(),
    downloadsUsed: integer("downloads_used").notNull().default(0),
    editsUsed: integer("edits_used").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("subscription_usage_user_period_unique").on(
      table.userId,
      table.periodKey
    ),
    index("subscription_usage_user_id_idx").on(table.userId),
  ]
);
