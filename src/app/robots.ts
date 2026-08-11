import type { MetadataRoute } from "next";

// Next's native robots convention (this file replaces a static
// public/robots.txt entirely -- having both would be ambiguous about which
// one actually serves /robots.txt). Disallow prefixes here are a
// crawl-time backstop; the pages themselves also carry a real `noindex`
// (see (protected)/layout.tsx, and the login/signup/pending/search pages)
// since a disallowed-but-linked-to URL can still surface in results with
// no snippet -- noindex is the reliable exclusion, this just saves crawl
// budget on top of it. See docs/seo-audit.md section 3/9 for the audit
// this implements.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/coach",
        "/contribute",
        "/settings",
        "/plan",
        "/login",
        "/signup",
        "/pending",
        "/search",
      ],
    },
    sitemap: "https://brodyhaar.com/sitemap.xml",
  };
}
