import type { MetadataRoute } from "next";

/** Invite pages and the admin area must never be indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/rsvp/", "/admin", "/admin/", "/api/"],
    },
  };
}
