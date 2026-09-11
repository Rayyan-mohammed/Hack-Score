import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Uploads run through Server Actions (sponsor logos, the PPT template),
      // and the default cap is 1MB. 4.5MB is the ceiling the deployment target
      // allows for a request body, so the forms cap their own files below it.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
