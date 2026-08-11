import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { SiteSearchBox } from "@/components/site-search";

// Next's own not-found.tsx convention -- rendered inside the root layout
// (src/app/layout.tsx), so SiteHeader/SiteFooter already wrap this exactly
// like every other page; nothing here needs to reproduce that chrome.
// Previously there was no custom 404 at all, so a broken link (internal or
// external) dead-ended on Next's bare, unstyled default with no way back
// into the site and no site-brand context at all. This is deliberately
// small: a real message, one clear way home, and the same search box used
// everywhere else on the site, not a redesigned page.
export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <Container variant="content">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">404</p>
      <Heading className="mt-3">Page not found</Heading>
      <p className="mt-6 max-w-[60ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Whatever you were looking for isn&rsquo;t at this address anymore, or never was. It might have
        moved, or the link might just be wrong.
      </p>

      <div className="mt-8">
        <Button href="/">Back to home</Button>
      </div>

      <div className="mt-12 max-w-md">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Or search for it</p>
        <div className="mt-3">
          <SiteSearchBox variant="header" />
        </div>
      </div>

      <p className="mt-12 text-sm text-zinc-500 dark:text-zinc-400">
        Looking for a specific topic? Start with{" "}
        <Link href="/" className="font-semibold underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70">
          the homepage
        </Link>{" "}
        or browse{" "}
        <Link href="/faq" className="font-semibold underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70">
          the FAQ
        </Link>
        .
      </p>
    </Container>
  );
}
