"use client"

import { SessionProvider } from "next-auth/react"
import { Navbar } from "@/components/layout/navbar"
import { Sidebar } from "@/components/layout/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { DebugDateProvider } from "@/contexts/debug-date-context"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <DebugDateProvider>
        <div className="min-h-screen bg-background">
          <Navbar />
          <div className="flex">
            {/* Sidebar - hidden on mobile */}
            <div className="hidden md:block">
              <Sidebar />
            </div>
            <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
          </div>
          <Toaster />
        </div>
      </DebugDateProvider>
    </SessionProvider>
  )
}
