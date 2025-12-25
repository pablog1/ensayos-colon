"use client"

import { Loader2Icon } from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group !top-1/2 !-translate-y-1/2 !bottom-auto !z-[100]"
      position="top-center"
      closeButton
      duration={Infinity}
      icons={{
        success: null,
        info: null,
        warning: null,
        error: null,
        loading: <Loader2Icon className="size-6 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!py-5 !px-6 !text-base !gap-4",
          title: "!text-base !font-medium",
          description: "!text-sm",
          closeButton: "!bg-background !border-border hover:!bg-muted !size-8 !right-2 !top-2 [&>svg]:!size-4",
          success: "!bg-green-100 !border-green-300 !text-green-900",
          error: "!bg-red-100 !border-red-300 !text-red-900",
          info: "!bg-yellow-100 !border-yellow-300 !text-yellow-900",
          warning: "!bg-yellow-100 !border-yellow-300 !text-yellow-900",
          loading: "!bg-yellow-100 !border-yellow-300 !text-yellow-900",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "456px",
          zIndex: 9999,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
