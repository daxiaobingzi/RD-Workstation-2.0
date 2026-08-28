import { useMemo, useState } from 'react'
import {
  Search, Plus, Boxes, Pencil, Trash2, Power, AlertTriangle, X, BadgeCheck, Users, Save, Download, UploadCloud, TrendingUp, Percent,
} from 'lucide-react'
import { useDB } from '../domain/db'
import { T, type ProductModel, type DeviceCategory, type Brand, type Supplier, type Price } from '../domain/types'
import { DeviceService } from '../domain/services'
import { DeviceImportModal } from '../components/device-import'
import { DeviceAnalytics } from '../components/device-analytics'
import { StatusBadge } from '../components/ui/badge'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input, Select, Field } from '../components/ui/field'
import { Modal } from '../components/ui/dialog'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../components/ui/table'
import { PageHeader } from '../components/ui/page-header'
import { EmptyState } from '../components/ui/empty'
import { toast } from '../components/ui/toast'
import { fmtMoney, fmtNum, cn } from '../lib/utils'

const GRADE_LABEL: Record<string, string> = { economic: '经济型', standard: '标准型', premium: '高端型' }
const PRICE_TYPE_LABEL: Record<string, string> = { reference: '参考价', market: '市场价', supplier: '供应商价', project: '项目价' }
const PRICE_TYPES = ['reference', 'market', 'supplier', 'project'] as const
const SYSTEM_GROUPS: Record<string, string> = { sys_vss: '安全防范（视频监控）', sys_lan: '信息网络（网络设备）', __other: '通用设备' }

type WarnFilter = 'missing_price' | 'disabled_use' | null

/** 设备中心：设备主数据（类别→产品族→产品→型号→品牌→价格），作为清单数据中心 */
export function DeviceCenterPage() {
  useDB((s) => s.db)
  const [categoryId, setCategoryId] = useState('dc_front')
  const [familyId, setFamilyId] = useState<string | undefined>()
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [q, setQ] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [warnFilter, setWarnFilter] = useState<WarnFilter>(null)
  const [modelModal, setModelModal] = useState<{ open: boolean; model?: ProductModel }>({ open: false })
  const [brandModal, setBrandModal] = useState<{ open: boolean; brand?: Brand }>({ open: false })
  const [supplierModal, setSupplierModal] = useState<{ open: boolean; supplier?: Supplier }>({ open: false })
  const [catModal, setCatModal] = useState<{ open: boolean }>({ open: false })
  const [famModal, setFamModal] = useState<{ open: boolean }>({ open: false })
  const [gradeWarnOpen, setGradeWarnOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [impactOpen, setImpactOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [adjustPct, setAdjustPct] = useState('')
  const [paramModal, setParamModal] = useState<{ open: boolean; model?: ProductModel }>({ open: false })
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const categories = DeviceService.categories()
  const families = DeviceService.families(categoryId)
  const stats = DeviceService.stats()

  const models = useMemo(() => {
    const rows = DeviceService.models(familyId ?? undefined) as (ProductModel & { familyId?: string })[]
    // 预建引用集（替代逐行全表扫描）
    const db = useDB.getState().db
    const usedIds = new Set<string>()
    for (const s of (db[T.device_selections] ?? []) as unknown as { model_id?: string }[]) { if (s.model_id) usedIds.add(s.model_id) }
    for (const b of (db[T.bill_items] ?? []) as unknown as { device_model_id?: string }[]) { if (b.device_model_id) usedIds.add(b.device_model_id) }
    return rows
      .map((m) => ({
        m,
        brand: DeviceService.brandOf(m.id),
        price: DeviceService.price(m.id),
        grade: DeviceService.gradeCodeOf(m.id), // 展示/筛选口径：绑定优先
        inUse: usedIds.has(m.id),
        params: (m.parameter_json ?? {}) as Record<string, unknown>,
      }))
      .filter(({ m, price, grade, inUse }) => {
        if (gradeFilter !== 'all' && grade !== gradeFilter) return false
        if (warnFilter === 'missing_price' && price > 0) return false
        if (warnFilter === 'disabled_use' && !(m.status === 'disabled' && inUse)) return false
        if (!q.trim()) return true
        const kw = q.trim().toLowerCase()
        return [m.model, m.specification, DeviceService.brandOf(m.id).name ?? ''].some((v) => v?.toLowerCase().includes(kw))
      })
      .sort((a, b) => a.m.model.localeCompare(b.m.model))
  }, [familyId, q, gradeFilter, warnFilter, categoryId, useDB.getState().db])

  const selected = models.find((r) => r.m.id === selectedId) ?? models[0]
  const selectedModelRow = selected
    ? {
        model: selected.m,
        spec: selected.m.specification,
        brand: selected.brand,
        grade: selected.grade,
        prices: DeviceService.prices(selected.m.id),
        usage: DeviceService.modelUsage(selected.m.id),
        params: selected.params,
      }
    : null
  const selectedFamily = (f: string) => families.find((x) => x.id === f)
  const currentFamilyName = familyId ? (selectedFamily(familyId)?.name ?? '') : ''

  const pickFamily = (fId: string) => {
    setFamilyId(fId)
    setSelectedId(undefined)
  }
  const pickCategory = (cId: string) => {
    setCategoryId(cId)
    setFamilyId(undefined)
    setSelectedId(undefined)
  }

  const toggleStatus = (m: ProductModel) => {
    DeviceService.setModelStatus(m.id, m.status === 'disabled' ? 'active' : 'disabled')
    toast(m.status === 'disabled' ? '型号已恢复启用' : '型号已停用', m.status === 'disabled' ? 'success' : 'warn')
  }
  const removeModel = (m: ProductModel) => {
    const r = DeviceService.removeModel(m.id)
    if (!r.ok) { toast(r.reason ?? '无法删除', 'error'); return }
    toast('型号已删除', 'info')
    setSelectedId(undefined)
  }
  /** 两段式删除确认：首次点击进入确认态，2.5 秒内再次点击才执行 */
  const askConfirm = (id: string, cb: () => void) => {
    if (confirmId === id) {
      setConfirmId(null)
      cb()
      return
    }
    setConfirmId(id)
    window.setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 2500)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const exportModels = () => {
    const categoryName = categories.find((c) => c.id === categoryId)?.name ?? '设备'
    const rows = models.map((r) => ({
      brand: r.brand.name ?? '',
      model: r.m.model,
      spec: r.m.specification,
      unit: r.m.unit,
      grade: GRADE_LABEL[r.grade ?? ''] ?? r.grade ?? '',
      price: r.price,
      status: r.m.status === 'disabled' ? '停用' : '启用',
    }))
    const blob = new Blob([DeviceService.exportModelsCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `设备库-${categoryName}${currentFamilyName ? `-${currentFamilyName}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('设备库已导出 CSV')
  }
  const applyBatchAdjust = () => {
    const pct = Number(adjustPct)
    if (!selectedIds.size || Number.isNaN(pct) || pct < -50 || pct > 200) {
      toast('请输入 -50 ~ 200 之间的调价百分比', 'warn')
      return
    }
    const r = DeviceService.batchAdjustPrice([...selectedIds], pct)
    toast(`已按 ${pct > 0 ? '+' : ''}${pct}% 批量调价（${r.adjusted} 个${r.skipped ? `，${r.skipped} 个缺价跳过` : ''}）`)
    setSelectedIds(new Set())
    setAdjustPct('')
  }
  const applyBatchStatus = (status: 'active' | 'disabled') => {
    DeviceService.batchSetStatus([...selectedIds], status)
    toast(`已${status === 'disabled' ? '停用' : '启用'} ${selectedIds.size} 个型号`, status === 'disabled' ? 'warn' : 'success')
    setSelectedIds(new Set())
  }

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-5">
      <PageHeader
        title="设备中心"
        subtitle="设备主数据：类别 → 产品族 → 型号 → 品牌 → 价格（清单数据源）"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setImpactOpen(true)}><TrendingUp className="size-3.5" />价格影响</Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><UploadCloud className="size-3.5" />批量导入</Button>
            <Button size="sm" variant="outline" onClick={exportModels}><Download className="size-3.5" />导出</Button>
            <Button size="sm" variant="outline" onClick={() => setSupplierModal({ open: true })}><Users className="size-3.5" />供应商</Button>
            <Button size="sm" variant="outline" onClick={() => setBrandModal({ open: true })}><Plus className="size-3.5" />新增品牌</Button>
            <Button size="sm" onClick={() => setModelModal({ open: true })}><Plus className="size-3.5" />新增型号</Button>
          </>
        }
      />

      {/* 预警条 */}
      {(stats.missingPrice > 0 || stats.missingGrade.length > 0 || stats.disabledInUse > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warn/30 bg-warn-soft/30 px-3 py-2">
          <AlertTriangle className="size-3.5 text-warn" />
          <span className="text-[12px] font-medium text-ink">设备数据预警</span>
          {stats.missingPrice > 0 && (
            <button type="button" onClick={() => { setWarnFilter(warnFilter === 'missing_price' ? null : 'missing_price'); setGradeFilter('all') }}
              className={cn('rounded-full px-2 py-0.5 text-[11.5px] transition-colors', warnFilter === 'missing_price' ? 'bg-danger text-white' : 'bg-danger-soft text-danger hover:bg-danger hover:text-white')}>
              缺价 {stats.missingPrice}
            </button>
          )}
          {stats.missingGrade.length > 0 && (
            <button type="button" onClick={() => setGradeWarnOpen(true)} className="rounded-full bg-warn-soft px-2 py-0.5 text-[11.5px] text-warn hover:bg-warn hover:text-white">
              缺档 {stats.missingGrade.length}
            </button>
          )}
          {stats.disabledInUse > 0 && (
            <button type="button" onClick={() => { setWarnFilter(warnFilter === 'disabled_use' ? null : 'disabled_use'); setGradeFilter('all') }}
              className={cn('rounded-full px-2 py-0.5 text-[11.5px] transition-colors', warnFilter === 'disabled_use' ? 'bg-accent text-white' : 'bg-accent-soft text-accent hover:bg-accent hover:text-white')}>
              停用被引用 {stats.disabledInUse}
            </button>
          )}
          <span className="ml-auto font-mono text-[11px] text-faint">{models.length} 个型号{categoryId && ` · ${currentFamilyName || '全部产品族'}`}</span>
        </div>
      )}

      {/* 批量选择操作条 */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft/30 px-3 py-2">
          <span className="text-[12px] font-semibold text-accent">已选 {selectedIds.size} 个型号</span>
          <div className="flex items-center gap-1.5">
            <Percent className="size-3.5 text-faint" />
            <Input type="number" value={adjustPct} onChange={(e) => setAdjustPct(e.target.value)} placeholder="±%" className="h-6 w-16 text-[12px]" />
            <Button size="xs" variant="outline" onClick={applyBatchAdjust}>批量调价</Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="outline" onClick={() => applyBatchStatus('disabled')}><Power className="size-3" />停用</Button>
            <Button size="xs" variant="outline" onClick={() => applyBatchStatus('active')}>启用</Button>
          </div>
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setSelectedIds(new Set())}>取消选择</Button>
        </div>
      )}

      <div className="flex min-h-[520px] overflow-hidden rounded-lg border border-rule bg-surface">
        {/* 左：目录（按归属系统分组） */}
        <div className="w-48 shrink-0 overflow-y-auto border-r border-rule bg-surface-subtle/40 p-2">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <p className="text-[10.5px] font-semibold tracking-wide text-faint uppercase">设备目录</p>
            <button type="button" className="rounded p-0.5 text-faint hover:bg-hover" onClick={() => setCatModal({ open: true })} aria-label="新增类别"><Plus className="size-3.5" /></button>
          </div>
          {SYSTEM_GROUP_KEYS(categories).map((sysId) => {
            const cats = categories.filter((c) => (c.system_id ?? '__other') === sysId)
            if (!cats.length) return null
            return (
              <div key={sysId} className="mb-2">
                <div className="mb-1 flex items-center gap-1 border-b border-rule pb-1 px-1">
                  <span className="size-1.5 rounded-full bg-accent2" />
                  <span className="text-[10.5px] font-semibold text-accent2">{SYSTEM_GROUPS[sysId] ?? '通用设备'}</span>
                </div>
                <div className="space-y-0.5">
                  {cats.map((c) => (
                    <div key={c.id}>
                      <button
                        type="button"
                        onClick={() => pickCategory(c.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-[6px] px-2.5 py-1.5 text-[12.5px] transition-colors',
                          categoryId === c.id ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-hover hover:text-ink',
                        )}
                      >
                        {c.name}
                        <span className="font-mono text-[10px] text-faint">{DeviceService.families(c.id).length}</span>
                      </button>
                      {categoryId === c.id && (
                        <div className="mt-0.5 space-y-0.5 pl-2">
                          {families.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => pickFamily(f.id)}
                              className={cn(
                                'flex w-full items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-left text-[12px] transition-colors',
                                familyId === f.id ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-hover hover:text-ink',
                              )}
                            >
                              <span className="size-1 rounded-full bg-current opacity-50" />
                              {f.name}
                            </button>
                          ))}
                          <button type="button" onClick={() => setFamModal({ open: true })} className="flex w-full items-center gap-1 px-2.5 py-1 text-[11.5px] text-faint hover:text-accent">
                            <Plus className="size-3" />产品族
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* 中：型号表（品牌 → 型号 → 参数 → 档次 → 参考价 → 状态） */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索品牌 / 型号 / 参数…" className="h-7 w-56 pl-7 text-[12.5px]" />
            </div>
            <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="h-7 rounded-[6px] border border-rule bg-surface px-2 text-[12.5px]">
              <option value="all">全部档次</option>
              <option value="economic">经济型</option>
              <option value="standard">标准型</option>
              <option value="premium">高端型</option>
            </select>
            {warnFilter && (
              <button type="button" onClick={() => setWarnFilter(null)} className="flex items-center gap-1 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] text-muted hover:text-danger">
                {warnFilter === 'missing_price' ? '仅缺价型号' : '仅停用被引用'} <X className="size-3" />
              </button>
            )}
            <span className="ml-auto font-mono text-[11px] text-faint">{models.length} 个型号</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <THead><TR><TH className="w-8">
                <input
                  type="checkbox"
                  checked={models.length > 0 && models.every((r) => selectedIds.has(r.m.id))}
                  onChange={(e) => {
                    setSelectedIds(e.target.checked ? new Set(models.map((r) => r.m.id)) : new Set())
                  }}
                  className="accent-accent"
                />
              </TH><TH>品牌</TH><TH>型号</TH><TH className="w-[34%]">参数</TH><TH>档次</TH><TH>参考价</TH><TH>状态</TH><TH className="text-right">操作</TH></TR></THead>
              <TBody>
                {models.map((row) => {
                  const m = row.m
                  const paramText = Object.entries(row.params).slice(0, 3).map(([k, v]) => `${k}=${String(v)}`).join(' · ')
                  const cellText = [m.specification, paramText].filter(Boolean).join(' · ')
                  return (
                    <TR
                      key={m.id}
                      className={cn('cursor-pointer align-top hover:bg-hover', selected?.m.id === m.id && 'data-[selected=true]', m.status === 'disabled' && 'opacity-60')}
                      data-selected={selected?.m.id === m.id}
                      onClick={() => setSelectedId(m.id)}
                    >
                      <TD className="pr-0" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelect(m.id)} className="accent-accent" />
                      </TD>
                      <TD className="font-medium">{row.brand.name ?? <span className="text-faint">—</span>}</TD>
                      <TD><NumCell>{m.model}</NumCell></TD>
                      <TD
                        className="max-w-[280px] cursor-pointer whitespace-nowrap"
                        onDoubleClick={(e) => { e.stopPropagation(); setParamModal({ open: true, model: m }) }}
                        title={`${cellText || '无参数'} · 双击编辑`}
                      >
                        <span className="block max-w-full truncate text-[12px] text-muted">
                          {cellText || '—'}{m.unit ? ` · ${m.unit}` : ''}
                        </span>
                      </TD>
                      <TD>{row.grade ? <Badge variant={gradeVariant(row.grade)}>{GRADE_LABEL[row.grade]}</Badge> : <span className="text-faint">—</span>}</TD>
                      <TD className={cn('font-mono text-[12.5px] font-semibold', row.price <= 0 ? 'text-danger' : 'text-ink')}>
                        {row.price > 0 ? fmtMoney(row.price) : <span className="text-[11px] font-normal">缺价</span>}
                      </TD>
                      <TD><StatusBadge status={m.status === 'disabled' ? 'disabled' : 'active'} /></TD>
                      <TD className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="编辑型号" onClick={() => setModelModal({ open: true, model: m })}><Pencil className="size-3.5" /></button>
                          <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-warn" title={m.status === 'disabled' ? '恢复启用' : '停用'} onClick={() => toggleStatus(m)}><Power className="size-3.5" /></button>
                          <button
                            type="button"
                            className={cn('rounded p-1', confirmId === `del-${m.id}` ? 'bg-danger text-white' : 'text-faint hover:bg-hover hover:text-danger')}
                            title={confirmId === `del-${m.id}` ? '再次点击确认删除' : '删除（需两次点击确认）'}
                            onClick={() => askConfirm(`del-${m.id}`, () => removeModel(m))}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
            {!models.length && (
              <EmptyState icon={<Boxes />} title="暂无型号" description="切换目录 / 调整筛选，或新增型号" action={<Button size="sm" onClick={() => setModelModal({ open: true })}><Plus className="size-3.5" />新增型号</Button>} />
            )}
          </div>
        </div>

        {/* 右：详情面板 */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-rule p-3">
          {selectedModelRow ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-[14px] font-bold text-accent">{selectedModelRow.model.model}</p>
                  <Button size="xs" variant="outline" onClick={() => setModelModal({ open: true, model: selectedModelRow.model })}>编辑</Button>
                </div>
                <p className="mt-0.5 text-[12px] text-muted">{selectedModelRow.spec || '无规格'}</p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={selectedModelRow.model.status === 'disabled' ? 'disabled' : 'active'} />
                  {selectedModelRow.grade && <Badge variant={gradeVariant(selectedModelRow.grade)}>{GRADE_LABEL[selectedModelRow.grade]}</Badge>}
                </div>
              </div>

              <Block title="品牌">
                <Select
                  value={selectedModelRow.brand.id ?? ''}
                  onChange={(e) => { DeviceService.setModelBrand(selectedModelRow.model.id, e.target.value || undefined); toast('品牌已更新') }}
                  className="h-7 text-[12px]"
                >
                  <option value="">未指定品牌</option>
                  {DeviceService.brands().map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
                <p className="mt-1 text-[10.5px] text-faint">品牌作为型号归属，可随时切换</p>
              </Block>

              <Block title="价格（四类型管理）">
                <PriceEditor key={selectedModelRow.model.id} modelId={selectedModelRow.model.id} prices={selectedModelRow.prices} usageCount={selectedModelRow.usage.systemCount} />
              </Block>

              <Block title="档次绑定（选型引擎优先）">
                <GradeBindingEditor modelId={selectedModelRow.model.id} familyId={selectedModelRow.model.familyId} />
              </Block>

              <Block title="技术参数">
                {Object.keys(selectedModelRow.params).length ? (
                  <dl className="space-y-0.5">
                    {Object.entries(selectedModelRow.params).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[12px]">
                        <dt className="text-muted">{k}</dt>
                        <dd className="font-mono">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[11.5px] text-faint">无结构化参数（可在编辑中补充）</p>
                )}
              </Block>

              <Block title="项目使用情况">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="font-mono text-[15px] font-bold text-accent">{fmtNum(selectedModelRow.usage.systemCount)}</p><p className="text-[10px] text-muted">系统</p></div>
                  <div><p className="font-mono text-[15px] font-bold text-ink">{fmtNum(selectedModelRow.usage.totalQty)}</p><p className="text-[10px] text-muted">总量</p></div>
                  <div><p className="font-mono text-[15px] font-bold text-ink">{fmtMoney(selectedModelRow.usage.totalAmount)}</p><p className="text-[10px] text-muted">金额</p></div>
                </div>
                {selectedModelRow.usage.projectNames.length ? (
                  <ul className="mt-2 space-y-0.5">
                    {selectedModelRow.usage.projectNames.map((n) => (
                      <li key={n} className="flex items-center gap-1.5 text-[12px] text-muted"><BadgeCheck className="size-3 text-ok" />{n}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[11.5px] text-faint">尚未被项目选型</p>
                )}
              </Block>

              <div className="space-y-1.5 border-t border-rule pt-3">
                <Button size="sm" variant="outline" className="w-full" onClick={() => toggleStatus(selectedModelRow.model)}>
                  <Power className="size-3.5" />{selectedModelRow.model.status === 'disabled' ? '恢复启用' : '停用型号'}
                </Button>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-[6px] text-[13px] font-medium transition-colors',
                    confirmId === `del-${selectedModelRow.model.id}` ? 'bg-danger py-2 text-white' : 'py-1.5 text-danger hover:bg-danger-soft',
                  )}
                  onClick={() => askConfirm(`del-${selectedModelRow.model.id}`, () => removeModel(selectedModelRow.model))}
                >
                  <Trash2 className="size-3.5" />{confirmId === `del-${selectedModelRow.model.id}` ? '再次点击确认删除' : '删除型号'}
                </button>
              </div>
            </div>
          ) : (
            <EmptyState icon={<Boxes />} title="选择型号查看详情" />
          )}
        </div>
      </div>

      {/* 型号新增 / 编辑 */}
      <ModelFormModal
        key={`mf-${modelModal.model?.id ?? String(modelModal.open)}`}
        open={modelModal.open}
        onClose={() => setModelModal({ open: false })}
        model={modelModal.model}
        defaultFamilyId={familyId}
      />
      {/* 品牌新增 / 编辑 */}
      <BrandFormModal key={`bf-${brandModal.brand?.id ?? String(brandModal.open)}`} open={brandModal.open} onClose={() => setBrandModal({ open: false })} brand={brandModal.brand} />
      {/* 参数双击编辑 */}
      <ParameterModal key={`pm-${paramModal.model?.id ?? String(paramModal.open)}`} open={paramModal.open} onClose={() => setParamModal({ open: false })} model={paramModal.model} />
      {/* 类别 / 产品族新增 */}
      <CategoryFormModal open={catModal.open} onClose={() => setCatModal({ open: false })} onDone={(id) => pickCategory(id)} categories={categories} />
      <FamilyFormModal open={famModal.open} onClose={() => setFamModal({ open: false })} categoryId={categoryId} onDone={(id) => pickFamily(id)} />
      {/* 缺档明细 */}
      <MissingGradeModal open={gradeWarnOpen} onClose={() => setGradeWarnOpen(false)} stats={stats} onGoto={(famId) => { setGradeWarnOpen(false); pickFamily(famId); setModelModal({ open: true }) }} />
      {/* 供应商管理 */}
      <SupplierModal open={supplierModal.open} onClose={() => setSupplierModal({ open: false })} selected={supplierModal.supplier} onEdit={(s) => setSupplierModal({ open: true, supplier: s })} />
      {/* 批量导入 */}
      <DeviceImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      {/* 价格影响分析 */}
      <PriceImpactModal open={impactOpen} onClose={() => setImpactOpen(false)} />
      {/* 数据分析 */}
      <DeviceAnalytics />
    </div>
  )
}

/* ---------- 小部件 ---------- */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-rule pt-3">
      <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">{title}</p>
      {children}
    </div>
  )
}

function SYSTEM_GROUP_KEYS(categories: DeviceCategory[]): string[] {
  const keys = new Set<string>()
  categories.forEach((c) => keys.add(c.system_id ?? '__other'))
  return [...keys].sort((a, b) => {
    const order = ['sys_vss', 'sys_lan', '__other']
    return (order.indexOf(a) - order.indexOf(b))
  })
}

function gradeVariant(code?: string): 'neutral' | 'warn' | 'accent' | 'accent2' {
  const map: Record<string, 'warn' | 'accent' | 'accent2'> = { economic: 'warn', standard: 'accent', premium: 'accent2' }
  return map[code ?? ''] ?? 'neutral'
}

/* ---------- 型号表单 ---------- */
function ModelFormModal({ open, onClose, model, defaultFamilyId }: { open: boolean; onClose: () => void; model?: ProductModel; defaultFamilyId?: string }) {
  const [form, setForm] = useState(() => seedModelForm(model, defaultFamilyId))
  const [params, setParams] = useState<{ k: string; v: string }[]>(() =>
    Object.entries((model?.parameter_json ?? {}) as Record<string, unknown>).map(([k, v]) => ({ k, v: String(v) })),
  )

  if (!open) return null
  const editing = !!model
  const families = DeviceService.families()

  const save = () => {
    if (!form.model.trim() || !form.product_family_id) {
      toast('请填写型号名称与所属产品族', 'warn')
      return
    }
    const parameter_json: Record<string, unknown> = {}
    params.filter((p) => p.k.trim()).forEach((p) => { parameter_json[p.k.trim()] = p.v.trim() || true })
    if (editing) {
      DeviceService.updateModel(model!.id, {
        model: form.model, specification: form.specification, unit: form.unit, status: form.status, parameter_json,
      })
      // 主档统一入口：同时写绑定表与 grade_code（引擎以绑定表优先）
      DeviceService.setModelDefaultGrade(model!.id, form.grade_code || undefined)
      DeviceService.setModelBrand(model!.id, form.brand_id || undefined)
      toast('型号已更新')
    } else {
      DeviceService.addModel({ product_family_id: form.product_family_id, model: form.model, specification: form.specification, unit: form.unit, grade_code: form.grade_code || undefined, status: 'active', parameter_json, brand_id: form.brand_id || undefined })
      toast('型号已新增')
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `编辑型号：${model!.model}` : '新增型号'} width={560}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="型号名称" required>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="如 DS-2CD2346" />
          </Field>
          <Field label="所属产品族" required>
            <Select
              value={form.product_family_id}
              disabled={editing}
              onChange={(e) => setForm({ ...form, product_family_id: e.target.value })}
            >
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </Field>
          <Field label="品牌">
            <Select value={form.brand_id ?? ''} onChange={(e) => setForm({ ...form, brand_id: e.target.value || undefined })}>
              <option value="">未指定</option>
              {DeviceService.brands().map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="单位">
            <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {['台', '套', '块', '箱', '米', '根', '个'].map((u) => <option key={u}>{u}</option>)}
            </Select>
          </Field>
          <Field label="档次">
            <Select value={form.grade_code ?? ''} onChange={(e) => setForm({ ...form, grade_code: e.target.value || undefined })}>
              <option value="">未设定</option>
              {Object.entries(GRADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="状态">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'disabled' })}>
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </Select>
          </Field>
        </div>
        <Field label="规格">
          <Input value={form.specification ?? ''} onChange={(e) => setForm({ ...form, specification: e.target.value })} placeholder="如 4MP 星光半球" />
        </Field>
        <Field label="技术参数（键值对，如 分辨率=4MP）">
          <div className="space-y-1.5">
            {params.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={p.k} onChange={(e) => setParams(params.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} placeholder="参数名" className="h-7 flex-1 text-[12px]" />
                <Input value={p.v} onChange={(e) => setParams(params.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} placeholder="值" className="h-7 flex-1 text-[12px]" />
                <button type="button" className="rounded p-1 text-faint hover:text-danger" onClick={() => setParams(params.filter((_, j) => j !== i))}><X className="size-3.5" /></button>
              </div>
            ))}
            <Button size="xs" variant="outline" onClick={() => setParams([...params, { k: '', v: '' }])}><Plus className="size-3" />添加参数</Button>
          </div>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>{editing ? '保存修改' : '确认新增'}</Button>
      </div>
    </Modal>
  )
}

function seedModelForm(model?: ProductModel, defaultFamilyId?: string) {
  if (model) {
    const famId = (useDB.getState().getTable<{ id: string; product_family_id: string }>(T.products).find((p) => p.id === model.product_id)?.product_family_id) ?? ''
    return { product_family_id: famId, model: model.model, specification: model.specification ?? '', unit: model.unit ?? '台', grade_code: model.grade_code, status: model.status ?? 'active', brand_id: DeviceService.brandOf(model.id).id }
  }
  return { product_family_id: defaultFamilyId ?? '', model: '', specification: '', unit: '台', grade_code: undefined as string | undefined, status: 'active' as const, brand_id: undefined as string | undefined }
}

/* ---------- 品牌表单 ---------- */
function BrandFormModal({ open, onClose, brand }: { open: boolean; onClose: () => void; brand?: Brand }) {
  const [name, setName] = useState(brand?.name ?? '')
  const [type, setType] = useState(brand?.manufacturer_type ?? 'domestic')
  if (!open) return null
  const editing = !!brand
  const save = () => {
    if (!name.trim()) { toast('请填写品牌名称', 'warn'); return }
    if (editing) DeviceService.updateBrand(brand!.id, { name: name.trim(), manufacturer_type: type })
    else DeviceService.addBrand({ name: name.trim(), manufacturer_type: type })
    toast(editing ? '品牌已更新' : '品牌已新增')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? `编辑品牌：${brand!.name}` : '新增品牌'} width={380}>
      <div className="space-y-3">
        <Field label="品牌名称" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="厂商类型">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="domestic">国产</option>
            <option value="foreign">进口</option>
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>{editing ? '保存' : '确认新增'}</Button>
      </div>
    </Modal>
  )
}

/* ---------- 类别 / 产品族 新增 ---------- */
function CategoryFormModal({ open, onClose, onDone, categories }: { open: boolean; onClose: () => void; onDone: (id: string) => void; categories: DeviceCategory[] }) {
  const [name, setName] = useState('')
  const [sysId, setSysId] = useState('sys_vss')
  if (!open) return null
  const save = () => {
    if (!name.trim()) { toast('请填写类别名称', 'warn'); return }
    const c = DeviceService.addCategory({ name: name.trim(), system_id: sysId, code: name.trim(), category_type: name.trim() })
    toast('类别已新增')
    onDone(c.id)
  }
  return (
    <Modal open={open} onClose={onClose} title="新增设备类别" width={380}>
      <div className="space-y-3">
        <Field label="类别名称" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 中控台" /></Field>
        <Field label="归属系统">
          <Select value={sysId} onChange={(e) => setSysId(e.target.value)}>
            {Object.entries(SYSTEM_GROUPS).filter(([k]) => k !== '__other').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="__other">通用（跨系统）</option>
          </Select>
        </Field>
        <p className="text-[11.5px] text-faint">现有类别：{categories.map((c) => c.name).join('、')}</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>确认新增</Button>
      </div>
    </Modal>
  )
}

function FamilyFormModal({ open, onClose, categoryId, onDone }: { open: boolean; onClose: () => void; categoryId: string; onDone: (id: string) => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  if (!open) return null
  const save = () => {
    if (!name.trim()) { toast('请填写产品族名称', 'warn'); return }
    const f = DeviceService.addFamily({ device_category_id: categoryId, name: name.trim(), code: code.trim() || undefined })
    toast('产品族已新增')
    onDone(f.id)
  }
  return (
    <Modal open={open} onClose={onClose} title="新增产品族" width={380}>
      <div className="space-y-3">
        <Field label="产品族名称" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 门禁控制器" /></Field>
        <Field label="编码（可选）"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="如 acs_controller" /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>确认新增</Button>
      </div>
    </Modal>
  )
}

/* ---------- 缺档明细 ---------- */
function MissingGradeModal({ open, onClose, stats, onGoto }: { open: boolean; onClose: () => void; stats: ReturnType<typeof DeviceService.stats>; onGoto: (familyId: string) => void }) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={`缺档组合（${stats.missingGrade.length}）`} width={460}>
      <p className="-mt-1 mb-2 text-[12px] text-muted">以下「产品族 × 档次」没有可用型号，推导时会被回退到其他档。</p>
      <ul className="space-y-1">
        {stats.missingGrade.map((g) => (
          <li key={`${g.familyId}-${g.grade}`} className="flex items-center justify-between rounded-md border border-rule px-3 py-2 text-[12.5px]">
            <span><b>{g.familyName}</b> <span className="text-muted">缺</span> {g.gradeLabel}</span>
            <Button size="xs" variant="outline" onClick={() => onGoto(g.familyId)}><Plus className="size-3" />补型号</Button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

/* ---------- R2：四类型价格编辑器 ---------- */
function PriceEditor({ modelId, prices, usageCount }: { modelId: string; prices: Price[]; usageCount: number }) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    PRICE_TYPES.forEach((t) => {
      const p = prices.find((x) => x.price_type === t)
      init[t] = p ? String(p.price) : ''
      init[`${t}_date`] = p?.effective_date ? p.effective_date.slice(0, 10) : ''
    })
    return init
  })
  const suppliers = DeviceService.suppliers()
  const [supplierOf, setSupplierOf] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    PRICE_TYPES.forEach((t) => {
      const p = prices.find((x) => x.price_type === t)
      init[t] = p?.supplier_id ?? ''
    })
    return init
  })
  const refPrice = Number(form.reference) || 0

  const save = (t: (typeof PRICE_TYPES)[number]) => {
    const v = Number(form[t])
    if (v <= 0) {
      toast('价格须大于 0', 'warn')
      return
    }
    DeviceService.setPrice(modelId, t, v, {
      effective_date: form[`${t}_date`] || undefined,
      source: t === 'supplier' ? '供应商询价' : t === 'market' ? '市场参考' : '手动维护',
      supplier_id: supplierOf[t] || undefined,
    })
    // 「重新推导将使用新价」仅对参考价成立（引擎只取 reference）
    toast(
      t === 'reference'
        ? `已更新参考价 ¥${fmtNum(v)}` + (usageCount > 0 ? `；被 ${usageCount} 个系统选用，重新推导将使用新价，已生成清单为快照不受影响` : '')
        : `已更新${PRICE_TYPE_LABEL[t]} ¥${fmtNum(v)}（台账价，不影响推导与清单）`,
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[15px] font-bold text-ink">{refPrice > 0 ? fmtMoney(refPrice) : <span className="text-[12px] font-normal text-danger">当前无参考价</span>}</p>
      {PRICE_TYPES.map((t) => {
        const p = prices.find((x) => x.price_type === t)
        return (
          <div key={t} className="rounded-md border border-rule bg-surface-subtle/40 p-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-14 shrink-0 text-[11px] text-muted">{PRICE_TYPE_LABEL[t]}</span>
              <Input type="number" value={form[t]} onChange={(e) => setForm({ ...form, [t]: e.target.value })} placeholder="金额" className="h-6 flex-1 text-[12px]" />
              <Input type="date" value={form[`${t}_date`]} onChange={(e) => setForm({ ...form, [`${t}_date`]: e.target.value })} className="h-6 w-28 text-[11px]" />
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {t === 'supplier' && (
                <Select value={supplierOf[t]} onChange={(e) => setSupplierOf({ ...supplierOf, [t]: e.target.value })} className="h-6 flex-1 text-[11px]">
                  <option value="">供应商…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              )}
              {t !== 'supplier' && <span className="flex-1" />}
              <Button size="xs" variant="outline" onClick={() => save(t)}><Save className="size-3" />保存</Button>
              {p && (
                <button type="button" className="rounded p-1 text-faint hover:text-danger" title="删除该类型价格"
                  onClick={() => {
                    DeviceService.removePrice(p.id)
                    setForm((f) => ({ ...f, [t]: '', [`${t}_date`]: '' }))
                    setSupplierOf((s) => ({ ...s, [t]: '' }))
                    toast('已删除该类型价格', 'info')
                  }}>
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          </div>
        )
      })}
      <p className="text-[10.5px] text-faint">参考价：推导选型采用；市场/供应商/项目价：台账管理。</p>
    </div>
  )
}

/* ---------- R2：档次绑定编辑器 ---------- */
function GradeBindingEditor({ modelId, familyId }: { modelId: string; familyId?: string }) {
  const bindings = DeviceService.gradeBindings(modelId).map((b) => b.grade_id)
  const coverage = familyId ? DeviceService.familyGradeCoverage(familyId) : []
  const gradeIdByLabel = new Map(DeviceService.grades().map((g) => [g.code, g.id]))
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(GRADE_LABEL).map(([code, label]) => {
          const gradeId = gradeIdByLabel.get(code)
          const on = !!gradeId && bindings.includes(gradeId)
          return (
            <button
              key={code}
              type="button"
              onClick={() => { DeviceService.setGradeBinding(modelId, code, !on); toast(on ? `已摘出「${label}」档` : `已挂载到「${label}」档`) }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                on ? 'border-accent bg-accent-soft text-accent' : 'border-rule text-muted hover:border-accent/40',
              )}
            >
              {label}{on && ' ✓'}
            </button>
          )
        })}
      </div>
      {coverage.length > 0 && (
        <p className="mt-1.5 text-[10.5px] text-faint">
          族内可用：{coverage.map((c) => `${c.label}${c.count}`).join(' · ')}
        </p>
      )}
    </div>
  )
}

/* ---------- R2：供应商管理 ---------- */
function SupplierModal({ open, onClose, selected, onEdit }: { open: boolean; onClose: () => void; selected?: Supplier; onEdit: (s: Supplier) => void }) {
  const [form, setForm] = useState<Partial<Supplier>>(() => selected ?? {})
  const [delConfirm, setDelConfirm] = useState(false)
  if (!open) return null
  const editing = !!selected
  const list = DeviceService.suppliers()
  const save = () => {
    if (!form.name?.trim()) { toast('请填写供应商名称', 'warn'); return }
    if (editing) DeviceService.updateSupplier(selected!.id, form)
    else DeviceService.addSupplier(form)
    toast(editing ? '供应商已更新' : '供应商已新增')
    onClose()
  }
  const remove = (s: Supplier) => {
    const r = DeviceService.removeSupplier(s.id)
    if (!r.ok) { toast(r.reason ?? '无法删除', 'error'); return }
    toast('供应商已删除', 'info')
  }
  const removeCurrent = () => {
    if (!delConfirm) {
      setDelConfirm(true)
      window.setTimeout(() => setDelConfirm(false), 2500)
      return
    }
    remove(selected!)
    setDelConfirm(false)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="供应商管理" width={560} footer={
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setForm({}); onEdit({} as Supplier) }}>新增</Button>
        {editing && <Button size="sm" variant="danger" onClick={removeCurrent}>{delConfirm ? '再次点击确认删除' : '删除'}</Button>}
        <Button size="sm" onClick={save}>{editing ? '保存修改' : '新增'}</Button>
      </div>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="联系人"><Input value={form.contact ?? ''} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
        <Field label="联系电话"><Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="地区"><Input value={form.region ?? ''} onChange={(e) => setForm({ ...form, region: e.target.value })} /></Field>
        <Field label="备注"><Input value={form.remark ?? ''} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></Field>
      </div>
      <div className="mt-3 border-t border-rule pt-3">
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">供应商列表（{list.length}）</p>
        <ul className="space-y-1">
          {list.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-md border border-rule px-2.5 py-1.5 text-[12.5px]">
              <span className="font-medium">{s.name}</span>
              <span className="text-[11px] text-muted">{s.contact} · {s.region}</span>
              <Button size="xs" variant="outline" onClick={() => { setForm(s); onEdit(s) }}>编辑</Button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

/* ---------- 参数双击编辑（规格 / 单位 / 参数键值） ---------- */
function ParameterModal({ open, onClose, model }: { open: boolean; onClose: () => void; model?: ProductModel }) {
  const [spec, setSpec] = useState(model?.specification ?? '')
  const [unit, setUnit] = useState(model?.unit ?? '台')
  const [params, setParams] = useState<{ k: string; v: string }[]>(() =>
    Object.entries((model?.parameter_json ?? {}) as Record<string, unknown>).map(([k, v]) => ({ k, v: String(v) })),
  )
  if (!open || !model) return null
  const save = () => {
    const parameter_json: Record<string, unknown> = {}
    params.filter((p) => p.k.trim()).forEach((p) => { parameter_json[p.k.trim()] = p.v.trim() || true })
    DeviceService.updateModel(model.id, { specification: spec, unit, parameter_json })
    toast(`「${model.model}」参数已保存`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={`编辑参数：${model.model}`} width={520}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="规格">
            <Input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="如 4MP 星光半球" />
          </Field>
          <Field label="单位">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {['台', '套', '块', '箱', '米', '根', '个'].map((u) => <option key={u}>{u}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="技术参数（键值对，如 分辨率=4MP）">
          <div className="space-y-1.5">
            {params.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={p.k} onChange={(e) => setParams(params.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} placeholder="参数名" className="h-7 flex-1 text-[12px]" />
                <Input value={p.v} onChange={(e) => setParams(params.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} placeholder="值" className="h-7 flex-1 text-[12px]" />
                <button type="button" className="rounded p-1 text-faint hover:text-danger" onClick={() => setParams(params.filter((_, j) => j !== i))}><X className="size-3.5" /></button>
              </div>
            ))}
            <Button size="xs" variant="outline" onClick={() => setParams([...params, { k: '', v: '' }])}><Plus className="size-3" />添加参数</Button>
          </div>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>保存参数</Button>
      </div>
    </Modal>
  )
}

/* ---------- R3：价格影响分析 ---------- */
function PriceImpactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  const impact = DeviceService.priceImpact()
  const totalDiff = impact.reduce((s, r) => s + r.diff, 0)
  return (
    <Modal open={open} onClose={onClose} title="价格影响分析（最新参考价 vs 项目快照）" width={640}>
      <p className="-mt-1 mb-2 text-[12px] text-muted">
        按设备库当前参考价重算已选型系统的金额，与生成时的价格快照对比。差额为正表示按新价将上涨。此分析不写库。
      </p>
      <ul className="space-y-1.5">
        {impact.map((r) => (
          <li key={r.psId} className="flex items-center justify-between rounded-md border border-rule px-3 py-2 text-[12.5px]">
            <span>
              <b>{r.systemName}</b>
              <span className="ml-1.5 text-[11px] text-muted">{r.projectName}</span>
            </span>
            <span className="font-mono text-[12px]">
              <span className="text-muted">{fmtMoney(r.oldTotal)}</span>
              <span className="mx-1 text-faint">→</span>
              <span className="font-semibold">{fmtMoney(r.newTotal)}</span>
              <span className={cn('ml-2 font-bold', r.diff > 0 ? 'text-danger' : 'text-ok')}>
                {r.diff > 0 ? '+' : ''}{fmtMoney(r.diff)}
              </span>
            </span>
          </li>
        ))}
        {!impact.length && <li className="rounded-md border border-rule px-3 py-4 text-center text-[12px] text-faint">当前设备库价格与项目快照一致（或暂无选型数据）</li>}
      </ul>
      {impact.length > 0 && (
        <div className="mt-3 flex justify-end gap-2 border-t border-rule pt-2.5 text-[13px]">
          <span className="text-muted">影响合计：</span>
          <span className={cn('font-mono font-bold', totalDiff > 0 ? 'text-danger' : 'text-ok')}>{totalDiff > 0 ? '+' : ''}{fmtMoney(totalDiff)}</span>
        </div>
      )}
    </Modal>
  )
}