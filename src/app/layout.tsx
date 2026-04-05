import type { Metadata, Viewport } from "next"
import "./globals.css"

export const viewport: Viewport = {
  themeColor: "#dc2626",
}

export const metadata: Metadata = {
  title: "Ensayos Primeros Violines OETC",
  description: "Sistema de gestion de ensayos y rotativos",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ensayos OETC",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  )
}
