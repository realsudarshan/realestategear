// Shared hero section for content pages (properties, about, contact, etc.)
export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-primary">
      {/* Decorative gradient overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80 opacity-90"
      />
      {/* Subtle grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          color: "white",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-16">
        {eyebrow ? (
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/55">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/75">
            {subtitle}
          </p>
        ) : null}
      </div>
    </section>
  )
}
