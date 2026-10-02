import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep E2E artifacts and the dev lock separate from the interactive server.
  distDir: process.env.NEXT_TEST_SERVER === "1" ? ".next-e2e" : ".next",
  async redirects() {
    return [
      {
        source: "/page/:slug/produto/:productId",
        destination: "/:slug/produto/:productId",
        permanent: true,
      },
      {
        source: "/page/:slug",
        destination: "/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
