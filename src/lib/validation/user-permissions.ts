import { z } from "zod";

// Booleans arrive from checkbox FormData as "true"/undefined, never absent
// on submit vs. present -- z.coerce.boolean() treats any present value
// (including "false" as a string) as true, so unchecked boxes must simply
// not send a field at all (matches how question-triage-panel's isFaq works).
export const updateUserPermissionsSchema = z.object({
  userId: z.string().uuid(),
  contentContributor: z.coerce.boolean().optional().default(false),
  reviewer: z.coerce.boolean().optional().default(false),
  trainingDashboardAccess: z.coerce.boolean().optional().default(false),
});

export type UpdateUserPermissionsInput = z.infer<typeof updateUserPermissionsSchema>;
