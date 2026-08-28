import { ShieldCheck } from 'lucide-react'
import { DesignService } from '../../../services'
import { cn } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

export function ValidateStep({ checks }: { checks: ReturnType<typeof DesignService.check> }) {
  return (
    <StepCard title="设计校核" desc="确定性机器检查，复杂判断交由 AI">
      <ul className="space-y-2">
        {checks.map((c, i) => (
          <li key={i} className={cn(
            'flex items-start gap-2.5 rounded-md border px-3 py-2.5',
            c.severity === 'ok' ? 'border-ok/30 bg-ok-soft/40' : c.severity === 'warn' ? 'border-warn/30 bg-warn-soft/40' : 'border-danger/30 bg-danger-soft/40',
          )}>
            <ShieldCheck className={cn('mt-0.5 size-4 shrink-0', c.severity === 'ok' ? 'text-ok' : c.severity === 'warn' ? 'text-warn' : 'text-danger')} />
            <div>
              <p className="text-[13px] font-medium">{checkTypeName(c.type)}</p>
              <p className="text-[12px] text-muted">{c.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </StepCard>
  )
}

function checkTypeName(t: string) {
  return { missing_device: '缺设备', missing_camera: '摄像机选型', missing_price: '缺价格', storage: '存储容量', no_point: '点位', category_coverage: '类别覆盖', disabled_model: '停用型号' }[t] ?? t
}