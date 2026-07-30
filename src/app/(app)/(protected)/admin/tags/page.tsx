import type { Metadata } from "next";

import { loadTagOptions } from "@/lib/articles/tag-options";
import { TagOptionsPanel } from "./tag-options-panel";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Article Tags",
};

export default async function AdminTagsPage() {
  const tagOptions = await loadTagOptions();

  return (
    <Container variant="dashboard">
      <BackLink href="/admin">Back to Admin</BackLink>
      <Heading>Article Tags</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        The fixed set of tags contributors can pick from when writing an article -- keeps tagging consistent
        instead of free text drifting into typos and near-duplicates. Removing a tag here only affects new
        picks; articles that already carry it keep it.
      </p>

      <div className="mt-10">
        <TagOptionsPanel tagOptions={tagOptions} />
      </div>
    </Container>
  );
}

export const dynamic = "force-dynamic";
