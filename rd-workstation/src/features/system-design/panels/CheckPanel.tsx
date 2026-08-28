import { PanelRight } from 'lucide-react'
import { DesignService } from '../../../services'
import { cn } from '../../../lib/utils'

export function CheckPanel({ checks }: { checks: ReturnType<typeof DesignService.check> }) {
  return (
    <div className="space-y-1.5">
      {checks.map((c, i) => (
        <div key={i} className="flex items-start gap-2 text-[12px]">
          <PanelRight className={cn('mt-0.5 size-3.5 shrink-0', c.severity === 'ok' ? 'text-ok' : c.severity === 'warn' ? 'text-warn' : 'text-danger')} />
          <span className="text-muted">{c.message}</span>
        </div>
      ))}
    </div>
  )
}