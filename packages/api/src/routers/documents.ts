import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import {
  document,
  documentVersion,
} from "@contract-builder/db/schema/document";
import { template } from "@contract-builder/db/schema/template";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { resolveLocalized } from "../constants/template-options";
import { editorProcedure, orgProcedure, router } from "../index";
import {
  createDocumentFromTemplate,
  hasPaidEditPurchase,
  pinLatestTemplateVersion,
} from "../lib/document-service";
import { consumeQuota, getEffectivePlan } from "../lib/subscription";

// Статусы, которые пользователь ставит вручную из меню карточки. Значения
// «расторгнут»/«ожидает подписи» зарезервированы под будущий флоу подписания
// и руками не ставятся.
const settableStatusSchema = z.enum([
  "draft",
  "in_progress",
  "signed",
  "expired",
]);

// Creating a document consumes one "edit" quota of the user's plan.
async function consumeEditQuotaOrThrow(userId: string) {
  const quota = await consumeQuota(userId, "edit");
  if (!quota.allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Лимит редактирований исчерпан. Оформите подписку.",
    });
  }
}

export const documentsRouter = router({
  list: orgProcedure
    .input(z.object({ locale: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.orgId;

      const documents = await db
        .select({
          id: document.id,
          title: document.title,
          templateId: document.templateId,
          templateTitle: template.title,
          templateLocalized: template.localizedContent,
          categories: template.categories,
          documentType: template.documentType,
          status: document.status,
          downloadedAt: document.downloadedAt,
          currentVersion: document.currentVersion,
          createdBy: document.createdBy,
          authorName: user.name,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        })
        .from(document)
        .leftJoin(template, eq(document.templateId, template.id))
        .leftJoin(user, eq(document.createdBy, user.id))
        .where(eq(document.organizationId, orgId))
        .orderBy(desc(document.updatedAt));

      // Show the template's name in the requested UI language; don't ship the
      // heavy localizedContent bodies to the client.
      return documents.map(({ templateLocalized, ...doc }) => ({
        ...doc,
        templateTitle: doc.templateTitle
          ? resolveLocalized(
              { title: doc.templateTitle, description: null, typstContent: "" },
              templateLocalized,
              input?.locale
            ).title
          : doc.templateTitle,
      }));
    }),

  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.orgId;

      const [found] = await db
        .select()
        .from(document)
        .where(
          and(eq(document.id, input.id), eq(document.organizationId, orgId))
        )
        .limit(1);

      if (!found) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      return found;
    }),

  save: editorProcedure
    .input(
      z.object({
        documentId: z.string().optional(),
        templateId: z.string(),
        title: z.string().optional(),
        // UI language at creation time — a new document is named after the
        // template's title in that language.
        locale: z.string().optional(),
        variables: z.record(z.string(), z.unknown()),
        logo: z.string().nullable().optional(),
        style: z
          .object({
            font: z.string().optional(),
            preset: z.string().optional(),
          })
          .nullable()
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.orgId;
      const userId = ctx.session.user.id;

      // Load full template — needed for backfill if no version exists yet.
      const [tmpl] = await db
        .select()
        .from(template)
        .where(eq(template.id, input.templateId))
        .limit(1);

      if (!tmpl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Прямая покупка шаблона — это и есть право создавать из него документы:
      // не списываем квоту подписки (покупают как раз те, у кого она кончилась).
      if (!(input.documentId || (await hasPaidEditPurchase(userId, tmpl.id)))) {
        await consumeEditQuotaOrThrow(userId);
      }

      if (input.documentId) {
        const targetDocumentId = input.documentId;
        const pinnedVersionId = await pinLatestTemplateVersion(
          db,
          tmpl,
          userId
        );
        // Update existing document - create new version. Всё в транзакции под
        // блокировкой строки: параллельное скачивание (issueDocumentDownload)
        // не успеет «выдать» договор между проверкой downloadedAt и записью.
        return await db.transaction(async (tx) => {
          const [existing] = await tx
            .select()
            .from(document)
            .where(
              and(
                eq(document.id, targetDocumentId),
                eq(document.organizationId, orgId)
              )
            )
            .for("update")
            .limit(1);

          if (!existing) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Document not found",
            });
          }

          // Скачанный договор считается выданным: правки закрыты, иначе одну
          // покупку можно было бы бесконечно переделывать под новые договоры.
          if (existing.downloadedAt) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Договор уже скачан и закрыт для редактирования",
            });
          }

          const newVersion = existing.currentVersion + 1;

          // Save version snapshot — re-pin to the LATEST template version. The
          // builder renders and downloads the live template, so keeping the
          // creation-time pin made admin edits invisible in saved documents;
          // the per-version pin below still records what was live at save time.
          await tx.insert(documentVersion).values({
            id: randomUUID(),
            documentId: existing.id,
            version: newVersion,
            templateVersionId: pinnedVersionId,
            variables: input.variables,
            logo: input.logo ?? null,
            style: input.style ?? null,
            createdBy: userId,
          });

          // Update document with latest data
          await tx
            .update(document)
            .set({
              variables: input.variables,
              logo: input.logo ?? null,
              style: input.style ?? null,
              currentVersion: newVersion,
              title: input.title ?? existing.title,
              templateVersionId: pinnedVersionId,
            })
            .where(eq(document.id, existing.id));

          return { id: existing.id, version: newVersion };
        });
      }

      // Create new document — same shared path the payment webhook uses.
      return await createDocumentFromTemplate(db, {
        tmpl,
        orgId,
        userId,
        title: input.title,
        locale: input.locale,
        variables: input.variables,
        logo: input.logo ?? null,
        style: input.style ?? null,
      });
    }),

  // Смена статуса карточки (меню «…»). Доступна на платной подписке —
  // на дефолтном «Разовом» тарифе сервер отказывает.
  setStatus: editorProcedure
    .input(
      z.object({
        documentId: z.string(),
        status: settableStatusSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const plan = await getEffectivePlan(ctx.session.user.id);
      if (!plan || plan.isDefault) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Смена статуса доступна на платной подписке.",
        });
      }

      const [updated] = await db
        .update(document)
        .set({ status: input.status })
        .where(
          and(
            eq(document.id, input.documentId),
            eq(document.organizationId, ctx.orgId)
          )
        )
        .returning({ id: document.id, status: document.status });
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }
      return updated;
    }),

  // Удаление документа из меню карточки (версии уйдут каскадом).
  delete: editorProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await db
        .delete(document)
        .where(
          and(
            eq(document.id, input.documentId),
            eq(document.organizationId, ctx.orgId)
          )
        )
        .returning({ id: document.id });
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }
      return deleted;
    }),

  listVersions: orgProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.orgId;

      // Verify document belongs to org
      const [doc] = await db
        .select({ id: document.id })
        .from(document)
        .where(
          and(
            eq(document.id, input.documentId),
            eq(document.organizationId, orgId)
          )
        )
        .limit(1);

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      const versions = await db
        .select({
          id: documentVersion.id,
          version: documentVersion.version,
          createdAt: documentVersion.createdAt,
          createdBy: documentVersion.createdBy,
        })
        .from(documentVersion)
        .where(eq(documentVersion.documentId, input.documentId))
        .orderBy(desc(documentVersion.version));

      return versions;
    }),

  getVersion: orgProcedure
    .input(z.object({ documentId: z.string(), version: z.number() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.orgId;

      // Verify document belongs to org
      const [doc] = await db
        .select({ id: document.id })
        .from(document)
        .where(
          and(
            eq(document.id, input.documentId),
            eq(document.organizationId, orgId)
          )
        )
        .limit(1);

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      const [ver] = await db
        .select()
        .from(documentVersion)
        .where(
          and(
            eq(documentVersion.documentId, input.documentId),
            eq(documentVersion.version, input.version)
          )
        )
        .limit(1);

      if (!ver) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      return ver;
    }),

  revert: editorProcedure
    .input(z.object({ documentId: z.string(), version: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.orgId;
      const userId = ctx.session.user.id;

      // Транзакция с блокировкой строки — как в save: откат не должен
      // проскочить параллельно с «выдачей» договора при скачивании.
      return await db.transaction(async (tx) => {
        const [doc] = await tx
          .select()
          .from(document)
          .where(
            and(
              eq(document.id, input.documentId),
              eq(document.organizationId, orgId)
            )
          )
          .for("update")
          .limit(1);

        if (!doc) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Document not found",
          });
        }

        if (doc.downloadedAt) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Договор уже скачан и закрыт для редактирования",
          });
        }

        // Get the version to revert to
        const [ver] = await tx
          .select()
          .from(documentVersion)
          .where(
            and(
              eq(documentVersion.documentId, input.documentId),
              eq(documentVersion.version, input.version)
            )
          )
          .limit(1);

        if (!ver) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Version not found",
          });
        }

        // Create a new version with the old data (revert = new version with old content)
        const newVersion = doc.currentVersion + 1;

        await tx.insert(documentVersion).values({
          id: randomUUID(),
          documentId: doc.id,
          version: newVersion,
          templateVersionId: ver.templateVersionId ?? doc.templateVersionId,
          variables: ver.variables,
          logo: ver.logo,
          style: ver.style,
          createdBy: userId,
        });

        await tx
          .update(document)
          .set({
            variables: ver.variables,
            logo: ver.logo,
            style: ver.style as { font?: string; preset?: string } | null,
            currentVersion: newVersion,
          })
          .where(eq(document.id, doc.id));

        return {
          id: doc.id,
          version: newVersion,
          revertedFrom: input.version,
        };
      });
    }),
});
