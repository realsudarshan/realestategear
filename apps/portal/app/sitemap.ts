import type { MetadataRoute } from "next";
import { getCommunities } from "@/lib/communities";
import { getPublicSiteUrl } from "@/lib/site-url";

const PUBLIC_ROUTES = [
  "",
  "about",
  "communities",
  "contact",
  "join",
  "privacy",
  "properties",
  "terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicSiteUrl();
  const routes = [
    ...PUBLIC_ROUTES,
    ...getCommunities().map((community) => `communities/${community.slug}`),
  ];

  return routes.map((route) => ({ url: new URL(route, siteUrl).toString() }));
}
