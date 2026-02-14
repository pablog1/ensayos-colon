"use client"

import { useState } from "react"
import Link from "next/link"
/* eslint-disable @next/next/no-img-element */
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Menu,
  Calendar,
  FileText,
  BarChart3,
  Users,
  AlertCircle,
  BookOpen,
  Settings,
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

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = session?.user?.role || "INTEGRANTE"
  const { pendingRequests } = useNotifications()

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  )

  const totalBadgeCount = userRole === "ADMIN" ? pendingRequests : 0

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-white hover:bg-white/10 relative"
        >
          <Menu className="h-6 w-6" />
          {totalBadgeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
            </span>
          )}
          <span className="sr-only">Abrir menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 p-0 bg-gradient-to-b from-[var(--burgundy)] to-[#2a1215] border-r-0"
      >
        <SheetHeader className="p-6 border-b border-white/10">
          <SheetTitle className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 shrink-0 aspect-square rounded-full overflow-hidden border-2 border-[var(--gold)]">
              <img
                src="/teatro-colon.jpg"
                alt="Teatro Colón"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col items-start">
              <span
                className="text-lg font-semibold"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Teatro Colón
              </span>
              <span className="text-xs text-[var(--gold)] tracking-wider">
                Gestión de Rotativos - Primeros Violines
              </span>
            </div>
          </SheetTitle>
        </SheetHeader>

        <nav className="p-4 space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const showBadge = item.href === "/admin/pendientes" && pendingRequests > 0

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {pendingRequests > 99 ? "99+" : pendingRequests}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="ornament opacity-30" />
        </div>
      </SheetContent>
    </Sheet>
  )
}
