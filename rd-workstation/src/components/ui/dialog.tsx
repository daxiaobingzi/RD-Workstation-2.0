import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

function useEscape(onClose?: () => void) {
  React.useEffect(() => {
    if (!onClose) return
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])
}

function Overlay({ onClose, children }: { onClose?: () => void; children: React.ReactNode }) {
  useEscape(onClose)
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in bg-ink/20 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {children}
    </div>
  )
}

/** 模态框 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}) {
  if (!open) return null
  return (
    <Overlay onClose={onClose}>
      <div
        className="mx-auto my-[8vh] flex max-h-[84vh] animate-pop-in flex-col overflow-hidden rounded-xl border border-rule bg-surface shadow-lg"
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <button
            className="rounded-md p-1 text-faint hover:bg-hover hover:text-ink"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-auto px-4 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-rule px-4 py-3">{footer}</div>}
      </div>
    </Overlay>
  )
}

/** 抽屉 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  width = 400,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  side?: 'right' | 'left'
  width?: number
}) {
  if (!open) return null
  return (
    <Overlay onClose={onClose}>
      <div
        className={cn(
          'absolute top-0 flex h-full animate-slide-in-right flex-col border-rule bg-surface shadow-lg',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
        )}
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <button
            className="rounded-md p-1 text-faint hover:bg-hover hover:text-ink"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-rule px-4 py-3">{footer}</div>}
      </div>
    </Overlay>
  )
}
