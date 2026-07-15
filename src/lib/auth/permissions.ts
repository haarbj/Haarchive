// Content-collaboration permissions: independent of both admin (still a pure
// ADMIN_EMAILS env allowlist, never grantable here) and training-dashboard
// access (still team_memberships.role). A user can hold any combination of
// these, which is why they're a set rather than a single role field.
export type ContentPermission = "content_contributor" | "reviewer";

export const CONTENT_PERMISSIONS: ContentPermission[] = ["content_contributor", "reviewer"];

export function hasContentPermission(
  permissions: ContentPermission[],
  permission: ContentPermission,
): boolean {
  return permissions.includes(permission);
}

export function hasAnyContentPermission(permissions: ContentPermission[]): boolean {
  return permissions.length > 0;
}
