"use client"

import { useActionState } from "react"
import { Button } from "@realestategear/ui/button"
import { Input } from "@realestategear/ui/input"
import { Label } from "@realestategear/ui/label"
import { Textarea } from "@realestategear/ui/textarea"
import { FormMessage } from "@realestategear/ui/form-message"
import { submitInquiry, type InquiryResult } from "@/app/actions"
import { FadeIn } from "@realestategear/ui/motion"

export function InquiryForm({
  communities,
  areaSlug,
  collectionSlug,
}: {
  communities: string[]
  areaSlug?: string
  collectionSlug?: string
}) {
  const [state, action, pending] = useActionState<InquiryResult | null, FormData>(
    submitInquiry,
    null
  )

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

  if (state?.ok) {
    return (
      <FadeIn className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center shadow-sm">
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
          <svg
            className="size-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-lg font-bold text-foreground">Received — we will contact you shortly.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          A representative from {siteName} will connect with you the moment properties become available in your chosen area.
        </p>
      </FadeIn>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      {areaSlug ? <input type="hidden" name="areaSlug" value={areaSlug} /> : null}
      {collectionSlug ? (
        <input type="hidden" name="collectionSlug" value={collectionSlug} />
      ) : null}
      
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">
            Phone <span className="font-normal text-muted-foreground/70">(optional)</span>
          </Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="community">
            Community <span className="font-normal text-muted-foreground/70">(optional)</span>
          </Label>
          <Input
            id="community"
            name="community"
            list="portal-communities"
            placeholder="e.g. The Peninsula"
          />
          <datalist id="portal-communities">
            {communities.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">
          What are you looking for?{" "}
          <span className="font-normal text-muted-foreground/70">(optional)</span>
        </Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Price range, timeline, must-haves..."
          className="min-h-[100px] rounded-lg border border-border bg-card p-3.5 text-sm shadow-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
        />
      </div>

      {state && !state.ok ? <FormMessage variant="error">{state.error}</FormMessage> : null}

      <div className="mt-2 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button type="submit" variant="gold" size="lg" loading={pending} loadingLabel="Sending...">
          Submit Inquiry
        </Button>
        <p className="text-xs font-medium text-muted-foreground/80">
          Your information is strictly used for real estate inquiries. No unwanted emails.
        </p>
      </div>
    </form>
  )
}
