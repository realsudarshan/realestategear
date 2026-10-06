"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { BedDouble, Bath, Maximize2 } from "lucide-react"
import Link from "next/link"
import type { PortalPropertySummary } from "@/lib/listings"

function formatPrice(price: number | null): string | null {
  if (price == null) return null
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price)
}

export function PropertyCard({ property }: { property: PortalPropertySummary }) {
  const price = formatPrice(property.price)
  const hasFacts =
    property.bedrooms != null || property.bathrooms != null || property.squareFeet != null

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
    >
      <Link
        href={`/properties/${property.slug ?? property.id}`}
        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-shadow duration-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/40">
          {property.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={property.imageUrl}
              alt={property.address}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-secondary/60 to-secondary">
              <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">No photo</span>
            </div>
          )}

          {/* Price pill overlay */}
          {price && (
            <div className="absolute bottom-3 left-3">
              <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                {price}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-2 p-4">
          <div>
            <h3 className="text-sm font-semibold leading-snug tracking-tight text-foreground line-clamp-1">
              {property.address}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {property.city}, {property.state} {property.zipCode}
            </p>
          </div>

          {hasFacts && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border pt-2">
              {property.bedrooms != null && (
                <span className="flex items-center gap-1">
                  <BedDouble className="size-3.5 shrink-0" />
                  {property.bedrooms} bd
                </span>
              )}
              {property.bathrooms != null && (
                <span className="flex items-center gap-1">
                  <Bath className="size-3.5 shrink-0" />
                  {property.bathrooms} ba
                </span>
              )}
              {property.squareFeet != null && (
                <span className="flex items-center gap-1">
                  <Maximize2 className="size-3.5 shrink-0" />
                  {property.squareFeet.toLocaleString()} sqft
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
