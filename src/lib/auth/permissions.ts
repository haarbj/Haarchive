// Content-collaboration permissions, plus "private_coach" (added for the
// private 1-on-1 coaching product -- see
// 20260825050000_private_coaching_permission_and_audit.sql for why it
// reuses this table/enum rather than a second, structurally-identical
// admin-grant mechanism). All three are independent of both admin (still a
// pure ADMIN_EMAILS env allowlist, never grantable here) and
// training-dashboard access (still team_memberships.role). A user can hold
// any combination of these, which is why they're a set rather than a
// single role field.
export type ContentPermission = "content_contributor" | "reviewer" | "private_coach";

export const CONTENT_PERMISSIONS: ContentPermission[] = ["content_contributor", "reviewer", "private_coach"];

// The subset of CONTENT_PERMISSIONS that actually gates the content-
// collaboration workspace (/contribute). private_coach shares this same
// table/enum (see 20260825050000's own comment on why) but is a wholly
// separate capability -- the private-coaching product, not content
// collaboration -- so it must NOT count toward "has a content permission."
// Keep this in sync if a future unrelated capability ever joins the enum
// the same way private_coach did.
const CONTENT_COLLAB_PERMISSIONS: ContentPermission[] = ["content_contributor", "reviewer"];

export function hasContentPermission(
  permissions: ContentPermission[],
  permission: ContentPermission,
): boolean {
  return permissions.includes(permission);
}

export function hasAnyContentPermission(permissions: ContentPermission[]): boolean {
  return permissions.some((p) => CONTENT_COLLAB_PERMISSIONS.includes(p));
}
