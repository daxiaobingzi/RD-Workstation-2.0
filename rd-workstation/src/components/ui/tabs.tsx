import * as React from 'react'
import { cn } from '../../lib/utils'

/** 顶部 Tab 栏 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: React.ReactNode; badge?: number }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto border-b border-rule', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            'relative shrink-0 px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors',
            value === t.value ? 'text-accent' : 'text-muted hover:text-ink',
          )}
        >
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className="ml-1.5 rounded-full bg-surface-subtle px-1.5 text-[10px] text-muted">
              {t.badge}
            </span>
          )}
          {value === t.value && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
          )}
        </button>
      ))}
    </div>
  )
}
