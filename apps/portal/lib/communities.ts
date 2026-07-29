import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";

// Community guides are MDX files with typed frontmatter (the single source of
// truth for both the teaser cards and the full guide pages). Read + validated at
// build time; pages are static, so no runtime fs access in production.
const CONTENT_DIR = join(process.cwd(), "content/communities");

const SubAreaSchema = z.enum(["Lake Norman", "South Charlotte", "Union County", "Fort Mill SC"]);
export type SubArea = z.infer<typeof SubAreaSchema>;

export const CommunityFrontmatterSchema = z.object({
  slug: z.string(),
  name: z.string(),
  subArea: SubAreaSchema,
  /** Links to the listing collection that supplies this community's MLS listings. */
  segmentSlug: z.string(),
  summary: z.string(),
  heroImage: z.string().optional(),
  golfClubs: z.array(z.string()).default([]),
  priceRange: z.string().optional(),
  amenities: z.array(z.string()).default([]),
  published: z.boolean().default(true),
});

export type CommunityFrontmatter = z.infer<typeof CommunityFrontmatterSchema>;

export interface CommunityDoc {
  frontmatter: CommunityFrontmatter;
  content: string;
}

const SUB_AREA_ORDER: SubArea[] = [
  "Lake Norman",
  "South Charlotte",
  "Union County",
  "Fort Mill SC",
];

function readDoc(slug: string): CommunityDoc {
  const raw = readFileSync(join(CONTENT_DIR, `${slug}.mdx`), "utf8");
  const { data, content } = matter(raw);
  const frontmatter = CommunityFrontmatterSchema.parse({ ...data, slug });
  return { frontmatter, content };
}

export function getCommunitySlugs(): string[] {
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getCommunities(): CommunityFrontmatter[] {
  return getCommunitySlugs()
    .map((slug) => readDoc(slug).frontmatter)
    .filter((fm) => fm.published)
    .sort(
      (a, b) =>
        SUB_AREA_ORDER.indexOf(a.subArea) - SUB_AREA_ORDER.indexOf(b.subArea) ||
        a.name.localeCompare(b.name),
    );
}

export function getCommunity(slug: string): CommunityDoc | null {
  try {
    const doc = readDoc(slug);
    return doc.frontmatter.published ? doc : null;
  } catch {
    return null;
  }
}
