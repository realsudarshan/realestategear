// Shared hero section for content pages (properties, about, contact, join, login…)
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
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-md px-4 py-4 sm:px-6 sm:py-5">
        {eyebrow ? (
          <p
            className="font-bold uppercase text-muted-foreground"
            style={{ fontSize: 10, letterSpacing: "0.18em", lineHeight: 1 }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="mt-1 font-extrabold tracking-tight text-foreground whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ fontSize: 22, lineHeight: 1.1 }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className="mt-2 text-muted-foreground"
            style={{ fontSize: 13, lineHeight: 1.5 }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </section>
  )
}
