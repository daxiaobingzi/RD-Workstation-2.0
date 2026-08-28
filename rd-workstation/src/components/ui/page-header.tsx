import * as React from 'react'
import { cn } from '../../lib/utils'

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-xl leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/** 区块标题行 */
export function SectionTitle({
  title,
  extra,
  className,
}: {
  title: React.ReactNode
  extra?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {extra}
    </div>
  )
}
