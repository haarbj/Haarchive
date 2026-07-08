import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const siteDescription =
  "A long-term educational resource on distance running at the intersection of physiology, psychology, philosophy, and practice.";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-stone-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
