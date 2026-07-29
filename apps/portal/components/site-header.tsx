import { Button } from "@realestategear/ui/button"
import { getSessionUser } from "@/lib/session-user-server"
import { LogoutButton } from "@/components/logout-button"
import { MobileNav } from "@/components/mobile-nav"

const NAV = [
  { href: "/properties", label: "Properties" },
  { href: "/communities", label: "Communities" },
  { href: "/contact", label: "Contact" },
]

const navLinkClass =
  "hidden rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground hover:bg-accent/40 sm:inline-flex"

export async function SiteHeader() {
  const user = await getSessionUser()
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 shadow-sm">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${siteName} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt={siteName} className="h-7 w-auto sm:h-8" />
        </a>

        <nav className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-1.5">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className={navLinkClass}>
              {item.label}
            </a>
          ))}

          {user ? (
            <>
              <a href="/favorites" className={navLinkClass}>
                Favorites
              </a>
              <LogoutButton />
            </>
          ) : (
            <a href="/login" className={navLinkClass}>
              Log in
            </a>
          )}

          <Button asChild size="sm" variant="gold" className="ml-1 hidden sm:inline-flex">
            <a href="/contact">Talk to an agent</a>
          </Button>

          <MobileNav isAuthed={Boolean(user)} />
        </nav>
      </div>
    </header>
  )
}
