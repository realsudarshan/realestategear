"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@realestategear/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@realestategear/ui/sheet";
import { LogoutButton } from "@/components/logout-button";

const navLinkClass =
  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export function MobileNav({ isAuthed }: { isAuthed: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="sm:hidden"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <SheetContent side="right" className="w-64">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          <SheetClose asChild>
            <a href="/properties" className={navLinkClass}>
              Properties
            </a>
          </SheetClose>
          <SheetClose asChild>
            <a href="/communities" className={navLinkClass}>
              Communities
            </a>
          </SheetClose>
          <SheetClose asChild>
            <a href="/contact" className={navLinkClass}>
              Contact
            </a>
          </SheetClose>
          {isAuthed ? (
            <>
              <SheetClose asChild>
                <a href="/favorites" className={navLinkClass}>
                  Favorites
                </a>
              </SheetClose>
              <div className={navLinkClass}>
                <LogoutButton mobile />
              </div>
            </>
          ) : (
            <SheetClose asChild>
              <a href="/login" className={navLinkClass}>
                Log in
              </a>
            </SheetClose>
          )}
        </nav>
        <div className="mt-auto p-4">
          <Button asChild className="w-full">
            <a href="/contact" onClick={() => setOpen(false)}>
              Talk to an agent
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
