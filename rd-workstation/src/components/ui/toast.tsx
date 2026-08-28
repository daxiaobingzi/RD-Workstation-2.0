import * as React from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'warn' | 'error' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

const toasts: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function toast(message: string, type: ToastType = 'success') {
  const id = ++seq
  toasts.push({ id, type, message })
  if (toasts.length > 4) toasts.shift()
  emit()
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) {
      toasts.splice(i, 1)
      emit()
    }
  }, 3200)
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 text-ok" />,
  warn: <AlertTriangle className="size-4 text-warn" />,
  error: <XCircle className="size-4 text-danger" />,
  info: <Info className="size-4 text-accent" />,
}

export function Toaster() {
  const [, force] = React.useReducer((x: number) => x + 1, 0)
  React.useEffect(() => {
    listeners.add(force)
    return () => {
      listeners.delete(force)
    }
  }, [])
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex animate-toast-in items-center gap-2 rounded-lg border border-rule bg-surface px-3.5 py-2.5 text-[13px] text-ink shadow-md"
        >
          {ICONS[t.type]}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
