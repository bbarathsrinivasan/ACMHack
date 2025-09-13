"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type Toast = { id: number; title?: string; description?: string; variant?: "default" | "destructive" }

const ToastCtx = React.createContext<{
  toasts: Toast[]
  push: (t: Omit<Toast, "id">) => void
  remove: (id: number) => void
} | null>(null)

export function useToast() {
  const ctx = React.useContext(ToastCtx)
  if (!ctx) throw new Error("useToast must be used within <Toaster />")
  return ctx
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, ...t }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3000)
  }, [])
  const remove = React.useCallback((id: number) => setToasts((p) => p.filter((x) => x.id !== id)), [])
  return (
    <ToastCtx.Provider value={{ toasts, push, remove }}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-xl border bg-background p-3 shadow-sm",
              t.variant === "destructive" ? "border-destructive/50 bg-destructive/10" : ""
            )}
          >
            {t.title ? <div className="text-sm font-medium">{t.title}</div> : null}
            {t.description ? <div className="text-xs text-muted-foreground">{t.description}</div> : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
