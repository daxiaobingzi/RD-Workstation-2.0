import { useMemo, useState } from 'react'
import { Wallet, Calculator, Download, Zap, ExternalLink, X } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { ProjectService, BillService, BudgetService, DesignService } from '../../../services'
import { SysGroupedTable } from '../../../components/ui/sys-grouped-table'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'
import { fmtMoney, fmtNum, cn } from '../../../lib/utils'
import { exportBillFlat, exportBillSplit } from '../../bills/export-xlsx'

/** 设备中心富化展示字段（预算实时行 / 清单快照行共用） */
interface ItemView {
  deviceName?: string
  deviceCategory?: string
  unit?: string
  item_name?: string
  brandName?: string
  spec?: string
  specification?: string
  detail?: string
  deviceCode?: string
  remark?: string
}

interface BudgetRow {
  budgetId?: string
  projectSystemId?: string
  billItemId?: string
  /** 实时视图（预算清单）对应 device_selections 行 id */
  selectionId?: string
  quantity: number
  unit_price: number
  amount: number
  item?: ItemView
  /** 选型档次（预算实时行来自 grade_code，快照行按型号映射） */
  grade?: string
}

/** 模块⑦⑧ 预算清单 / 概算清单：同一预算版本数据源双视图（列序不同）
 *  - 预算清单：智能选型（三档/单系统）→ 档次/品牌/型号/详细参数/单价/金额，系统头=预算合计
 *  - 概算清单：已确认版本的只读快照，列序按方案（含双备注），系统头=合计金额
 */
export function BudgetListV2({ projectId, mode }: { projectId: string; mode: 'budget' | 'estimate' }) {
  useDB((s) => s.db)
  const [selVersionId, setSelVersionId] = useState('') // 切换到目标清单版本
  const [applying, setApplying] = useState(false)
  const [sysGrade, setSysGrade] = useState('standard')
  const [selPsSet, setSelPsSet] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<ItemView | null | undefined>(null)

  const systems = useMemo(() => ProjectService.systems(projectId), [projectId, useDB.getState().db])
  const versions = useMemo(() => BillService.versions(projectId), [projectId, useDB.getState().db])
  const budgets = useMemo(() => BudgetService.byProject(projectId).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')), [projectId, useDB.getState().db])

  const activeBudget = budgets[0]
  const activeVersion = versions.find((v) => v.id === (activeBudget?.bill_version_id ?? '')) ?? versions[0]
  const versionId = selVersionId || activeBudget?.bill_version_id || ''

  /** 预算清单·实时视图：直接以 device_selections 为数据源（换档 / 批量选型后即时刷新，不依赖已固化快照） */
  const liveRows = useMemo<BudgetRow[]>(() => BudgetService.liveByProject(projectId), [projectId, useDB.getState().db])

  /** 概算清单·快照视图：读 budget_items + 清单版本（已确认版本只读） */
  const snapshotRows = useMemo<BudgetRow[]>(() => {
    if (!activeBudget) return []
    const items = BudgetService.items(activeBudget.id)
    const byId = new Map(items.map((x) => [x.bill_item_id ?? '', x]))
    // 富化设备信息（设备名/品牌/型号/规格/详细参数），与材料表同链路
    const richItems = versionId ? BillService.items(versionId) : []
    const richById = new Map(richItems.map((bi) => [bi.id, bi] as const))
    // 档次来源：device_selections（按 model 映射）
    const db = useDB.getState().db
    const selections = db[T.device_selections] ?? []
    const gradeByModel = new Map((selections as { model_id?: string; grade_code?: string }[]).map((s) => [s.model_id ?? '', s.grade_code ?? '']))
    // 若按选中版本回看的清单明细不在当前 budget，则用 bill 明细构造展示行（只读估算）
    if (versionId && versionId !== activeBudget.bill_version_id) {
      return richItems.map((bi) => {
        const src = byId.get(bi.id)
        return { budgetId: activeBudget.id, billItemId: bi.id, quantity: bi.quantity, unit_price: src?.unit_price ?? bi.unit_price, amount: src?.amount ?? bi.amount, item: bi }
      })
    }
    return items
      .filter((x) => x.bill_item_id)
      .map((x) => ({
        budgetId: x.budget_id,
        projectSystemId: x.project_system_id,
        billItemId: x.bill_item_id,
        quantity: x.quantity,
        unit_price: x.unit_price,
        amount: x.amount,
        item: richById.get(x.bill_item_id ?? ''),
        grade: x.bill_item_id ? gradeByModel.get((richById.get(x.bill_item_id) as { device_model_id?: string } | undefined)?.device_model_id ?? '') : undefined,
      }))
  }, [activeBudget, versionId, useDB.getState().db])

  const rows = mode === 'budget' ? liveRows : snapshotRows
  const total = useMemo(() => rows.reduce((s, r) => s + (r.amount || 0), 0), [rows])

  // 档次估算（途中切换对比）
  const gradeEstimate = useMemo(() => {
    const grades = [
      { code: 'economic', label: '经济型' },
      { code: 'standard', label: '标准型' },
      { code: 'premium', label: '高端型' },
    ]
    return grades.map((g) => {
      const t = systems.reduce((s, ps) => {
        const e = BudgetService.estimateByGrade(ps.id).find((x) => x.grade === g.code)
        return s + (e?.total ?? 0)
      }, 0)
      return { ...g, total: t }
    })
  }, [systems])

  const applyProjectGrade = (grade: string) => {
    if (!systems.length) { toast('请先添加子系统', 'warn'); return }
    setApplying(true)
    const n = DesignService.applyGradeToProject(projectId, grade)
    toast(`已为 ${n} 个子系统按「${gradeName(grade)}」重新选型`)
    setApplying(false)
  }
  const applySelectedSystems = () => {
    if (!selPsSet.size) { toast('请先勾选要批量选型的系统', 'warn'); return }
    setApplying(true)
    let n = 0
    for (const psId of selPsSet) { DesignService.applyGrade(psId, sysGrade); n += 1 }
    toast(`已批量将 ${n} 个子系统按「${gradeName(sysGrade)}」重新选型`)
    setApplying(false)
    setSelPsSet(new Set())
  }
  const toggleSelPs = (id: string) => {
    setSelPsSet((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const confirmGenerate = () => {
    const { version, items } = BillService.generateProject(projectId)
    BudgetService.generateProject(projectId, version.id)
    toast(`已生成清单 ${version.version_no}（${items.length} 项）并同步预算`)
  }

  const grouped = useMemo(() => {
    // 骨架 = 项目全部子系统（与点表/推导同原理）：空系统也显示分组（空态）；key 统一用 project_systems.id，避免与行分组重复
    const nameByPs = new Map(systems.map((ps) => [ps.id, ps.systemName]))
    const map = new Map<string, { systemId: string; systemName: string; items: { section: string; row: BudgetRow }[] }>()
    for (const ps of systems) {
      map.set(ps.id, { systemId: ps.id, systemName: ps.systemName, items: [] })
    }
    for (const r of rows) {
      const key = r.projectSystemId ?? '__none__'
      const entry = map.get(key) ?? { systemId: key, systemName: key === '__none__' ? '未归入系统' : (nameByPs.get(key) ?? '未知系统'), items: [] }
      entry.items.push({ section: r.item?.deviceCategory ?? 'other', row: r })
      map.set(key, entry)
    }
    return [...map.values()]
  }, [rows, systems])

  /** 行内数量/单价调整：实时行写 device_selections，快照行同步 bill_item + budget_item */
  const tuneRow = (r: BudgetRow, patch: { quantity?: number; unit_price?: number }) => {
    if (r.selectionId) DesignService.updateSelection(r.selectionId, patch)
    else if (r.billItemId) BudgetService.tuneByBillItem(r.billItemId, patch)
    toast(patch.quantity !== undefined ? '数量已更新' : '单价已更新')
  }
  const removeRow = (r: BudgetRow) => {
    if (r.selectionId) { DesignService.removeSelection(r.selectionId); toast('已删除该选型行', 'info') }
    else if (r.billItemId) { BudgetService.removeByBillItem(r.billItemId); toast('已删除该预算行', 'info') }
  }

  const tdsBudget = (it: { section: string; row: unknown }) => {
    const r = it.row as BudgetRow
    const i = r.item
    // 预算清单 = 实时选型视图：有选型行即可行内调整（换档/批量选型后整表联动）
    const canEdit = !!r.selectionId
    return (
      <>
        <td className="px-2.5 py-1.5">
          <button type="button" className="inline-flex items-center gap-1 text-left text-[12.5px] font-medium text-accent hover:underline" title="设备名 → 设备中心通用参数/详细参数（同源联动）" onClick={() => setDetail(i)}>
            <ExternalLink className="size-3" />{i?.deviceName ?? '—'}
          </button>
        </td>
        <td className="max-w-[180px] truncate px-2.5 py-1.5 text-muted" title={i?.spec ?? i?.specification}>{i?.spec ?? '—'}</td>
        <td className="px-2.5 py-1.5 text-muted">{i?.unit}</td>
        <td className="px-2.5 py-1.5 text-right font-mono">
          {canEdit ? (
            <input key={r.selectionId ?? r.billItemId} type="number" defaultValue={r.quantity} className="h-6 w-20 rounded-[5px] border border-rule bg-surface px-1 text-right font-mono text-[12px] focus:border-accent focus:outline-none"
              onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== r.quantity) tuneRow(r, { quantity: v }) }} />
          ) : <span>{fmtNum(r.quantity)}</span>}
        </td>
        <td className="px-2.5 py-1.5"><GradeBadge grade={r.grade} /></td>
        <td className="px-2.5 py-1.5 text-muted">{i?.brandName ?? '—'}</td>
        <td className="px-2.5 py-1.5">
          <button type="button" className="font-mono text-[12px] text-accent hover:underline" onClick={() => setDetail(i)}>{i?.item_name ?? '—'}</button>
        </td>
        <td className="max-w-[200px] truncate px-2.5 py-1.5 text-muted" title={i?.detail ?? ''}>{i?.detail ?? '—'}</td>
        <td className="px-2.5 py-1.5 text-right font-mono">
          {canEdit ? (
            <input key={r.selectionId ?? r.billItemId} type="number" step="0.01" defaultValue={r.unit_price} className="h-6 w-24 rounded-[5px] border border-rule bg-surface px-1 text-right font-mono text-[12px] focus:border-accent focus:outline-none"
              onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== r.unit_price) tuneRow(r, { unit_price: v }) }} />
          ) : <span>{fmtMoney(r.unit_price)}</span>}
        </td>
        <td className="px-2.5 py-1.5 text-right font-mono font-semibold">{fmtMoney(r.amount)}</td>
        <td className="max-w-[140px] px-2.5 py-1.5">
          {canEdit && r.billItemId ? (
            <input defaultValue={i?.remark ?? ''} placeholder="填写备注（单行）" className="h-6 w-full min-w-[80px] rounded-[5px] border border-rule bg-surface px-1.5 text-[11.5px] focus:border-accent focus:outline-none"
              onBlur={(e) => { if (r.billItemId) { BudgetService.tuneRemarkByBillItem(r.billItemId, e.target.value); toast('备注已保存', 'info') } }} />
          ) : <span className="truncate text-faint">{i?.remark ?? (r.billItemId ? '' : '—')}</span>}
        </td>
        <td className="px-2 py-1">
          <button type="button" title="删除此行（实时行删选型 / 快照行同步清单与预算）" onClick={() => removeRow(r)} className="rounded p-1 text-faint hover:bg-hover hover:text-danger">🗑</button>
        </td>
      </>
    )
  }
  const tdsEstimate = (it: { section: string; row: unknown }) => {
    const r = it.row as BudgetRow
    const i = r.item
    return (
      <>
        <td className="px-2.5 py-1.5">
          <button type="button" className="text-left text-[12.5px] font-medium text-accent hover:underline" onClick={() => setDetail(i)}>{i?.deviceName ?? '—'}</button>
        </td>
        <td className="max-w-[170px] truncate px-2.5 py-1.5 text-muted" title={i?.spec ?? i?.specification}>{i?.spec ?? '—'}</td>
        <td className="px-2.5 py-1.5 text-muted">{i?.unit}</td>
        <td className="px-2.5 py-1.5 text-right font-mono">{fmtNum(r.quantity)}</td>
        <td className="max-w-[100px] truncate px-2.5 py-1.5 text-faint">{(i as { remark?: string }).remark ?? '—'}</td>
        <td className="px-2.5 py-1.5 text-muted">{i?.brandName ?? '—'}</td>
        <td className="px-2.5 py-1.5 font-mono">{i?.item_name ?? '—'}</td>
        <td className="max-w-[200px] truncate px-2.5 py-1.5 text-muted" title={i?.detail ?? ''}>{i?.detail ?? '—'}</td>
        <td className="px-2.5 py-1.5 text-right font-mono">{fmtMoney(r.unit_price)}</td>
        <td className="px-2.5 py-1.5 text-right font-mono font-semibold">{fmtMoney(r.amount)}</td>
      </>
    )
  }

  const columns = mode === 'budget'
    ? [
        { key: 'name', title: '设备名称', width: 160 }, { key: 'spec', title: '通用参数', width: 200 }, { key: 'unit', title: '单位', width: 56 }, { key: 'qty', title: '数量', align: 'right' as const, width: 76 },
        { key: 'grade', title: '档次', width: 64 }, { key: 'brand', title: '品牌', width: 100 }, { key: 'model', title: '型号', width: 140 }, { key: 'detail', title: '详细参数', width: 200 },
        { key: 'price', title: '单价', align: 'right' as const, width: 96 }, { key: 'amount', title: '金额', align: 'right' as const, width: 110 }, { key: 'remark', title: '备注', width: 130 }, { key: 'actions', title: '操作', width: 64 },
      ]
    : [
        { key: 'name', title: '设备名称', width: 160 }, { key: 'spec', title: '通用参数', width: 200 }, { key: 'unit', title: '单位', width: 56 }, { key: 'qty', title: '数量', align: 'right' as const, width: 76 },
        { key: 'remark', title: '备注', width: 110 }, { key: 'brand', title: '品牌', width: 100 }, { key: 'model', title: '型号', width: 140 }, { key: 'detail', title: '详细参数', width: 200 },
        { key: 'price', title: '单价', align: 'right' as const, width: 96 }, { key: 'amount', title: '金额', align: 'right' as const, width: 110 },
      ]

  return (
    <div className="space-y-3">
      {/* 工具条 */}
      <div className="rounded-lg border border-rule bg-surface p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'budget' ? <Wallet className="size-4 text-accent" /> : <Calculator className="size-4 text-accent2" />}
          <span className="text-[13px] font-semibold">{mode === 'budget' ? '预算清单' : '概算清单'}</span>
          <span className="text-[11.5px] text-faint">{mode === 'budget' ? '（智能选型 · 档次→品牌/型号/单价）' : '（已确认清单版本只读 · 列序按方案）'}</span>
          {mode === 'estimate' && activeVersion
            ? <span className="ml-2 rounded-full bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-muted">版本 {activeVersion.version_no} · {activeVersion.status === 'confirmed' ? '已确认' : '草稿'}</span>
            : <span className="ml-2 rounded-full bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-faint">选型实时预览 · 换档即时联动</span>}
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => { if (versionId) { void exportBillFlat(projectId, versionId); toast('已导出 Excel 整表分组') } else { toast('请先「确认生成清单」再导出', 'warn') } }}><Download className="size-3.5" />Excel 整表</Button>
            <Button size="sm" variant="outline" onClick={() => { if (versionId) { void exportBillSplit(projectId, versionId); toast('已导出 Excel 分系统') } else { toast('请先「确认生成清单」再导出', 'warn') } }}><Download className="size-3.5" />Excel 分系统</Button>
          </div>
        </div>

        {mode === 'budget' && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
              <span className="text-[12px] font-medium text-muted">整项目换档</span>
              {(['economic', 'standard', 'premium'] as const).map((g) => (
                <button key={g} type="button" disabled={applying} onClick={() => applyProjectGrade(g)} className="rounded-md border border-rule px-3 py-1 text-[12px] transition-colors hover:border-accent hover:text-accent disabled:opacity-50">
                  {gradeName(g)}
                </button>
              ))}
              <Button size="sm" onClick={confirmGenerate} className="ml-auto"><Zap className="size-3.5" />确认生成清单</Button>
            </div>

            {/* 系统批量选型：勾选多个系统 → 一次换档 */}
            <div className="mt-3 rounded-md border border-rule bg-surface-subtle/40 p-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[12px] font-medium text-muted">系统批量选型</span>
                <select value={sysGrade} onChange={(e) => setSysGrade(e.target.value)} className="h-7 w-24 rounded-[6px] border border-rule bg-surface px-2 text-[12px]">
                  {(['economic', 'standard', 'premium'] as const).map((g) => <option key={g} value={g}>{gradeName(g)}</option>)}
                </select>
                <Button size="sm" variant="outline" disabled={applying || !selPsSet.size} onClick={applySelectedSystems}>
                  <Zap className="size-3.5" />应用到所选系统{selPsSet.size ? `（${selPsSet.size}）` : ''}
                </Button>
                {selPsSet.size > 0 && <span className="text-[11px] text-faint">勾选 {selPsSet.size} 个子系统</span>}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {systems.map((ps) => (
                  <label key={ps.id} className="flex cursor-pointer items-center gap-1.5 text-[12px]">
                    <input type="checkbox" className="accent-accent" checked={selPsSet.has(ps.id)} onChange={() => toggleSelPs(ps.id)} />
                    <span className="font-mono text-[10.5px] text-faint">{ps.systemCode}</span>{ps.systemName}
                  </label>
                ))}
                {!systems.length && <span className="text-[12px] text-faint">暂无子系统</span>}
              </div>
            </div>
          </>
        )}
      </div>

      <p className="rounded-md border border-dashed border-rule bg-surface px-3 py-1.5 text-[11.5px] text-faint">
        {mode === 'budget'
          ? '交互：本表为实时选型预览 —— 换档 / 批量选型后 档次·品牌·型号·详细参数·单价 即时联动；行内可直接改 数量 / 单价；行可删除。确认满意后点「确认生成清单」固化版本（材料表 / 概算清单 / 导出将基于该版本）。'
          : '交互：表头可拖动调列宽（自动记忆）；本表为已确认版本的只读快照，数量/单价/备注修改请到「预算清单」页进行。'}
      </p>

      {/* KPI：总额 + 三档对比（预算模式） / 只读总额（概算模式） */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-rule bg-surface px-3 py-2.5">
          <p className="text-[11px] text-faint">{mode === 'budget' ? '预算总额（当前选型）' : '概算总额（已确认版本）'}</p>
          <p className="font-display font-mono text-xl font-bold">{fmtMoney(total)}</p>
          <p className="text-[11px] text-muted">{mode === 'budget'
            ? `${rows.length} 项选型${budgets[0]?.target_amount ? ` · 目标 ${fmtMoney(budgets[0].target_amount)}` : ' · 未设目标预算'}`
            : `${rows.length} 项`}</p>
        </div>
        {gradeEstimate.map((g) => (
          <div key={g.code} className={cn('rounded-lg border px-3 py-2.5', g.code === 'standard' ? 'border-accent/40 bg-accent-soft/30' : 'border-rule bg-surface')}>
            <p className="text-[11px] text-faint">{g.label}对比（同一推导）</p>
            <p className="font-mono text-[15px] font-bold">{fmtMoney(g.total)}</p>
            {total > 0 && <p className={cn('text-[11px]', g.total >= total ? 'text-muted' : 'text-ok')}>较当前 {g.total >= total ? '+' : ''}{(total ? ((g.total - total) / total) * 100 : 0).toFixed(1)}%</p>}
          </div>
        ))}
      </div>

      {/* 系统 → 五区分组表 */}
      {grouped.length ? (
        <SysGroupedTable
          systems={grouped}
          columns={columns}
          renderRow={mode === 'budget' ? tdsBudget : tdsEstimate}
          resizable
          resizableKey={`bud-${projectId}-${mode}`}
          amountOf={(it) => (it.row as BudgetRow).amount}
          empty={<div className="rounded-lg border border-rule bg-surface p-10 text-center text-[12.5px] text-faint">暂无预算明细</div>}
        />
      ) : (
        <div className="rounded-lg border border-rule bg-surface p-10 text-center text-[12.5px] text-faint">
          {mode === 'budget'
            ? '暂无设备选型。请先在「推导」页执行推导生成选型，即可在本页按档预览；确认后点击「确认生成清单」固化版本并同步预算。'
            : '尚无已确认的概算版本，请先在预算清单页确认生成。'}
        </div>
      )}

      {/* 版本切换（仅概算清单回看其它清单版本） */}
      {mode === 'estimate' && versions.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg border border-rule bg-surface px-3.5 py-2 text-[12px] text-muted">
          <span>回看版本</span>
          <select value={versionId} onChange={(e) => setSelVersionId(e.target.value)} className="h-7 rounded-[6px] border border-rule bg-surface px-2 font-mono text-[11.5px]">
            {versions.map((v) => <option key={v.id} value={v.id}>{v.version_no} · {v.name ?? ''}</option>)}
          </select>
          <span className="text-faint">回看不会修改当前预算</span>
        </div>
      )}

      {/* 设备中心参数预览（非富文本 · 一行一条/分号分隔） */}
      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`设备中心 · ${detail.deviceName ?? detail.item_name ?? ''}`} footer={<Button variant="outline" onClick={() => setDetail(null)}><X className="size-4" />关闭</Button>} width={560}>
          <div className="space-y-3">
            <div className="rounded-md border border-rule bg-surface-subtle/50 p-3">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">通用参数（Product.specification · 设备类型）</p>
              <div className="space-y-1 text-[12.5px] text-muted" style={{ whiteSpace: 'pre-wrap' }}>
                {splitLines(detail.spec ?? detail.specification ?? '暂无').map((l, i) => <p key={i}>• {l.trim()}</p>)}
              </div>
            </div>
            <div className="rounded-md border border-rule bg-surface-subtle/50 p-3">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">详细参数（ProductModel.detail_html · 按档次品牌型号）</p>
              <div className="space-y-1 text-[12.5px] text-muted" style={{ whiteSpace: 'pre-wrap' }}>
                {splitLines(detail.detail ?? '暂无').map((l, i) => <p key={i}>• {l.trim()}</p>)}
              </div>
            </div>
            <p className="text-[11px] text-faint">换档 → 改选品牌型号 → 详细参数与本弹窗内容同步刷新；与设备中心同源联动。</p>
          </div>
        </Modal>
      )}
    </div>
  )
}

function GradeBadge({ grade }: { grade?: string }) {
  if (!grade) return <span className="text-faint">—</span>
  const map: Record<string, { label: string; cls: string }> = {
    economic: { label: '经济', cls: 'bg-ok-soft/60 text-ok' },
    standard: { label: '标准', cls: 'bg-accent-soft text-accent' },
    premium: { label: '高端', cls: 'bg-purple-100 text-purple-700' },
  }
  const m = map[grade] ?? { label: grade, cls: 'bg-surface-subtle text-muted' }
  return <span className={cn('rounded-full px-1.5 py-px text-[10.5px] font-semibold', m.cls)}>{m.label}</span>
}

function gradeName(code: string) {
  return { economic: '经济型', standard: '标准型', premium: '高端型' }[code] ?? code
}

/** 参数文本按 换行 / 分号 拆成条目（兼容"一行一条"录入与历史分号存储） */
function splitLines(text?: string): string[] {
  return String(text ?? '').split(/\r?\n|；|;|\u3000/).map((l) => l.trim()).filter(Boolean)
}

export type { BudgetRow }