import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth";

// Company requisites shown in generated contracts. Scoped to the organization
// so the whole team shares the same set.
export const requisite = pgTable(
  "requisite",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // ТОО | ИП | АО | Физ. лицо
    type: text("type").notNull().default("ТОО"),
    inn: text("inn").notNull().default(""),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    bank: text("bank").notNull().default(""),
    iban: text("iban").notNull().default(""),
    bik: text("bik").notNull().default(""),
    kbe: text("kbe").notNull().default(""),
    knp: text("knp").notNull().default(""),
    signatory: text("signatory").notNull().default(""),
    position: text("position").notNull().default(""),
    basis: text("basis").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("requisite_organization_id_idx").on(table.organizationId)]
);
