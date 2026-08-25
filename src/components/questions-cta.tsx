import Link from "next/link";

// The only thing this feature adds to an article's reading experience --
// deliberately just a link, not a comment box or a visible vote count.
// Community/editorial activity lives entirely on /questions. Styled as one
// more archive section (hairline rule, eyebrow, serif heading, left-aligned)
// matching "Continue Exploring"/"Continue Reading"/Sources below it, not as
// a centered product card -- this is an editorial contribution invitation,
// not an account CTA (see learning-progress-teaser.tsx for that contrast).
// The action itself is a plain arrow-suffixed text link, not a bordered
// pill Button -- even an outline button was still the one UI-component
// silhouette in an otherwise pure-typography sequence (Continue Exploring
// right above this is plain text links with no button at all); matching
// that same "the archive itself is the CTA" language here removes the last
// piece of chrome from the invitation.
export function QuestionsCta({ sourceSectionSlug }: { sourceSectionSlug: string }) {
  return (
    <div className="mt-16 border-t border-black/10 pt-10 dark:border-white/10">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Questions
      </p>
      <h2 className="font-serif mt-3 text-2xl font-medium tracking-tight text-zinc-900 dark:text-white">
        Still have a question?
      </h2>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-300">
        If something wasn’t fully explained or you’d like to see this topic expanded, submit a question or
        suggest a topic.
      </p>
      <Link
        href={`/questions/ask?from=${sourceSectionSlug}`}
        className="group mt-4 inline-flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-white"
      >
        Ask a Question
        <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </div>
  );
}
