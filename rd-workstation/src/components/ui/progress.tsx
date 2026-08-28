import { cn } from '../../lib/utils'

export function Progress({
  value,
  className,
  barClassName,
  showLabel,
  tone = 'gradient',
}: {
  value: number
  className?: string
  barClassName?: string
  showLabel?: boolean
  tone?: 'gradient' | 'ok' | 'warn' | 'accent' | 'accent2'
}) {
  const v = Math.max(0, Math.min(100, value))
  const tones: Record<string, string> = {
    gradient: 'bg-gradient-to-r from-accent to-accent2',
    ok: 'bg-ok',
    warn: 'bg-warn',
    accent: 'bg-accent',
    accent2: 'bg-accent2',
  }
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-rule/70">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', tones[tone], barClassName)}
          style={{ width: `${v}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted">{Math.round(v)}%</span>
      )}
    </div>
  )
}
