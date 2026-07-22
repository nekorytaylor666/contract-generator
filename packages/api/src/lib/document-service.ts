import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import {
  document,
  documentVersion,
} from "@contract-builder/db/schema/document";
import { payment } from "@contract-builder/db/schema/payment";
import {
  type template,
  templateVersion,
} from "@contract-builder/db/schema/template";
import { and, desc, eq, inArray } from "drizzle-orm";

import { resolveLocalized } from "../constants/template-options";

type TemplateRow = typeof template.$inferSelect;

/** Обычный клиент БД или транзакция — вебхук создаёт документ внутри
 * db.transaction, роутер documents работает с глобальным db. */
export type DbClient =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Latest template version id to pin a document to. Legacy templates that
 * predate versioning get a backfill version created on the fly — same
 * behavior the documents.save mutation always had.
 */
export async function pinLatestTemplateVersion(
  dbc: DbClient,
  tmpl: TemplateRow,
  userId: string
): Promise<string> {
  const [latest] = await dbc
    .select({ id: templateVersion.id })
    .from(templateVersion)
    .where(eq(templateVersion.templateId, tmpl.id))
    .orderBy(desc(templateVersion.version))
    .limit(1);
  if (latest) {
    return latest.id;
  }
  const id = randomUUID();
  await dbc.insert(templateVersion).values({
    id,
    templateId: tmpl.id,
    version: tmpl.currentVersion,
    typstContent: tmpl.typstContent,
    variables: tmpl.variables,
    changelog: "backfill",
    createdBy: userId,
  });
  return id;
}

/**
 * Creates a document (+ its first version) from an already-loaded template.
 * Shared between the documents.save mutation and the Robokassa webhook, which
 * creates the draft server-side on a paid template purchase — the buyer may
 * never come back to the success page, but the document must still land in
 * «Мои документы».
 */
export async function createDocumentFromTemplate(
  dbc: DbClient,
  params: {
    tmpl: TemplateRow;
    orgId: string;
    userId: string;
    title?: string;
    /** UI language at creation time — names the document after the template's
     * title in that language. */
    locale?: string;
    variables?: Record<string, unknown>;
    logo?: string | null;
    style?: { font?: string; preset?: string } | null;
  }
): Promise<{ id: string; version: number }> {
  const { tmpl } = params;
  const pinnedVersionId = await pinLatestTemplateVersion(
    dbc,
    tmpl,
    params.userId
  );
  const docId = randomUUID();
  const title =
    params.title ||
    resolveLocalized(
      { title: tmpl.title, description: null, typstContent: "" },
      tmpl.localizedContent,
      params.locale
    ).title;
  const variables = params.variables ?? {};

  await dbc.insert(document).values({
    id: docId,
    title,
    templateId: tmpl.id,
    templateVersionId: pinnedVersionId,
    organizationId: params.orgId,
    createdBy: params.userId,
    currentVersion: 1,
    variables,
    logo: params.logo ?? null,
    style: params.style ?? null,
  });
  await dbc.insert(documentVersion).values({
    id: randomUUID(),
    documentId: docId,
    version: 1,
    templateVersionId: pinnedVersionId,
    variables,
    logo: params.logo ?? null,
    style: params.style ?? null,
    createdBy: params.userId,
  });

  return { id: docId, version: 1 };
}

/**
 * Whether the user made a paid direct purchase of edit access to this
 * template ("template_edit", or the legacy "template_purchase"). Such a
 * purchase exempts document creation from the subscription edit quota —
 * the buyer paid for this template precisely because the quota ran out.
 */
export async function hasPaidEditPurchase(
  userId: string,
  templateId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: payment.id })
    .from(payment)
    .where(
      and(
        eq(payment.userId, userId),
        eq(payment.templateId, templateId),
        eq(payment.status, "paid"),
        inArray(payment.purpose, ["template_edit", "template_purchase"])
      )
    )
    .limit(1);
  return Boolean(row);
}
