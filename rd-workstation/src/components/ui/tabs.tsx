import * as React from 'react'
import { Check, type LucideIcon } from 'lucide-react'
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

/** 左侧步骤流程栏（系统设计工作区） */
export function StepRail({
  steps,
  current,
  onSelect,
  className,
}: {
  steps: { key: string; label: string; icon?: LucideIcon; done?: boolean }[]
  current: string
  onSelect: (key: string) => void
  className?: string
}) {
  return (
    <nav className={cn('flex flex-col gap-0.5', className)} aria-label="设计步骤">
      {steps.map((s, i) => {
        const active = s.key === current
        const done = s.done
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            className={cn(
              'group flex items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors',
              active ? 'bg-accent-soft font-semibold text-accent' : done ? 'text-ink hover:bg-hover' : 'text-faint hover:bg-hover hover:text-muted',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-[5px] font-mono text-[10.5px]',
                active
                  ? 'bg-accent text-white'
                  : done
                    ? 'bg-ok-soft text-ok'
                    : 'bg-surface-subtle text-faint',
              )}
            >
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            <span className="truncate">{s.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
