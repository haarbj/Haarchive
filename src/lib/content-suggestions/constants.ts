export const SUGGESTION_STATUSES = ["open", "accepted", "rejected"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];
export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  open: "Open",
  accepted: "Accepted",
  rejected: "Rejected",
};
