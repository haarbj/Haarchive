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
};

export default nextConfig;
