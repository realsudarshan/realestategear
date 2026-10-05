import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@realestategear/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPortalProperty, type PortalPropertyDetail } from "@/lib/listings";
import { getPublicSiteUrl } from "@/lib/site-url";

const SITE_URL = getPublicSiteUrl();
const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

function formatPrice(price: number | null) {
  if (price == null) return "Price available on request";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatPropertyType(value: string | null) {
  if (!value) return null;
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function descriptionFor(property: PortalPropertyDetail) {
  return property.description
    ?? `${property.bedrooms ?? ""} bedroom, ${property.bathrooms ?? ""} bathroom home in ${property.city}, ${property.state}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPortalProperty(slug);
  if (!property) return { title: `Property Not Found | ${siteName}` };

  const title = `${property.address} - ${property.city}, ${property.state} | ${siteName}`;
  const description = descriptionFor(property);
  const canonical = new URL(`properties/${property.slug ?? property.id}`, SITE_URL).toString();
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: property.imageUrl ? [{ url: property.imageUrl, alt: property.address }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: property.imageUrl ? [property.imageUrl] : [],
    },
  };
}

function PropertyJsonLd({ property }: { property: PortalPropertyDetail }) {
  const canonical = new URL(`properties/${property.slug ?? property.id}`, SITE_URL).toString();
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${property.address}, ${property.city}, ${property.state}`,
    description: descriptionFor(property),
    url: canonical,
    image: property.imageUrl ?? undefined,
    sku: property.mlsId ?? property.listingId ?? property.id,
    address: {
      "@type": "PostalAddress",
      streetAddress: property.address,
      addressLocality: property.city,
      addressRegion: property.state,
      postalCode: property.zipCode,
    },
    ...(property.price != null
      ? { offers: { "@type": "Offer", price: property.price, priceCurrency: "USD", availability: "https://schema.org/InStock" } }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }}
    />
  );
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";
  const { slug } = await params;
  const property = await getPortalProperty(slug);
  if (!property) notFound();

  const images = [
    ...property.media.map((item) => ({ url: item.url, alt: item.caption ?? property.address })),
    ...(property.imageUrl ? [{ url: property.imageUrl, alt: property.address }] : []),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.url === item.url) === index);
  const propertyType = formatPropertyType(property.propertyType);

  return (
    <>
      <PropertyJsonLd property={property} />
      <SiteHeader />
      <main className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <Link href="/properties" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Back to properties
          </Link>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]">
            <div className="grid gap-3 sm:grid-cols-2">
              {images.length > 0 ? images.slice(0, 4).map((image, index) => (
                <div
                  key={image.url}
                  className={`overflow-hidden rounded-md border border-border bg-secondary/40 ${index === 0 ? "aspect-[4/3] sm:col-span-2" : "aspect-[4/3]"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.alt} className="h-full w-full object-cover" />
                </div>
              )) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-border bg-secondary/40 text-sm text-muted-foreground sm:col-span-2">
                  Photos coming soon
                </div>
              )}
            </div>

            <aside className="h-fit rounded-md border border-border bg-card p-6 lg:sticky lg:top-20">
              <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <span>Active</span>
                {propertyType ? <span>· {propertyType}</span> : null}
              </div>
              <p className="mt-4 text-3xl font-black tracking-tight text-foreground">{formatPrice(property.price)}</p>
              <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">{property.address}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {property.city}, {property.state} {property.zipCode}
              </p>

              <dl className="mt-6 grid grid-cols-3 border-y border-border py-4 text-center">
                <div>
                  <dd className="font-mono text-lg font-semibold text-foreground">{property.bedrooms ?? "-"}</dd>
                  <dt className="text-xs text-muted-foreground">Beds</dt>
                </div>
                <div className="border-x border-border">
                  <dd className="font-mono text-lg font-semibold text-foreground">{property.bathrooms ?? "-"}</dd>
                  <dt className="text-xs text-muted-foreground">Baths</dt>
                </div>
                <div>
                  <dd className="font-mono text-lg font-semibold text-foreground">{property.squareFeet?.toLocaleString() ?? "-"}</dd>
                  <dt className="text-xs text-muted-foreground">Sq ft</dt>
                </div>
              </dl>

              <Button asChild className="mt-6 w-full">
                <Link href={`/contact?listing=${encodeURIComponent(property.listingId ?? property.id)}`}>Ask about this home</Link>
              </Button>
            </aside>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="rounded-md border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Property overview</p>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-foreground">
                {property.description ?? "Contact us for more information about this property."}
              </p>
            </section>

            <section className="rounded-md border border-border bg-card p-6">
              <h2 className="text-sm font-bold tracking-tight text-foreground">Listing details</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {property.yearBuilt ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Year built</dt><dd>{property.yearBuilt}</dd></div> : null}
                {property.lotSize ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Lot size</dt><dd>{property.lotSize} acres</dd></div> : null}
                {property.mlsId ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">MLS ID</dt><dd className="font-mono text-xs">{property.mlsId}</dd></div> : null}
                {property.brokerageName ? <div className="border-t border-border pt-3"><dt className="text-muted-foreground">Listed by</dt><dd className="mt-1 font-medium">{property.brokerageName}</dd></div> : null}
              </dl>
            </section>
          </div>

          <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            IDX information is provided for consumers&rsquo; personal, non-commercial use and is deemed reliable but not guaranteed.
            {property.mlsBoardName ? ` Listing data provided by ${property.mlsBoardName}.` : ""}
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
