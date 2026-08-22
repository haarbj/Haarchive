// Search/role-filter predicates behind the Users page's search box and
// filter pills -- extracted out of admin/users/page.tsx (a page component,
// not otherwise importable into a test) so this logic is testable the same
// way every other pure lib/ function in this project is.

export type FilterableUser = {
  email: string;
  displayName: string;
  isAdmin: boolean;
  contentContributor: boolean;
  reviewer: boolean;
  trainingDashboardAccess: boolean;
};

export type UserTypeFilter = "admin" | "contributor" | "reviewer" | "coach" | "none";

export function matchesUserSearch(user: FilterableUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return user.email.toLowerCase().includes(q) || user.displayName.toLowerCase().includes(q);
}

export function matchesUserType(user: FilterableUser, type: UserTypeFilter | undefined): boolean {
  switch (type) {
    case "admin":
      return user.isAdmin;
    case "contributor":
      return user.contentContributor;
    case "reviewer":
      return user.reviewer;
    case "coach":
      return user.trainingDashboardAccess;
    case "none":
      return !user.isAdmin && !user.contentContributor && !user.reviewer && !user.trainingDashboardAccess;
    default:
      return true;
  }
}
