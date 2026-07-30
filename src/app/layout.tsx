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
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
