"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import {
  Calendar,
  FileText,
  BarChart3,
  Users,
  AlertCircle,
  BookOpen,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  History,
  CalendarOff,
  HelpCircle,
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
    href: "/admin/integrantes",
    label: "Usuarios",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    href: "/licencias",
    label: "Licencias",
    icon: CalendarOff,
    roles: ["ADMIN", "INTEGRANTE"],
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
  {
    href: "/logs",
    label: "Logs",
    icon: History,
    roles: ["ADMIN", "INTEGRANTE"],
  },
  {
    href: "/manual",
    label: "Manual de uso",
    icon: HelpCircle,
    roles: ["ADMIN", "INTEGRANTE"],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = session?.user?.role || "INTEGRANTE"
  const [collapsed, setCollapsed] = useState(false)
  const { pendingRequests } = useNotifications()

  // Cargar estado desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved !== null) {
      setCollapsed(saved === "true")
    }
  }, [])

  // Guardar estado en localStorage
  const toggleCollapsed = () => {
    const newValue = !collapsed
    setCollapsed(newValue)
    localStorage.setItem("sidebar-collapsed", String(newValue))
  }

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  )

  return (
    <aside className={cn(
      "bg-gradient-to-b from-[var(--burgundy)] to-[#2a1215] min-h-screen sticky top-0 shadow-xl transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Decorative top element */}
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--gold)]/30 to-transparent" />

      {/* Toggle button */}
      <div className={cn("p-2 flex", collapsed ? "justify-center" : "justify-end")}>
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      <nav className={cn("space-y-1", collapsed ? "px-2" : "px-4")}>
        {filteredItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          const showBadge = item.href === "/admin/pendientes" && pendingRequests > 0

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-all duration-200 relative",
                collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                isActive
                  ? "bg-[var(--gold)]/20 text-[var(--gold)] border-l-2 border-[var(--gold)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0",
                    isActive ? "text-[var(--gold)]" : "text-white/50"
                  )}
                />
                {showBadge && collapsed && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {pendingRequests > 9 ? "9+" : pendingRequests}
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                      {pendingRequests > 99 ? "99+" : pendingRequests}
                    </span>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Decorative bottom element */}
      {!collapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="ornament opacity-30" />
        </div>
      )}
    </aside>
  )
}
