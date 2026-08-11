import type { Metadata } from "next";

import { AboutPage } from "@/components/about-page";
import { canonicalUrl } from "@/lib/canonical";

// Deliberate, homepage-specific metadata rather than inheriting the root
// layout's generic sitewide fallback -- the copy below is drawn directly
// from the hero's own real text (about-page.tsx's eyebrow/heading/lede),
// not written fresh, so it says what the homepage actually says rather
// than a separately-invented pitch. See docs/seo-audit.md section 4/10.
const title = "Distance Running Knowledge Hub";
const description =
  "A long-term resource on the physiology, psychology, philosophy, and practice of distance running -- for runners who want to understand training, not just follow a plan.";

export const metadata: Metadata = {
  title,
  description,
  ...canonicalUrl("/"),
  openGraph: {
    title: "The Haarchive",
    description,
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Haarchive",
    description,
    images: ["/opengraph-image.png"],
  },
};

export default function Home() {
  return <AboutPage />;
}
