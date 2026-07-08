import type { Metadata } from "next";

import { AboutRedirect } from "@/components/about-redirect";

export const metadata: Metadata = {
  title: "About",
  description: "This page has moved to the homepage.",
};

export default function AboutRedirectPage() {
  return (
    <>
      <meta httpEquiv="refresh" content="0;url=/" />
      <AboutRedirect />
    </>
  );
}
