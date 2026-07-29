const DEFAULT_SITE_URL = "http://localhost:3006";

export function getPublicSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.FRONTEND_URL ?? DEFAULT_SITE_URL;
  return new URL(configured.endsWith("/") ? configured : `${configured}/`);
}
