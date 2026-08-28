import * as React from 'react'
import { cn } from '../../lib/utils'

/** 分段控件：紧邻数据的小型视图切换 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'sm',
}: {
  options: { value: T; label: React.ReactNode }[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-[6px] border border-rule bg-surface-subtle p-0.5',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[5px] font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
            value === o.value
              ? 'bg-surface text-ink shadow-sm'
              : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
