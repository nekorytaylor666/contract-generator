import { randomUUID } from "node:crypto";
import { db } from "@contract-builder/db";
import { user } from "@contract-builder/db/schema/auth";
import {
  document,
  documentVersion,
} from "@contract-builder/db/schema/document";
import {
  template,
  templateVersion,
} from "@contract-builder/db/schema/template";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { editorProcedure, orgProcedure, router } from "../index";
import { consumeQuota } from "../lib/subscription";

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
  list: orgProcedure.query(async ({ ctx }) => {
    const orgId = ctx.orgId;

    const documents = await db
      .select({
        id: document.id,
        title: document.title,
        templateId: document.templateId,
        templateTitle: template.title,
        categories: template.categories,
        documentType: template.documentType,
        status: document.status,
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

    return documents;
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

      if (!input.documentId) {
        await consumeEditQuotaOrThrow(userId);
      }

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

      // Resolve the templateVersion to pin this document to. Always the latest
      // for this template; legacy templates with no versions get one created here.
      let pinnedVersionId: string;
      const [latestVersion] = await db
        .select({ id: templateVersion.id })
        .from(templateVersion)
        .where(eq(templateVersion.templateId, tmpl.id))
        .orderBy(desc(templateVersion.version))
        .limit(1);
      if (latestVersion) {
        pinnedVersionId = latestVersion.id;
      } else {
        pinnedVersionId = randomUUID();
        await db.insert(templateVersion).values({
          id: pinnedVersionId,
          templateId: tmpl.id,
          version: tmpl.currentVersion,
          typstContent: tmpl.typstContent,
          variables: tmpl.variables,
          changelog: "backfill",
          createdBy: userId,
        });
      }

      if (input.documentId) {
        // Update existing document - create new version
        const [existing] = await db
          .select()
          .from(document)
          .where(
            and(
              eq(document.id, input.documentId),
              eq(document.organizationId, orgId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Document not found",
          });
        }

        const newVersion = existing.currentVersion + 1;

        // Save version snapshot — pin to the same template version the document
        // was originally pinned to (don't auto-upgrade on edit).
        await db.insert(documentVersion).values({
          id: randomUUID(),
          documentId: existing.id,
          version: newVersion,
          templateVersionId: existing.templateVersionId ?? pinnedVersionId,
          variables: input.variables,
          logo: input.logo ?? null,
          style: input.style ?? null,
          createdBy: userId,
        });

        // Update document with latest data
        await db
          .update(document)
          .set({
            variables: input.variables,
            logo: input.logo ?? null,
            style: input.style ?? null,
            currentVersion: newVersion,
            title: input.title ?? existing.title,
            templateVersionId: existing.templateVersionId ?? pinnedVersionId,
          })
          .where(eq(document.id, existing.id));

        return { id: existing.id, version: newVersion };
      }

      // Create new document — pin to current latest template version
      const docId = randomUUID();
      const title = input.title || tmpl.title;

      await db.insert(document).values({
        id: docId,
        title,
        templateId: input.templateId,
        templateVersionId: pinnedVersionId,
        organizationId: orgId,
        createdBy: userId,
        currentVersion: 1,
        variables: input.variables,
        logo: input.logo ?? null,
        style: input.style ?? null,
      });

      // Save first version
      await db.insert(documentVersion).values({
        id: randomUUID(),
        documentId: docId,
        version: 1,
        templateVersionId: pinnedVersionId,
        variables: input.variables,
        logo: input.logo ?? null,
        style: input.style ?? null,
        createdBy: userId,
      });

      return { id: docId, version: 1 };
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

      const [doc] = await db
        .select()
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

      // Get the version to revert to
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

      // Create a new version with the old data (revert = new version with old content)
      const newVersion = doc.currentVersion + 1;

      await db.insert(documentVersion).values({
        id: randomUUID(),
        documentId: doc.id,
        version: newVersion,
        variables: ver.variables,
        logo: ver.logo,
        style: ver.style,
        createdBy: userId,
      });

      await db
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
    }),
});
