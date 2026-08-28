import * as React from 'react'
import { cn } from '../../lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-surface-subtle text-faint [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-[12.5px] text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
