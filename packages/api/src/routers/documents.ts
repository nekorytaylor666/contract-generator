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

import { protectedProcedure, router } from "../index";

export const documentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.session.activeOrganizationId;
    if (!orgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active organization",
      });
    }

    const documents = await db
      .select({
        id: document.id,
        title: document.title,
        templateId: document.templateId,
        templateTitle: template.title,
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

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.session.session.activeOrganizationId;
      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

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

  save: protectedProcedure
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
      const orgId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;
      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get template title for default document name
      const [tmpl] = await db
        .select({ title: template.title })
        .from(template)
        .where(eq(template.id, input.templateId))
        .limit(1);

      if (!tmpl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
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

        // Save version snapshot
        await db.insert(documentVersion).values({
          id: randomUUID(),
          documentId: existing.id,
          version: newVersion,
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
          })
          .where(eq(document.id, existing.id));

        return { id: existing.id, version: newVersion };
      }

      // Create new document
      const docId = randomUUID();
      const title = input.title || tmpl.title;

      await db.insert(document).values({
        id: docId,
        title,
        templateId: input.templateId,
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
        variables: input.variables,
        logo: input.logo ?? null,
        style: input.style ?? null,
        createdBy: userId,
      });

      return { id: docId, version: 1 };
    }),

  listVersions: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.session.session.activeOrganizationId;
      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

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

  getVersion: protectedProcedure
    .input(z.object({ documentId: z.string(), version: z.number() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.session.session.activeOrganizationId;
      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

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

  revert: protectedProcedure
    .input(z.object({ documentId: z.string(), version: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;
      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

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
