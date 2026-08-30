import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt, ChevronDown, Download, FolderKanban, Wallet, Search, Trash2, BadgeCheck } from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { T, type ProjectSystem } from '../../types/domain'
import { ProjectService, BillService, BudgetService } from '../../services'
import { BillItemsTable } from './BillItemsTable'
import { exportBillFlat, exportBillSplit } from './export-xlsx'
import { PageHeader } from '../../components/ui/page-header'
import { StatusBadge, Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input, Select } from '../../components/ui/field'
import { EmptyState } from '../../components/ui/empty'
import { toast } from '../../components/ui/toast'
import { fmtMoney, fmtNum, cn } from '../../lib/utils'

export function BillsPage() {
  useDB((s) => s.db)
  const navigate = useNavigate()
  const [openVersion, setOpenVersion] = useState<string | null>(null)
  const [q, setQ] = useState('')
  // 按项目筛选（'' = 全部项目）
  const [projectFilter, setProjectFilter] = useState('')
  // 删除版本（二次确认）；明细行删除已由 BillItemsTable 内部处理
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const db = useDB.getState().db

  const askDel = (itemId: string, cb: () => void) => {
    if (confirmDel === itemId) { setConfirmDel(null); cb(); return }
    setConfirmDel(itemId)
    window.setTimeout(() => setConfirmDel((c) => (c === itemId ? null : c)), 2500)
  }

  const projects = useMemo(() => {
    const all = ProjectService.list()
    return all
      .map((p) => ({
        projectId: p.id,
        projectName: p.name,
        projectCode: p.project_code,
        clientName: p.client_name,
        // 全局清单页汇总「各项目已确认（confirmed）的最终版本」
        versions: BillService.versions(p.id).filter((v) => v.status === 'confirmed'),
        budgetTotal: BudgetService.byProject(p.id).reduce((s, b) => s + b.total_amount, 0),
      }))
      .filter((r) => r.versions.length || r.budgetTotal > 0)
  }, [db])

  // 项目清单展示列：项目筛选 + 搜索过滤（名称/编号/业主）+ 有版本的按最近版本时间倒序，无版本（仅预算）排末尾
  const visibleProjects = useMemo(() => {
    const kw = q.trim().toLowerCase()
    let filtered = projectFilter ? projects.filter((p) => p.projectId === projectFilter) : projects
    if (kw) filtered = filtered.filter((p) => [p.projectName, p.projectCode, p.clientName].some((v) => v?.toLowerCase().includes(kw)))
    return [...filtered].sort((a, b) => {
      const ta = a.versions[0]?.created_at ?? ''
      const tb = b.versions[0]?.created_at ?? ''
      if (ta && tb) return tb.localeCompare(ta)
      if (ta) return -1
      if (tb) return 1
      return 0
    })
  }, [projects, q, projectFilter])

  const budgets = useMemo(() => {
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
  }, [db])

  const versionCount = projects.reduce((s, p) => s + p.versions.length, 0)
  const itemCount = projects.reduce((s, p) => s + p.versions.reduce((x, v) => x + BillService.items(v.id).length, 0), 0)
  const budgetTotal = budgets.reduce((s, r) => s + r.total, 0)
  // 项目 id → 名称，供系统预算卡片标注所属项目（多项目同名系统可区分）
  const projectNameOf = useMemo(() => new Map(projects.map((p) => [p.projectId, p.projectName])), [projects])
  // 系统预算按项目筛选（与左侧清单面板联动）
  const visibleBudgets = useMemo(
    () => (projectFilter ? budgets.filter((r) => r.ps.project_id === projectFilter) : budgets),
    [budgets, projectFilter],
  )

  const exportVersion = (projectId: string, versionId: string, label: string, mode: 'flat' | 'split') => {
    if (mode === 'flat') { void exportBillFlat(projectId, versionId); toast(`已导出整表分组 Excel（${label}）`) }
    else { void exportBillSplit(projectId, versionId); toast(`已导出按系统分 Sheet 的 Excel（${label}）`) }
  }

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-5">
      <PageHeader
        title="清单"
        subtitle="各项目已确认最终清单 · 版本管理 · 预算 · 导出"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-muted">按项目筛选</span>
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-7 w-44 text-[12.5px]"
            >
              <option value="">全部项目</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
              ))}
            </Select>
            {projectFilter && (
              <button
                type="button"
                onClick={() => setProjectFilter('')}
                className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] text-muted hover:text-danger"
              >
                清除筛选
              </button>
            )}
          </div>
        }
      />

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
              <span className="rounded-full bg-surface-subtle px-1.5 text-[10.5px] text-muted">{visibleProjects.length}</span>
              <div className="relative ml-auto">
                <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索项目 / 编号…" className="h-7 w-48 pl-7 text-[12.5px]" />
              </div>
            </div>
            <div className="space-y-3 p-3.5">
              {visibleProjects.map((p) => (
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
                      const locked = v.status === 'confirmed'
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
                            {v.status === 'confirmed'
                              ? <Badge variant="ok"><BadgeCheck className="size-3" />已确认</Badge>
                              : <><StatusBadge status={v.status ?? 'draft'} />
                                  <button
                                    type="button"
                                    title="确认版本后冻结状态"
                                    onClick={() => { BillService.setVersionStatus(v.id, 'confirmed'); toast(`版本 ${v.version_no} 已确认`) }}
                                    className="rounded-full border border-ok/40 px-1.5 py-0.5 text-[10.5px] font-medium text-ok hover:bg-ok-soft"
                                  >
                                    <BadgeCheck className="size-3" />确认
                                  </button>
                                </>}
                            <span className="ml-auto font-mono text-[12px] text-muted">{fmtNum(items.length)} 项 · {fmtMoney(total)}</span>
                            <Button size="xs" variant="outline" title="整表分组（全部系统一 Sheet）+ 汇总 Sheet" onClick={() => exportVersion(p.projectId, v.id, v.version_no, 'flat')}>
                              <Download className="size-3" />Excel 整表
                            </Button>
                            <Button size="xs" variant="outline" title="每系统一个 Sheet + 汇总 Sheet" onClick={() => exportVersion(p.projectId, v.id, v.version_no, 'split')}>
                              <Download className="size-3" />Excel 分系统
                            </Button>
                            <button
                              type="button"
                              title={confirmDel === `v-${v.id}` ? '再次点击确认删除整个版本' : '删除整个版本（需两次点击确认，不可恢复）'}
                              aria-label={confirmDel === `v-${v.id}` ? `再次点击确认删除版本 ${v.version_no}` : `删除版本 ${v.version_no}`}
                              onClick={() => askDel(`v-${v.id}`, () => { BillService.remove(v.id); toast(`版本 ${v.version_no} 已删除`, 'info') })}
                              className={cn(
                                'rounded p-1 transition-colors',
                                confirmDel === `v-${v.id}` ? 'bg-danger text-white' : 'text-faint hover:bg-hover hover:text-danger',
                              )}
                            >
                              {confirmDel === `v-${v.id}` && <span className="mr-1 text-[10px] font-medium">确认？</span>}
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          {open && (
                            <div className="mt-2">
                              <BillItemsTable items={items} locked={locked} />
                              {summary.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-muted">
                                  {summary.map((s) => (
                                    <span key={s.category}>{s.category} <b className="font-mono text-ink">{fmtMoney(s.amount)}</b></span>
                                  ))}
                                </div>
                              )}
                              {v.status === 'confirmed' && (
                                <p className="mt-1 text-[11px] text-faint">已确认版本不可再调整，如需修改请新建版本或撤销确认。</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {!p.versions.length && <p className="px-1 py-1 text-[12px] text-faint">暂无已确认清单版本</p>}
                  </div>
                </div>
              ))}
              {!visibleProjects.length && (
                <EmptyState
                  icon={<Receipt />}
                  title={q.trim() ? '未找到匹配项目' : '暂无已确认清单'}
                  description={q.trim() ? '换个关键词试试（项目名称 / 编号）' : '到项目中心 → 预算页点击「确认生成清单」并确认版本后，此处汇总各项目最终清单'}
                />
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
              <span className="rounded-full bg-surface-subtle px-1.5 text-[10.5px] text-muted">{visibleBudgets.length}</span>
            </div>
            <div className="space-y-2.5 p-3.5">
              {visibleBudgets.map((r) => {
                const maxFam = Math.max(...r.family.map((f) => f.amount), 1)
                const maxGrade = Math.max(...r.grades.map((g) => g.total), 1)
                return (
                  <button
                    key={r.ps.id}
                    type="button"
                    onClick={() => navigate(`/projects-v2/${r.ps.project_id}/derive`)}
                    className="block w-full rounded-lg border border-rule bg-surface-subtle/40 p-3 text-left transition-colors hover:border-accent/40 hover:bg-hover"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10.5px] text-faint">{r.systemCode}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-[13px] font-semibold">{r.systemName}</span>
                        <span className="ml-1.5 text-[10.5px] text-faint">· {projectNameOf.get(r.ps.project_id) ?? '未知项目'}</span>
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[14px] font-bold text-ink">{fmtMoney(r.total)}</span>
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
              {!visibleBudgets.length && (
                <EmptyState icon={<Wallet />} title={projectFilter ? '该项目暂无系统预算' : '暂无系统预算'} description="生成清单后为系统生成预算" />
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