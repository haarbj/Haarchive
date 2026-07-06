import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Haarchive",
  assetPrefix: "/Haarchive/",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
