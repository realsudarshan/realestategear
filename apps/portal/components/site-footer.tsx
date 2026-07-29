const LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <p className="text-sm font-bold tracking-widest uppercase text-foreground">{siteName}</p>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {siteName} is a licensed real estate brokerage. Listing data is provided by your
              local MLS board and is intended for consumers&rsquo; personal, non-commercial use.
            </p>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm font-medium text-muted-foreground/80 sm:flex-col sm:gap-3 sm:text-right">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-primary">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-8 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} {siteName}. All rights reserved.</p>
          <p>Equal Housing Opportunity &bull; Your MLS Board</p>
        </div>
      </div>
    </footer>
  );
}
