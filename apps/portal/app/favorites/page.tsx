import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RemoveFavoriteButton } from "@/components/remove-favorite-button";
import { getSessionUser } from "@/lib/session-user-server";
import { getToken } from "@/lib/auth";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Favorites | ${siteName}`,
  description: "Homes you've saved.",
};

const API_BASE = resolveServerApiBaseUrl(process.env);

type Favorite = {
  id: string;
  favoritedAt: string;
  listing: {
    id: string;
    listPrice: string | number | null;
    property: {
      address: string;
      city: string;
      state: string;
      bedrooms: number | null;
      bathrooms: number | null;
      media: { url: string }[];
    };
  };
};

async function getFavorites(token: string): Promise<{ ok: boolean; favorites: Favorite[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/users/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, favorites: [] };
    const data = await res.json();
    return { ok: true, favorites: data.favorites ?? [] };
  } catch {
    return { ok: false, favorites: [] };
  }
}

function formatPrice(price: string | number | null): string | null {
  if (price === null) return null;
  const n = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default async function FavoritesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?from=/favorites");

  const token = await getToken();
  const { ok, favorites } = token ? await getFavorites(token) : { ok: true, favorites: [] };

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</p>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Your favorites</h1>
            <p className="mt-1 text-sm text-muted-foreground">Homes you've saved for later.</p>
          </div>
          {!ok ? (
            <div className="rounded-md border border-border bg-card p-8 text-center">
              <p className="text-sm font-semibold text-foreground">Couldn&rsquo;t load your favorites.</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try refreshing the page.</p>
            </div>
          ) : favorites.length === 0 ? (
            <div className="rounded-md border border-border bg-card p-8 text-center">
              <p className="text-sm font-semibold text-foreground">No favorites yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Listings you save will show up here once you find a home you like.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((fav) => {
                const { property } = fav.listing;
                const price = formatPrice(fav.listing.listPrice);
                return (
                  <div
                    key={fav.id}
                    className="flex flex-col gap-3 rounded-md border border-border bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold tracking-tight text-foreground">
                          {property.address}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {property.city}, {property.state}
                        </p>
                      </div>
                      {price ? (
                        <span className="shrink-0 text-sm font-semibold text-foreground">{price}</span>
                      ) : null}
                    </div>
                    {property.bedrooms != null || property.bathrooms != null ? (
                      <p className="text-sm text-muted-foreground">
                        {property.bedrooms != null ? `${property.bedrooms} bd` : null}
                        {property.bedrooms != null && property.bathrooms != null ? " · " : null}
                        {property.bathrooms != null ? `${property.bathrooms} ba` : null}
                      </p>
                    ) : null}
                    <div className="mt-auto pt-1">
                      <RemoveFavoriteButton listingId={fav.listing.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
