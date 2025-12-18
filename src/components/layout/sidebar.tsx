"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  Calendar,
  FileText,
  BarChart3,
  Users,
  AlertCircle,
  BookOpen,
  Settings,
  Music,
  CalendarDays,
} from "lucide-react"

const navItems = [
  {
    href: "/",
    label: "Calendario",
    icon: Calendar,
    roles: ["ADMIN", "INTEGRANTE"],
  },
  {
    href: "/solicitudes",
    label: "Mis Solicitudes",
    icon: FileText,
    roles: ["ADMIN", "INTEGRANTE"],
  },
  {
    href: "/estadisticas",
    label: "Estadísticas",
    icon: BarChart3,
    roles: ["ADMIN", "INTEGRANTE"],
  },
  {
    href: "/reglas",
    label: "Reglas",
    icon: BookOpen,
    roles: ["ADMIN", "INTEGRANTE"],
  },
  {
    href: "/admin/titulos",
    label: "Títulos",
    icon: Music,
    roles: ["ADMIN"],
  },
  {
    href: "/admin/calendario",
    label: "Calendario Admin",
    icon: CalendarDays,
    roles: ["ADMIN"],
  },
  {
    href: "/admin/integrantes",
    label: "Usuarios",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    href: "/admin/pendientes",
    label: "Casos Pendientes",
    icon: AlertCircle,
    roles: ["ADMIN"],
  },
  {
    href: "/admin/configuracion",
    label: "Configuración",
    icon: Settings,
    roles: ["ADMIN"],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = session?.user?.role || "INTEGRANTE"

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  )

  return (
    <aside className="w-64 bg-gradient-to-b from-[var(--burgundy)] to-[#2a1215] min-h-screen sticky top-0 shadow-xl">
      {/* Decorative top element */}
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--gold)]/30 to-transparent" />

      <nav className="p-4 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[var(--gold)]/20 text-[var(--gold)] border-l-2 border-[var(--gold)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5",
                  isActive ? "text-[var(--gold)]" : "text-white/50"
                )}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Decorative bottom element */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="ornament opacity-30" />
      </div>
    </aside>
  )
}
