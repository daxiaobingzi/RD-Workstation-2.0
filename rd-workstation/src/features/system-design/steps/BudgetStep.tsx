import { Zap } from 'lucide-react'
import { BudgetService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/field'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../../components/ui/table'
import { cn, fmtMoney, fmtNum } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

export function BudgetStep({ psId, total, budgets, lastVersion, onGenerate }: { psId: string; total: number; budgets: ReturnType<typeof BudgetService.byProject>; lastVersion?: { id: string } | null; onGenerate: () => void }) {
  const items = BudgetService.items(budgets[0]?.id ?? '__none__')
  const budget = budgets[0]
  const family = BudgetService.byFamily(budget?.id ?? '__none__')
  const gradeEstimate = BudgetService.estimateByGrade(psId)
  const maxGrade = Math.max(...gradeEstimate.map((g) => g.total), 1)
  const familyMax = Math.max(...family.map((f) => f.amount), 1)
  const overTarget = budget?.target_amount ? total > budget.target_amount : false

  return (
    <StepCard title="预算" desc="基于清单版本估算预算，切换档次可对比，构成按设备族聚合">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11.5px] text-muted">当前预算总额{overTarget ? ' · 已超目标预算' : ''}</p>
          <p className={cn('font-mono text-2xl font-bold', overTarget ? 'text-danger' : 'text-ink')}>{fmtMoney(total)}</p>
          {budget?.target_amount ? (
            <p className="text-[11px] text-muted">目标 {fmtMoney(budget.target_amount)}</p>
          ) : (
            <p className="text-[11px] text-faint">未设目标预算</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {budget && (
            <Input
              type="number"
              defaultValue={budget.target_amount ?? ''}
              placeholder="设定目标预算"
              className="h-7 w-32 text-[12px]"
              onBlur={(e) => {
                const v = Number(e.target.value)
                if (v > 0) BudgetService.setTargetAmount(budget.id, v)
              }}
            />
          )}
          <Button size="sm" onClick={onGenerate} disabled={!lastVersion}><Zap className="size-3.5" />生成预算</Button>
        </div>
      </div>

      {/* 三档预算对比 */}
      {gradeEstimate.length > 0 && (
        <div className="mb-4 rounded-md border border-rule bg-surface-subtle/40 p-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">档次预算对比（同一推导结果）</p>
          <div className="space-y-2">
            {gradeEstimate.map((g) => (
              <div key={g.grade} className="flex items-center gap-2.5">
                <span className="w-14 shrink-0 text-[12px] text-muted">{g.label}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-[4px] bg-rule/40">
                  <div
                    className={cn('h-full rounded-[4px]', g.grade === 'premium' ? 'bg-accent' : g.grade === 'standard' ? 'bg-accent2' : 'bg-warn')}
                    style={{ width: `${Math.max(4, (g.total / maxGrade) * 100)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-[12px] font-semibold">{fmtMoney(g.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 构成占比 */}
      {family.length > 0 && (
        <div className="mb-4 rounded-md border border-rule bg-surface-subtle/40 p-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">预算构成（按设备族）</p>
          <div className="space-y-1.5">
            {family.map((f) => (
              <div key={f.name} className="flex items-center gap-2.5">
                <span className="w-24 shrink-0 truncate text-[12px] text-muted">{f.name}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-[4px] bg-rule/40">
                  <div className="h-full rounded-[4px] bg-gradient-to-r from-accent to-accent2" style={{ width: `${Math.max(3, (f.amount / familyMax) * 100)}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-[12px]">{fmtMoney(f.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-auto rounded-md border border-rule">
          <Table>
            <THead><TR><TH>清单项</TH><TH>数量</TH><TH>单价</TH><TH>金额</TH></TR></THead>
            <TBody>
              {items.map((i) => (
                <TR key={i.id} className="hover:bg-hover">
                  <TD className="font-medium">{i.bill_item_id}</TD>
                  <TD><NumCell>{fmtNum(i.quantity)}</NumCell></TD>
                  <TD className="font-mono text-[12px] text-muted">{fmtMoney(i.unit_price)}</TD>
                  <TD className="font-mono text-[12.5px] font-semibold">{fmtMoney(i.amount)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      {!budgets.length && <p className="text-[12px] text-faint">预算按清单版本生成；切换顶部档次可对比不同档预算。</p>}
    </StepCard>
  )
}