"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// next/dynamic's ssr:false option can only be used from inside a Client
// Component (Next.js enforces this) -- about-page.tsx itself is a Server
// Component, so this thin wrapper exists purely to host that call. See
// feature-announcement.tsx for why ssr:false matters here (its dismissal
// check reads localStorage directly, which requires never being rendered
// on the server).
const FeatureAnnouncement = dynamic(
  () => import("@/components/feature-announcement").then((mod) => mod.FeatureAnnouncement),
  { ssr: false },
);

export function FeatureAnnouncementLoader(props: ComponentProps<typeof FeatureAnnouncement>) {
  return <FeatureAnnouncement {...props} />;
}
