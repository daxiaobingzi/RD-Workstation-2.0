import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt, ChevronDown, Download, FolderKanban, Wallet } from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { T, type ProjectSystem } from '../../types/domain'
import { ProjectService, BillService, BudgetService } from '../../services'
import { PageHeader } from '../../components/ui/page-header'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../components/ui/table'
import { EmptyState } from '../../components/ui/empty'
import { toast } from '../../components/ui/toast'
import { fmtMoney, fmtNum, cn } from '../../lib/utils'

export function BillsPage() {
  useDB((s) => s.db)
  const navigate = useNavigate()
  const [openVersion, setOpenVersion] = useState<string | null>(null)

  const projects = useMemo(() => {
    const all = ProjectService.list()
    return all
      .map((p) => ({
        projectId: p.id,
        projectName: p.name,
        projectCode: p.project_code,
        versions: BillService.versions(p.id),
        budgetTotal: BudgetService.byProject(p.id).reduce((s, b) => s + b.total_amount, 0),
      }))
      .filter((r) => r.versions.length || r.budgetTotal > 0)
  }, [])

  const budgets = useMemo(() => {
    const db = useDB.getState().db
    const systemMap = new Map(db[T.systems].map((s) => [s.id, s as unknown as { name: string; code: string }]))
    const familyName = new Map((db[T.product_families] ?? []).map((f) => [f.id, (f as unknown as { name: string }).name]))
    const productFam = new Map((db[T.products] ?? []).map((p) => [p.id, (p as unknown as { product_family_id: string }).product_family_id]))
    const modelFam = new Map((db[T.product_models] ?? []).map((m) => [m.id, productFam.get((m as unknown as { product_id: string }).product_id)]))
    const billOf = new Map((db[T.bill_items] ?? []).map((i) => [i.id, i as unknown as { device_model_id?: string }]))
    const billIds = new Set(billOf.keys())

    // 按 budget_items.project_system_id 精确归属各系统预算（未生成预算的系统不计入）
    const agg = new Map<string, { total: number; family: Map<string, number> }>()
    for (const bi of (db[T.budget_items] ?? []) as unknown as { project_system_id?: string; bill_item_id?: string; amount: number }[]) {
      if (!bi.project_system_id) continue
      let row = agg.get(bi.project_system_id)
      if (!row) { row = { total: 0, family: new Map() }; agg.set(bi.project_system_id, row) }
      row.total += bi.amount || 0
      const billItem = bi.bill_item_id && billIds.has(bi.bill_item_id) ? billOf.get(bi.bill_item_id) : undefined
      const famId = billItem?.device_model_id ? modelFam.get(billItem.device_model_id) : undefined
      const name = famId ? (familyName.get(famId) ?? '其他') : '其他'
      row.family.set(name, (row.family.get(name) ?? 0) + (bi.amount || 0))
    }

    return (db[T.project_systems] as ProjectSystem[])
      .map((ps) => {
        const row = agg.get(ps.id)
        const system = systemMap.get(ps.system_id)
        return {
          ps,
          systemName: system?.name ?? '未知系统',
          systemCode: system?.code ?? '',
          total: row?.total ?? 0,
          family: row ? [...row.family.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount) : [],
          grades: BudgetService.estimateByGrade(ps.id),
        }
      })
      .filter((r) => r.total > 0)
  }, [])

  const versionCount = projects.reduce((s, p) => s + p.versions.length, 0)
  const itemCount = projects.reduce((s, p) => s + p.versions.reduce((x, v) => x + BillService.items(v.id).length, 0), 0)
  const budgetTotal = budgets.reduce((s, r) => s + r.total, 0)

  const exportVersion = (projectId: string, versionId: string, label: string) => {
    const csv = BillService.exportCSV(versionId)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectId}-清单-${label}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('清单已导出 CSV')
  }

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-5">
      <PageHeader title="清单" subtitle="项目清单 · 版本 · 系统预算 · 导出" />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="清单版本" value={fmtNum(versionCount)} icon={<Receipt className="size-4" />} />
        <StatCard label="清单项" value={fmtNum(itemCount)} icon={<Receipt className="size-4" />} />
        <StatCard label="预算总额" value={fmtMoney(budgetTotal)} icon={<Wallet className="size-4" />} />
        <StatCard label="涉及项目" value={fmtNum(projects.length)} icon={<FolderKanban className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 项目清单 */}
        <section className="lg:col-span-7">
          <div className="rounded-lg border border-rule bg-surface shadow-sm">
            <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
              <Receipt className="size-4 text-accent" />
              <h3 className="text-[13px] font-semibold">项目清单</h3>
              <span className="rounded-full bg-surface-subtle px-1.5 text-[10.5px] text-muted">{projects.length}</span>
            </div>
            <div className="space-y-3 p-3.5">
              {projects.map((p) => (
                <div key={p.projectId} className="rounded-lg border border-rule">
                  <div className="flex items-center gap-2 border-b border-rule bg-surface-subtle/40 px-3 py-2">
                    <span className="font-mono text-[10.5px] text-faint">{p.projectCode}</span>
                    <span className="truncate text-[13px] font-semibold">{p.projectName}</span>
                    <span className="ml-auto font-mono text-[12px] text-muted">{fmtNum(p.versions.length)} 个版本</span>
                    {p.budgetTotal > 0 && <span className="font-mono text-[11.5px] text-accent">{fmtMoney(p.budgetTotal)}</span>}
                  </div>
                  <div className="space-y-2 p-2.5">
                    {p.versions.map((v) => {
                      const items = BillService.items(v.id)
                      const total = items.reduce((s, i) => s + i.amount, 0)
                      const summary = BillService.summary(v.id)
                      const open = openVersion === v.id
                      return (
                        <div key={v.id} className="rounded-md border border-rule px-2.5 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="flex items-center gap-1.5 font-mono text-[12px] font-semibold text-accent hover:underline"
                              onClick={() => setOpenVersion(open ? null : v.id)}
                            >
                              <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
                              {v.version_no}
                            </button>
                            <span className="text-[11.5px] text-muted">{v.name}</span>
                            <StatusBadge status={v.status ?? 'draft'} />
                            <span className="ml-auto font-mono text-[12px] text-muted">{fmtNum(items.length)} 项 · {fmtMoney(total)}</span>
                            <Button size="xs" variant="outline" onClick={() => exportVersion(p.projectId, v.id, v.version_no)}>
                              <Download className="size-3" />导出
                            </Button>
                          </div>
                          {open && (
                            <div className="mt-2">
                              <div className="overflow-auto rounded-md border border-rule">
                                <Table>
                                  <THead><TR><TH>编码</TH><TH>名称</TH><TH>类别</TH><TH>数量</TH><TH>单价</TH><TH>金额</TH></TR></THead>
                                  <TBody>
                                    {items.map((i) => (
                                      <TR key={i.id}>
                                        <TD><NumCell>{i.item_code}</NumCell></TD>
                                        <TD className="font-medium">{i.item_name}</TD>
                                        <TD className="text-muted">{i.category}</TD>
                                        <TD><NumCell>{fmtNum(i.quantity)}</NumCell></TD>
                                        <TD className="font-mono text-[12px] text-muted">{fmtMoney(i.unit_price)}</TD>
                                        <TD className="font-mono text-[12.5px] font-semibold">{fmtMoney(i.amount)}</TD>
                                      </TR>
                                    ))}
                                  </TBody>
                                </Table>
                              </div>
                              {summary.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-muted">
                                  {summary.map((s) => (
                                    <span key={s.category}>{s.category} <b className="font-mono text-ink">{fmtMoney(s.amount)}</b></span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {!p.versions.length && <p className="px-1 py-1 text-[12px] text-faint">暂无清单版本</p>}
                  </div>
                </div>
              ))}
              {!projects.length && (
                <EmptyState icon={<Receipt />} title="暂无清单" description="在系统设计工作区生成设备选型后即可生成清单" />
              )}
            </div>
          </div>
        </section>

        {/* 系统预算 */}
        <section className="lg:col-span-5">
          <div className="rounded-lg border border-rule bg-surface shadow-sm">
            <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
              <Wallet className="size-4 text-accent" />
              <h3 className="text-[13px] font-semibold">系统预算</h3>
              <span className="rounded-full bg-surface-subtle px-1.5 text-[10.5px] text-muted">{budgets.length}</span>
            </div>
            <div className="space-y-2.5 p-3.5">
              {budgets.map((r) => {
                const maxFam = Math.max(...r.family.map((f) => f.amount), 1)
                const maxGrade = Math.max(...r.grades.map((g) => g.total), 1)
                return (
                  <button
                    key={r.ps.id}
                    type="button"
                    onClick={() => navigate(`/projects/${r.ps.project_id}/systems/${r.ps.id}`)}
                    className="block w-full rounded-lg border border-rule bg-surface-subtle/40 p-3 text-left transition-colors hover:border-accent/40 hover:bg-hover"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10.5px] text-faint">{r.systemCode}</span>
                      <span className="text-[13px] font-semibold">{r.systemName}</span>
                      <span className="ml-auto font-mono text-[14px] font-bold text-ink">{fmtMoney(r.total)}</span>
                    </div>
                    {r.family.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {r.family.slice(0, 3).map((f) => (
                          <div key={f.name} className="flex items-center gap-2">
                            <span className="w-16 shrink-0 truncate text-[11px] text-muted">{f.name}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule/70">
                              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2" style={{ width: `${(f.amount / maxFam) * 100}%` }} />
                            </div>
                            <span className="w-16 shrink-0 text-right font-mono text-[10.5px] text-muted">{fmtMoney(f.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.grades.length > 0 && (
                      <div className="mt-2 flex gap-1.5">
                        {r.grades.map((g) => (
                          <span
                            key={g.grade}
                            className="flex-1 rounded-[4px] border border-rule bg-surface px-1.5 py-1 text-center"
                            style={{ width: `${Math.max(20, (g.total / maxGrade) * 100)}%` }}
                          >
                            <span className="block text-[10px] text-muted">{g.label}</span>
                            <span className="block font-mono text-[10.5px] font-semibold">{fmtMoney(g.total)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
              {!budgets.length && (
                <EmptyState icon={<Wallet />} title="暂无系统预算" description="生成清单后为系统生成预算" />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-surface px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">{icon}{label}</div>
      <p className="mt-1 font-mono text-[20px] leading-none font-bold text-ink">{value}</p>
    </div>
  )
}