// Pure so it's testable without a real browser -- the call site (the form
// component) passes in whatever window/navigator/location values it has;
// this just shapes and trims them. Deliberately narrow: only what helps
// reproduce a bug (viewport, pixel density, browser string, the page
// itself), never anything from storage/cookies/auth (see the feature's own
// "do not collect" list).
export type BugReportMetadata = {
  pageUrl: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  userAgent: string;
};

const MAX_USER_AGENT_LENGTH = 500;

// Strips the hash fragment before anything else touches the URL -- some
// auth flows (not this project's own cookie-based one today, but a
// defensive habit worth keeping regardless) can carry a token in a URL
// fragment, and a bug report has no legitimate need for it. Query params
// are kept: they're often exactly what distinguishes "the bug" (a specific
// search query, a specific plan id) from a generic page URL.
export function sanitizePageUrl(href: string): string {
  try {
    const url = new URL(href);
    url.hash = "";
    return url.toString();
  } catch {
    return href.split("#")[0];
  }
}

// "A user reported a bug on /pace-calculator." reads better in a
// notification than the full URL -- falls back to the raw string for
// anything that doesn't parse as a URL rather than dropping the
// notification's own content. Lives here, not in bug-report-actions.ts,
// because every export from a "use server" file must be an async Server
// Action -- a plain sync helper can't be exported from there at all, let
// alone unit-tested.
export function readablePagePath(pageUrl: string): string {
  try {
    return new URL(pageUrl).pathname || pageUrl;
  } catch {
    return pageUrl;
  }
}

export function buildBugReportMetadata(params: {
  href: string;
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
  userAgent: string;
}): BugReportMetadata {
  return {
    pageUrl: sanitizePageUrl(params.href),
    viewportWidth: Math.round(params.innerWidth),
    viewportHeight: Math.round(params.innerHeight),
    devicePixelRatio: params.devicePixelRatio,
    userAgent: params.userAgent.slice(0, MAX_USER_AGENT_LENGTH),
  };
}
