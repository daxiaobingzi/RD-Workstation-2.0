import { ArrowRight } from 'lucide-react'
import { DesignService } from '../../../services'
import { cn, fmtNum } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

export function TopologyStep({ results, selections }: { results: ReturnType<typeof DesignService.results>; selections: ReturnType<typeof DesignService.selections> }) {
  const qty = (type: string) => results.find((r) => r.result_type === type)?.quantity ?? 0
  const nodes = [
    { label: '摄像机点位', value: results[0] ? qty('camera') || qtyAll(results) : 0, color: 'bg-accent' },
    { label: 'POE 交换机', value: qty('poe_switch'), color: 'bg-accent2' },
    { label: '汇聚交换机', value: qty('aggregation'), color: 'bg-violet' },
    { label: 'NVR', value: qty('nvr'), color: 'bg-ok' },
    { label: '硬盘', value: qty('hdd'), color: 'bg-warn' },
  ]
  return (
    <StepCard title="系统拓扑" desc="点位 → 接入 → 汇聚 → 存储 的组网关系">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-rule bg-surface-subtle/50 p-4">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex items-center gap-2">
            <div className="flex flex-col items-center rounded-md border border-rule bg-surface px-4 py-3 shadow-sm">
              <span className={cn('mb-1.5 h-1 w-8 rounded-full', n.color)} />
              <span className="font-mono text-[18px] font-bold text-ink">{fmtNum(n.value)}</span>
              <span className="text-[11px] text-muted">{n.label}</span>
            </div>
            {i < nodes.length - 1 && <ArrowRight className="size-4 text-accent" />}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">设备选型：{selections.map((s) => s.modelName).filter(Boolean).join(' · ')}</p>
    </StepCard>
  )
}

function qtyAll(results: { quantity: number }[]) {
  return results[0]?.quantity ?? 0
}