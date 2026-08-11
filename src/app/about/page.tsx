import type { Metadata } from "next";

import { AboutRedirect } from "@/components/about-redirect";
import { canonicalUrl } from "@/lib/canonical";

// A redirect stub, not real content of its own -- canonical points at "/",
// the actual destination, not at this URL, and it's excluded from
// sitemap.ts entirely (a sitemap should only ever list the one real URL
// for a page, never a page whose whole purpose is redirecting away from
// itself). noindex/follow on top of that for the same reason the other
// non-canonical URLs in this pass get it: the meta-refresh below already
// sends a visitor on to "/", so this page has nothing of its own worth
// ranking. See docs/seo-audit.md's appendix for why this deviates from
// treating /about as a normal indexable page.
export const metadata: Metadata = {
  title: "About",
  description: "This page has moved to the homepage.",
  ...canonicalUrl("/"),
  robots: { index: false, follow: true },
};

export default function AboutRedirectPage() {
  return (
    <>
      <meta httpEquiv="refresh" content="0;url=/" />
      <AboutRedirect />
    </>
  );
}
