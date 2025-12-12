"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Calendario", roles: ["ADMIN", "INTEGRANTE"] },
  { href: "/solicitudes", label: "Mis Solicitudes", roles: ["ADMIN", "INTEGRANTE"] },
  { href: "/estadisticas", label: "Estadisticas", roles: ["ADMIN", "INTEGRANTE"] },
  { href: "/admin/integrantes", label: "Integrantes", roles: ["ADMIN"] },
  { href: "/admin/pendientes", label: "Casos Pendientes", roles: ["ADMIN"] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = session?.user?.role || "INTEGRANTE"

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  )

  return (
    <aside className="w-64 border-r bg-gray-50 min-h-[calc(100vh-64px)]">
      <nav className="p-4 space-y-2">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block px-4 py-2 rounded-md text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-gray-200 text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
