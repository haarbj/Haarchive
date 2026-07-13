import type { QuestionStatus } from "@/lib/questions/types";
import { STATUS_LABELS } from "@/lib/questions/types";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const STATUS_TONES: Record<QuestionStatus, BadgeTone> = {
  new: "neutral",
  under_review: "tip",
  planned: "research",
  researching: "warning",
  answered: "success",
  added_to_library: "success",
};

export function StatusBadge({ status }: { status: QuestionStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
