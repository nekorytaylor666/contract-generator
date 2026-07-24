import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth";

// Контрагенты — вторые стороны договоров. Создаются из модалки «Контрагенты»
// на странице документов или при заполнении договора. Org-scoped: набор общий
// для всей команды.
export const counterparty = pgTable(
  "counterparty",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // ТОО | ИП | АО
    type: text("type").notNull().default("ТОО"),
    bin: text("bin").notNull().default(""),
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
  (table) => [
    index("counterparty_organization_id_idx").on(table.organizationId),
  ]
);
