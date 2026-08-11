import type { Metadata } from "next";

// One place that knows how to build a canonical-URL metadata fragment, so
// ~15 call sites across generateMetadata/metadata exports don't each
// independently hand-write `alternates: { canonical: ... }`. Deliberately
// takes a root-relative path, never a full URL: `metadataBase` is already
// set once in src/app/layout.tsx (https://brodyhaar.com), and Next
// resolves a relative `canonical` against it automatically -- building an
// absolute URL here would be a second, driftable copy of that same domain.
//
// Never pass a path with a query string (?tag=, ?q=, etc.) -- the whole
// point of a canonical is to name the one clean URL a filtered/duplicate
// view should be attributed to, so a canonical containing its own query
// string defeats the purpose. Callers with a filtered view should compute
// the clean base path and pass that instead.
export function canonicalUrl(path: string): Pick<Metadata, "alternates"> {
  return { alternates: { canonical: path } };
}
