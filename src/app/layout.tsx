import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

// The editorial display/heading face -- pairs with Inter (body/interface
// text stays sans-serif) rather than replacing it. Self-hosted via
// next/font, so it's a real embedded font (no runtime request, no FOUT),
// exposed as --font-serif for globals.css's @theme block to turn into the
// font-serif utility. Newsreader specifically: designed for on-screen
// long-form reading (optical sizing, real italics) rather than a display
// face borrowed from print -- fits "editorial + academic", not decorative.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

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

// viewport-fit=cover lets the page paint edge-to-edge under the notch/
// Dynamic Island instead of letterboxing there (mobile-native skill) --
// nothing currently reads env(safe-area-inset-*) to pad content back out,
// since no fixed bottom bar/sheet sits in that zone today, but the meta
// tag itself is the baseline every page needs before that matters. Each
// color scheme gets its own theme-color matching the real background at
// the top of the page (bg-stone-50 light, zinc-950 dark -- see <body>
// above) so the mobile status bar/browser chrome matches instead of
// defaulting to one scheme's color in the other.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The server always renders the light class set (no "dark" here) --
    // real light/dark is now a user preference (see src/lib/theme.ts,
    // src/components/theme-toggle.tsx), not something the server can know
    // per-request. The inline script below is what actually decides the
    // *first paint's* real theme, before React hydrates: a saved
    // localStorage choice wins if one exists, otherwise the visitor's OS/
    // browser preference (prefers-color-scheme) decides, falling back to
    // light if neither is available. It only ever *adds* "dark" (never
    // removes it), since the server-rendered baseline is already light.
    <html
      lang="en"
      className={`h-full antialiased ${newsreader.variable}`}
      // The inline script may add "dark" to this exact element before
      // React hydrates, so the server-rendered class list and the first
      // client render can legitimately differ -- suppressHydrationWarning
      // tells React that's expected here rather than a real bug, the same
      // fix next-themes and similar theme-script patterns use. Scoped to
      // just <html>, so a real mismatch anywhere else in the tree still
      // warns normally.
      suppressHydrationWarning
    >
      <body className="min-h-full bg-stone-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("haarchive-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d){document.documentElement.classList.add("dark")}}catch(e){}',
          }}
        />
        {/* Reports the viewer's real IANA timezone to the server via a
            cookie, the same "client knows something the server can't"
            shape as the theme script just above -- Server Components
            computing "today" for the schedule/calendar surfaces (see
            src/lib/viewer-timezone.ts) read this instead of trusting the
            server's own clock/zone, which has no reason to match any
            given visitor's. Runs on every page load (not just once) so a
            visitor who travels across zones stays current; a 1-year
            maxAge just means it doesn't need to re-set itself every
            single load for someone who hasn't moved. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz){document.cookie="haarchive-tz="+tz+";path=/;max-age=31536000;samesite=lax"}}catch(e){}',
          }}
        />
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
