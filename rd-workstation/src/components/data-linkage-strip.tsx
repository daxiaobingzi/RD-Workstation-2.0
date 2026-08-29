import { ArrowRight } from 'lucide-react'
import { PointService, DesignService, BillService, BudgetService } from '../services'
import { fmtMoney, fmtNum } from '../lib/utils'

export function DataLinkageStrip({ psId, projectId }: { psId: string; projectId: string }) {
  const points = PointService.list(psId).reduce((s, p) => s + (p.quantity || 0), 0)
  const results = DesignService.results(psId)
  const selections = DesignService.selections(psId)
  const derived = results.reduce((s, r) => s + r.quantity, 0)
  const missing = selections.filter((s) => !s.unit_price || s.unit_price <= 0).length
  const versions = BillService.versions(projectId)
  const currentVersion = versions[0]
  const billCount = currentVersion ? BillService.items(currentVersion.id).length : 0
  const budgetTotal = BudgetService.byProject(projectId).reduce((s, b) => s + b.total_amount, 0)

  const steps = [
    { label: '点位', value: `${fmtNum(points)}`, tone: 'default' as const },
    { label: '推导设备', value: `${fmtNum(derived)}`, tone: 'default' as const },
    { label: '缺价', value: `${fmtNum(missing)}`, tone: missing > 0 ? ('warn' as const) : ('ok' as const) },
    { label: '清单', value: `${fmtNum(billCount)} 项`, tone: billCount > 0 ? ('ok' as const) : ('default' as const) },
    { label: '预算', value: fmtMoney(budgetTotal), tone: budgetTotal > 0 ? ('ok' as const) : ('default' as const) },
  ]

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-rule bg-surface px-3 py-2 scrollbar-none">
      {steps.map((s, i) => (
        <div key={s.label} className="flex shrink-0 items-center gap-1">
          <div className="flex flex-col items-center px-1">
            <span
              className={
                s.tone === 'warn'
                  ? 'font-mono text-[14px] leading-none font-bold text-warn'
                  : s.tone === 'ok'
                    ? 'font-mono text-[14px] leading-none font-bold text-ok'
                    : 'font-mono text-[14px] leading-none font-bold text-ink'
              }
            >
              {s.value}
            </span>
            <span className="mt-0.5 text-[10px] text-muted">{s.label}</span>
          </div>
          {i < steps.length - 1 && <ArrowRight className="size-3.5 text-accent" />}
        </div>
      ))}
    </div>
  )
}
