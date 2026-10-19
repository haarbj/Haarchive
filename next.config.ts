import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Matches MAX_IMAGE_BYTES in contribute/articles/actions.ts (8 MB)
      // plus headroom for multipart overhead -- Next.js's own default (1 MB)
      // is a request-body cap enforced before uploadArticleImage's own size
      // check ever runs, so a photo straight off a phone trips this first.
      bodySizeLimit: "9mb",
    },
  },
  // The four-domain IA migration (see src/lib/sections.ts) renamed the 7
  // non-tools category landing pages -- these are the only URLs that
  // changed; every individual section/article/tool URL underneath a
  // category is untouched, since only the `category` field on each
  // Section moved, never its own `slug`. permanent: true (301) since
  // these are real, indexed URLs, not a temporary rename.
  async redirects() {
    return [
      { source: "/the-science", destination: "/physiology", permanent: true },
      { source: "/recovery-and-fueling", destination: "/physiology", permanent: true },
      { source: "/mind-and-recovery", destination: "/psychology", permanent: true },
      { source: "/foundations", destination: "/philosophy", permanent: true },
      { source: "/getting-started", destination: "/practice", permanent: true },
      { source: "/coaching-and-training", destination: "/practice", permanent: true },
      // Destination is "/archive", not "/library" -- /library is already a
      // different, unrelated authenticated route (the signed-in personal
      // notes/saved-topics dashboard), so the Library category's real slug
      // had to be "archive" instead (see sections.ts's comment on that entry).
      { source: "/writing-and-resources", destination: "/archive", permanent: true },
      // The Endurance Fueling Calculator and the Fueling Calculator were
      // unified into one Fueling Planner at the latter's URL (see
      // fueling-calculator.tsx's Race / Training run mode selector) --
      // /fueling-calculator is the canonical, primary entry point.
      { source: "/endurance-fueling-calculator", destination: "/fueling-calculator", permanent: true },
      // The Altitude-Adjusted Pace Calculator and the Altitude Calculator
      // were unified into one Altitude Calculator with a VO2max/Performance
      // mode toggle (see altitude-calculator.tsx's own header comment) --
      // /altitude-calculator is the canonical, primary entry point.
      { source: "/altitude-adjusted-pace-calculator", destination: "/altitude-calculator", permanent: true },
      // The Marathon Pacing Calculator and the Race Pace Planner were
      // unified into one tool at the latter's URL: the Ch. 18-20 pacing
      // heuristic (progressive/even start, fast finish, grade adjustment,
      // fueling, segment strategy) that lived at race-pace-planner is the
      // canonical pacing model, now reachable from either a GPS route
      // import or the original manual course-map entry -- see
      // race-pace-planner.tsx's own header comment.
      { source: "/marathon-pacing-calculator", destination: "/race-pace-planner", permanent: true },
    ];
  },
};

export default nextConfig;
