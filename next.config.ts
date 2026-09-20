import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // postgres.js opens raw sockets; keep it out of the bundler.
  serverExternalPackages: ["postgres"],

  experimental: {
    serverActions: {
      // CSV imports post through a server action.
      bodySizeLimit: "2mb",
    },
  },

  async redirects() {
    return [
      // The travel page was folded into the schedule page.
      { source: "/travel", destination: "/schedule", permanent: true },
      // The registry page became the gifts page.
      { source: "/registry", destination: "/gifts", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        // An access code travels in the URL, so never leak the full path to a
        // third-party site through the Referer header.
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/rsvp/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
