import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const siteDescription =
  "Haarchive is a running education platform exploring distance running training, exercise physiology, coaching philosophies, sports psychology, and data-driven performance.";

export const metadata: Metadata = {
  metadataBase: new URL("https://brodyhaar.com"),
  title: {
    default: "The Haarchive",
    template: "%s | The Haarchive",
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    siteName: "The Haarchive",
    title: "The Haarchive",
    description: siteDescription,
    url: "/",
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Haarchive",
    description: siteDescription,
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // "dark" is hardcoded, not conditional -- the site is dark-mode-only by
    // design (light mode looked bad), so every dark: utility across the app
    // should always win. No toggle, no system-preference check, no client
    // script: this is the one true state, rendered server-side.
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full bg-stone-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        {/* id="page-content" is a real capture boundary, not decoration --
            src/lib/bug-report/capture-screenshot.ts renders exactly this
            element for the bug-report screenshot. Every Drawer/modal in the
            app (Notes today, any future one) is portaled to document.body
            as a *sibling* of this div, not a descendant of it -- so
            targeting this element instead of document.body automatically
            keeps the bug-report flow itself, and anything like the private
            Notes panel, out of the captured image with zero per-feature
            redaction logic. */}
        <div id="page-content">
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
