"use client"

import Link from "next/link"
/* eslint-disable @next/next/no-img-element */
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { MobileNav } from "./mobile-nav"
import { ProfileModal } from "@/components/profile/profile-modal"

export function Navbar() {
  const { data: session } = useSession()

  return (
    <header className="bg-[var(--burgundy)] text-white shadow-lg">
      <div className="flex h-16 md:h-20 items-center px-4 md:px-8">
        {/* Mobile menu button */}
        <MobileNav />

        <Link href="/" className="flex items-center gap-3 ml-2 md:ml-0">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-[var(--gold)]">
            <img
              src="/teatro-colon.jpg"
              alt="Teatro Colón"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span
              className="text-base md:text-xl font-semibold tracking-wide"
              style={{ fontFamily: "Playfair Display, serif" }}
            >
              Teatro Colón
            </span>
            <span className="text-[10px] md:text-xs text-[var(--gold)] tracking-widest uppercase hidden sm:block">
              Gestión de Rotativos - Primeros Violines
            </span>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-3 md:gap-4">
          {session?.user && (
            <>
              <ProfileModal />
              <Button
                size="sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="bg-[var(--gold)] text-[var(--burgundy)] hover:bg-[var(--gold-light)] font-medium text-xs md:text-sm"
              >
                <span className="hidden sm:inline">Cerrar sesión</span>
                <span className="sm:hidden">Salir</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Decorative gold line */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60" />
    </header>
  )
}
