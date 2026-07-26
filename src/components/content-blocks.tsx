import Link from "next/link";

import type { ContentBlock } from "@/lib/sections";
import { headingId } from "@/lib/heading-id";
import { linkifyContent } from "@/lib/linkify";
import { ContentCallout } from "@/components/content-callout";
import { PullQuote } from "@/components/pull-quote";

type ContentBlocksProps = {
  content: ContentBlock[];
  // Used both for heading anchors' scroll targets and for linkify's
  // "don't auto-link a glossary term back to the page it's already on"
  // check -- pass the section this content actually belongs to, not
  // necessarily the page it's being rendered on (see Training Plans, which
  // renders its own section's content inline as an intro).
  sectionSlug: string;
};

// The block-rendering half of ArticleLayout, extracted so a page that isn't
// a full article (Training Plans' new interactive home, so far) can reuse
// the exact same heading/paragraph/list/callout rendering for its own
// intro content instead of hand-copying prose into raw JSX. ArticleLayout
// itself now renders through this too, so there's exactly one place that
// knows how to turn a ContentBlock into markup.
export function ContentBlocks({ content, sectionSlug }: ContentBlocksProps) {
  // Threaded through every block in this one render so a glossary term
  // only gets auto-linked once, not every time it's mentioned -- created
  // fresh per render, never shared across renders.
  const linkedTermIds = new Set<string>();

  return (
    <>
      {content.map((block, index) => {
        if (block.type === "heading") {
          const level = block.level ?? 2;
          return level === 3 ? (
            <h3
              key={index}
              id={headingId(block.text)}
              className="scroll-mt-24 pt-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white"
            >
              {block.text}
            </h3>
          ) : (
            <h2
              key={index}
              id={headingId(block.text)}
              className="scroll-mt-24 border-t border-black/5 pt-8 text-2xl font-semibold tracking-tight text-zinc-900 first:border-t-0 first:pt-0 dark:border-white/10 dark:text-white"
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="space-y-3">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>• {linkifyContent(item, sectionSlug, linkedTermIds)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "quote") {
          return <PullQuote key={index} text={block.text} attribution={block.attribution} />;
        }
        if (block.type === "image") {
          return (
            <figure key={index}>
              {/* Arbitrary contributor-pasted URL, not a local/optimized asset -- see contributor-profile-form.tsx */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.url}
                alt={block.alt ?? ""}
                className="w-full rounded-card border border-black/10 dark:border-white/10"
              />
              {block.caption ? (
                <figcaption className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{block.caption}</figcaption>
              ) : null}
            </figure>
          );
        }
        if (block.type === "callout") {
          return (
            <ContentCallout
              key={index}
              variant={block.variant}
              title={block.title}
              text={block.text ? linkifyContent(block.text, sectionSlug, linkedTermIds) : undefined}
              items={block.items?.map((item) => linkifyContent(item, sectionSlug, linkedTermIds))}
              collapsed={block.collapsed}
            />
          );
        }
        return (
          <p key={index}>
            {linkifyContent(block.text, sectionSlug, linkedTermIds)}
            {block.linkHref && block.linkText ? (
              <>
                {" "}
                <Link
                  href={block.linkHref}
                  className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
                >
                  {block.linkText}
                </Link>
                .
              </>
            ) : null}
          </p>
        );
      })}
    </>
  );
}
