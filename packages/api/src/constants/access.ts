// Access levels for sharing a workspace (organization). These map onto
// better-auth organization roles so we can reuse the existing member/invitation
// infrastructure instead of a separate per-document ACL.
//
//   "full"  → role "admin"  (plus "owner", which is always full and immutable)
//   "view"  → role "member" (read-only: cannot edit/save documents)

export const ACCESS_LEVELS = ["full", "view"] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  full: "Полный доступ",
  view: "Просмотр",
};

const FULL_ACCESS_ROLES = new Set(["owner", "admin"]);

export function roleToAccessLevel(
  role: string | null | undefined
): AccessLevel {
  return role && FULL_ACCESS_ROLES.has(role) ? "full" : "view";
}

export function accessLevelToRole(level: AccessLevel): "admin" | "member" {
  return level === "full" ? "admin" : "member";
}

export function canEditDocuments(role: string | null | undefined): boolean {
  return Boolean(role && FULL_ACCESS_ROLES.has(role));
}
