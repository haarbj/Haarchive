import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// The only thing this feature adds to an article's reading experience --
// deliberately just a link, not a comment box or a visible vote count.
// Community/editorial activity lives entirely on /questions.
export function QuestionsCta({ sourceSectionSlug }: { sourceSectionSlug: string }) {
  return (
    <Card padding="md" className="mt-12 text-center">
      <p className="text-base font-semibold text-zinc-900 dark:text-white">Still have a question?</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        If something wasn’t fully explained or you’d like to see this topic expanded, submit a question or
        suggest a topic.
      </p>
      <Button href={`/questions/ask?from=${sourceSectionSlug}`} className="mt-4">
        Ask a Question
      </Button>
    </Card>
  );
}
