"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const { data: session } = useSession()

  return (
    <header className="border-b bg-white">
      <div className="flex h-16 items-center px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">Orquesta - Descansos</span>
        </Link>

        <nav className="ml-auto flex items-center gap-4">
          {session?.user && (
            <>
              <span className="text-sm text-gray-600">
                {session.user.name} ({session.user.role})
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Cerrar sesion
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
