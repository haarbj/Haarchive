import type { Metadata } from "next";

import { ArticleEditorForm } from "@/app/(app)/(protected)/contribute/articles/article-editor-form";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "New Draft",
};

const EMPTY_INITIAL = {
  title: "",
  subtitle: "",
  articleType: "article",
  evidenceCategory: "",
  tagsInput: "",
  coverImageUrl: "",
  content: [],
  citations: [],
};

export default function NewArticleDraftPage() {
  return (
    <Container variant="narrow">
      <Heading variant="compact">New Draft</Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        You&rsquo;ll be listed as the author. Fill in as much as you have — you can keep editing before
        submitting it for review.
      </p>

      <div className="mt-8">
        <ArticleEditorForm mode="create" initial={EMPTY_INITIAL} />
      </div>
    </Container>
  );
}
