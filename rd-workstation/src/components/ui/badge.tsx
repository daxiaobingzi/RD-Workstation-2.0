import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-subtle text-muted border border-rule',
        accent: 'bg-accent-soft text-accent',
        accent2: 'bg-accent2-soft text-accent2',
        ok: 'bg-ok-soft text-ok',
        warn: 'bg-warn-soft text-warn',
        danger: 'bg-danger-soft text-danger',
        violet: 'bg-violet-soft text-violet',
        outline: 'border border-rule text-muted bg-transparent',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

/** 带状态圆点的状态徽章：value → variant */
const STATUS_MAP: Record<string, { label: string; variant: 'ok' | 'warn' | 'danger' | 'accent' | 'accent2' | 'neutral' }> = {
  draft: { label: '草稿', variant: 'neutral' },
  designing: { label: '设计中', variant: 'accent' },
  reviewing: { label: '评审中', variant: 'warn' },
  completed: { label: '已完成', variant: 'ok' },
  archived: { label: '已归档', variant: 'neutral' },
  active: { label: '有效', variant: 'ok' },
  disabled: { label: '停用', variant: 'neutral' },
  done: { label: '已完成', variant: 'ok' },
  todo: { label: '待处理', variant: 'warn' },
  blocked: { label: '阻塞', variant: 'danger' },
  ok: { label: '正常', variant: 'ok' },
  warn: { label: '待处理', variant: 'warn' },
  danger: { label: '风险', variant: 'danger' },
  missing: { label: '缺价', variant: 'danger' },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const m = STATUS_MAP[status] ?? { label: status, variant: 'neutral' as const }
  return (
    <Badge variant={m.variant} className={cn('gap-1', className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {m.label}
    </Badge>
  )
}

export { Badge, badgeVariants }
