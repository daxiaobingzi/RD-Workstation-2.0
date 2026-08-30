import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, Plus, Boxes, Pencil, Trash2, Power, AlertTriangle, X, BadgeCheck, Users, Download, UploadCloud, TrendingUp, Percent, ShieldCheck, Info, RotateCcw, X as CloseX,
} from 'lucide-react'
import { useDB, useDBTables } from '../../db/memory-db'
import { T, type ProductModel, type Brand, type Supplier, type Product } from '../../types/domain'
import { DeviceService, DEVICE_CATEGORIES, type DeviceTypeView } from '../../services'
import { DeviceImportModal } from './importers/DeviceImport'
import { DeviceAnalytics } from './components/DeviceAnalytics'
import ModelFormModal from './components/ModelFormModal'
import BrandFormModal from './components/BrandFormModal'
import DeviceFormModal from './components/DeviceFormModal'
import DeviceTypeFormModal from './components/DeviceTypeFormModal'
import MissingGradeModal from './components/MissingGradeModal'
import SupplierModal from './components/SupplierModal'
import PriceGovernModal from './components/PriceGovernModal'
import PriceEditor from './components/PriceEditor'
import DeviceInUseModal, { type DeviceInUseEntry } from './components/DeviceInUseModal'
import { MaterialQuotaEditor } from './components/MaterialQuotaEditor'
import ChainQuotaPanel from './components/ChainQuotaPanel'
import PriceImpactModal from './components/PriceImpactModal'
import SystemManageModal, { SystemManageButton } from './components/SystemManageModal'
import { StatusBadge, Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/field'
import { SortableTable, type SortableColumn } from '../../components/ui/sortable-table'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/empty'
import { toast } from '../../components/ui/toast'
import { htmlToText, htmlToPlainText } from '../../components/ui/rich-text'
import { fmtMoney, fmtNum, cn } from '../../lib/utils'
import { GRADE_LABEL, type WarnFilter } from './device-center.types'

/** 设备中心：子系统页签 → 设备类型（主体）→ 品牌型号配置行（N）；详情以抽屉呈现 */
export function DeviceCenterPage() {
  // 设备中心只订阅自身数据域，避免任务、预算、文档等无关表变化触发整页重渲染。
  useDBTables([
    T.products,
    T.product_models,
    T.model_brands,
    T.brands,
    T.prices,
    T.grades,
    T.product_families,
    T.device_categories,
    T.device_systems,
    T.device_selections,
    T.bill_items,
    T.project_systems,
    T.projects,
    T.device_materials,
    T.model_grade_bindings,
  ] as const)
  const [searchParams] = useSearchParams()
  const [systemId, setSystemId] = useState('sys_vss')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [detailTypeId, setDetailTypeId] = useState<string | undefined>()
  const [q, setQ] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [warnFilter, setWarnFilter] = useState<WarnFilter>(null)
  const [modelModal, setModelModal] = useState<{ open: boolean; model?: ProductModel; defaultProductId?: string }>({ open: false })
  const [deviceFormOpen, setDeviceFormOpen] = useState(false)
  const [deviceTypeModal, setDeviceTypeModal] = useState<{ open: boolean; product?: Product }>({ open: false })
  const [brandModal, setBrandModal] = useState<{ open: boolean; brand?: Brand }>({ open: false })
  const [supplierModal, setSupplierModal] = useState<{ open: boolean; supplier?: Supplier }>({ open: false })
  const [gradeWarnOpen, setGradeWarnOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [impactOpen, setImpactOpen] = useState(false)
  const [governOpen, setGovernOpen] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [adjustPct, setAdjustPct] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [inUseModal, setInUseModal] = useState<{ open: boolean; deviceName?: string; entries?: DeviceInUseEntry[] }>({ open: false })
  const [systemManageOpen, setSystemManageOpen] = useState(false)

  const stats = DeviceService.stats()
  const systems = DeviceService.deviceSystems()

  // URL 定位：/devices?modelId=xxx → 找到该型号所属设备类型，切到对应系统并打开详情抽屉
  useEffect(() => {
    const modelId = searchParams.get('modelId')
    if (!modelId) return
    const db = useDB.getState().db
    const model = (db[T.product_models] ?? []).find((m) => m.id === modelId) as ProductModel | undefined
    if (!model) return
    const product = (db[T.products] ?? []).find((p) => p.id === model.product_id) as Product | undefined
    setSystemId(product?.system_id ?? '__other')
    setCategoryFilter('all')
    setExpandedIds(new Set([model.product_id]))
    setDetailTypeId(model.product_id)
    setSelectedModelId(modelId)
  }, [searchParams])

  const switchSystem = (id: string) => {
    setSystemId(id); setCategoryFilter('all'); setExpandedIds(new Set()); setSelectedIds(new Set()); setDetailTypeId(undefined)
  }
  const switchCategory = (code: string) => { setCategoryFilter(code); setExpandedIds(new Set()) }
  // 当前系统被删除时回退到第一个系统
  useEffect(() => {
    const ids = systems.map((s) => s.id)
    if (systemId && !ids.includes(systemId)) setSystemId(ids[0] ?? '__other')
  }, [systems, systemId])

  const allTypes = useMemo<DeviceTypeView[]>(
    () => DeviceService.deviceTypes({ systemId, category: categoryFilter === 'all' ? undefined : categoryFilter }),
    [systemId, categoryFilter],
  )

  const types = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return allTypes
      .map((dt) => {
        const rows = dt.rows.filter(({ m, unitPrice }) => {
          if (gradeFilter !== 'all' && DeviceService.gradeCodeOf(m.id) !== gradeFilter) return false
          if (warnFilter === 'missing_price' && unitPrice > 0) return false
          if (warnFilter === 'disabled_use' && !(m.status === 'disabled' && inUseOf(m.id))) return false
          return true
        })
        return { ...dt, rows }
      })
      .filter((dt) => {
        if ((gradeFilter !== 'all' || warnFilter === 'missing_price' || warnFilter === 'disabled_use') && !dt.rows.length) return false
        if (!kw) return true
        const hay = [dt.product.name, dt.product.specification, dt.product.unit, ...dt.brandNames, ...dt.rows.map((r) => r.m.model)].join(' ').toLowerCase()
        return hay.includes(kw)
      })
  }, [allTypes, q, gradeFilter, warnFilter])

  const totalRows = types.reduce((s, t) => s + t.rows.length, 0)
  const [displayRows, setDisplayRows] = useState<DeviceTypeView[]>(types)
  useEffect(() => { setDisplayRows(types) }, [types])
  const reorderDevice = (from: number, to: number) => {
    if (from === to) return
    const next = [...displayRows]
    const [mv] = next.splice(from, 1)
    next.splice(to, 0, mv)
    setDisplayRows(next)
    next.forEach((dt, i) => { if (dt.product.sort_order !== i) DeviceService.updateDeviceType(dt.product.id, { sort_order: i }) })
  }
  const allExpanded = types.length > 0 && types.every((t) => expandedIds.has(t.product.id))
  const toggleAllExpand = () => {
    if (allExpanded) setExpandedIds(new Set())
    else setExpandedIds(new Set(types.map((t) => t.product.id)))
  }
  const detailType = types.find((t) => t.product.id === detailTypeId)
  const priceRow = detailType?.rows.find((r) => r.m.id === selectedModelId) ?? detailType?.rows[0]

  const toggleExpand = (pid: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }

  const removeDevice = (type: DeviceTypeView) => {
    const r = DeviceService.removeDeviceType(type.product.id)
    if (!r.ok) {
      if (r.used?.length) setInUseModal({ open: true, deviceName: type.product.name, entries: r.used })
      else toast(r.reason ?? '无法删除', 'error')
      return
    }
    toast('设备已删除', 'info')
    if (detailTypeId === type.product.id) setDetailTypeId(undefined)
  }

  const deviceColumns = useMemo<SortableColumn<DeviceTypeView>[]>(() => [
    { key: 'name', title: '设备', width: 300, minWidth: 200, render: (dt) => (
        <div>
          <div className="text-[13px] font-medium">{dt.product.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {dt.product.device_code && <span className="rounded bg-accent-soft px-1 py-px font-mono text-[10.5px] text-accent" title="设备编码">{dt.product.device_code}</span>}
            <span className="shrink-0 rounded bg-surface-subtle px-1 py-px text-[10px]">{catLabelOf(dt.product.category)}</span>
            {htmlToText(dt.product.specification, 40) && (
              <span className="truncate text-[11px] text-faint">{htmlToText(dt.product.specification, 40)}</span>
            )}
          </div>
        </div>) },
    { key: 'brands', title: '品牌备选', width: 180, render: (dt) => (
        <div className="flex max-w-[200px] flex-wrap gap-1">
          {dt.brandNames.length ? dt.brandNames.slice(0, 4).map((b) => <span key={b} className="rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10.5px] text-muted">{b}</span>) : <span className="text-faint">—</span>}
          {dt.brandNames.length > 4 && <span className="text-[10px] text-faint">+{dt.brandNames.length - 4}</span>}
        </div>) },
    { key: 'modelCount', title: '型号', width: 70, align: 'right', render: (dt) => <span className="font-mono text-[12px]">{fmtNum(dt.modelCount)}</span> },
    { key: 'gradeCoverage', title: '档次覆盖', width: 190, render: (dt) => (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {dt.gradeCoverage.map((c) => (
            <span key={c.grade} className={cn('text-[11px]', c.count > 0 ? 'text-ink' : 'text-faint')}>{GRADE_LABEL[c.grade] ?? c.grade} <span className="font-mono">{c.count}</span></span>
          ))}
        </div>) },
    { key: 'priceMin', title: '参考价区间', width: 160, align: 'right', render: (dt) => (
        dt.priceMin != null
          ? <span className="font-mono text-[12px] font-semibold">{fmtMoney(dt.priceMin)}{dt.priceMax !== dt.priceMin ? ` ~ ${fmtMoney(dt.priceMax!)}` : ''}</span>
          : <span className="text-[11px] text-danger">缺价</span>) },
    { key: 'status', title: '停用', width: 70, render: (dt) => (dt.disabledCount > 0 ? <Badge variant="warn">停用 {dt.disabledCount}</Badge> : <span className="text-[11px] text-faint">—</span>) },
    { key: 'actions', title: '操作', width: 150, render: (dt) => (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="详情" onClick={() => { setDetailTypeId(dt.product.id); setSelectedModelId(undefined) }}><Info className="size-3.5" /></button>
          <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="编辑设备" onClick={() => setDeviceTypeModal({ open: true, product: dt.product })}><Pencil className="size-3.5" /></button>
          <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="在本设备下添加型号" onClick={() => setModelModal({ open: true, defaultProductId: dt.product.id })}><Plus className="size-3.5" /></button>
          <button
            type="button"
            className={cn('rounded p-1', confirmId === `deltype-${dt.product.id}` ? 'bg-danger text-white' : 'text-faint hover:bg-hover hover:text-danger')}
            title="删除设备（需两次点击确认）"
            onClick={() => askConfirm(`deltype-${dt.product.id}`, () => removeDevice(dt))}
          ><Trash2 className="size-3.5" /></button>
        </div>) },
  ], [confirmId, removeDevice])

  const toggleStatus = (m: ProductModel) => {
    DeviceService.setModelStatus(m.id, m.status === 'disabled' ? 'active' : 'disabled')
    toast(m.status === 'disabled' ? '型号已恢复启用' : '型号已停用', m.status === 'disabled' ? 'success' : 'warn')
  }
  const removeModel = (m: ProductModel) => {
    const r = DeviceService.removeModel(m.id)
    if (!r.ok) { toast(r.reason ?? '无法删除', 'error'); return }
    toast('型号已删除', 'info')
  }
  const askConfirm = (id: string, cb: () => void) => {
    if (confirmId === id) { setConfirmId(null); cb(); return }
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
    const sysLabel = systems.find((s) => s.id === systemId)?.label ?? ''
    const catLabel = categoryFilter !== 'all' ? catLabelOf(categoryFilter) : ''
    const rows = types.flatMap((dt) => dt.rows.map((r) => ({
      deviceCode: dt.product.device_code ?? '',
      deviceType: dt.product.name,
      category: catLabelOf(dt.product.category),
      brand: r.brandName,
      model: r.m.model,
      generic: htmlToText(dt.product.specification, 60),
      detail: htmlToText(r.m.detail_html, 120),
      unit: r.m.unit ?? '',
      grade: GRADE_LABEL[r.m.grade_code ?? ''] ?? r.m.grade_code ?? '',
      price: r.unitPrice,
      status: r.m.status === 'disabled' ? '停用' : '启用',
    })))
    const head = ['设备编码', '设备类型', '类别', '品牌', '型号', '通用参数', '详细参数', '单位', '档次', '参考价', '状态']
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const csv = '\uFEFF' + [head, ...rows.map((x) => Object.values(x).map(esc).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `设备库-${sysLabel}${catLabel ? `-${catLabel}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
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
    setSelectedIds(new Set()); setAdjustPct('')
  }
  const applyBatchStatus = (status: 'active' | 'disabled') => {
    DeviceService.batchSetStatus([...selectedIds], status)
    toast(`已${status === 'disabled' ? '停用' : '启用'} ${selectedIds.size} 个型号`, status === 'disabled' ? 'warn' : 'success')
    setSelectedIds(new Set())
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-4 p-5">
      <PageHeader
        title="设备中心"
        subtitle="设备主数据：子系统 → 设备类型 → 品牌型号配置行（品牌 / 型号 / 通用参数 / 详细参数 / 参考价）· 清单数据源"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setGovernOpen(true)}><ShieldCheck className="size-3.5" />价格治理</Button>
            <Button size="sm" variant="outline" onClick={() => setImpactOpen(true)}><TrendingUp className="size-3.5" />价格影响</Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><UploadCloud className="size-3.5" />批量导入</Button>
            <Button size="sm" variant="outline" onClick={exportModels}><Download className="size-3.5" />导出</Button>
            <Button size="sm" variant="outline" onClick={() => setSupplierModal({ open: true })}><Users className="size-3.5" />供应商</Button>
            <Button size="sm" variant="outline" onClick={() => setBrandModal({ open: true })}><Plus className="size-3.5" />新增品牌</Button>
            <Button
              size="sm"
              variant={confirmId === 'reset' ? 'ghost' : 'outline'}
              className={confirmId === 'reset' ? 'text-danger hover:bg-danger-soft' : ''}
              onClick={() => askConfirm('reset', () => { localStorage.removeItem('rdw-db-v5'); location.reload() })}
              title="清除本机演示数据并重新播种"
            ><RotateCcw className="size-3.5" />{confirmId === 'reset' ? '再次点击确认重置' : '重置演示数据'}</Button>
            <Button size="sm" onClick={() => setDeviceFormOpen(true)}><Plus className="size-3.5" />新增设备</Button>
          </>
        }
      />

      {/* 子系统页签 + 类别筛选 */}
      <div className="space-y-2 rounded-lg border border-rule bg-surface p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {systems.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => switchSystem(s.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
                systemId === s.id ? 'bg-accent text-white' : 'bg-surface-subtle text-muted hover:bg-hover hover:text-ink',
              )}
            >
              {s.label}
              <span className="ml-1 font-mono text-[10px] opacity-70">{s.count || ''}</span>
            </button>
          ))}
          <SystemManageButton onClick={() => setSystemManageOpen(true)} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-rule pt-2">
          <span className="px-1 text-[10.5px] font-medium tracking-wide text-faint uppercase">类别</span>
          {[{ code: 'all', label: '全部' }, ...DEVICE_CATEGORIES].map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => switchCategory(c.code)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11.5px] transition-colors',
                categoryFilter === c.code ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-hover hover:text-ink',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

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
          <span className="ml-auto font-mono text-[11px] text-faint">{types.length} 个设备类型 · {totalRows} 个型号</span>
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

      {/* 主表（行点击展开配置行，箭头/展开全部可一键） */}
      <div className="overflow-hidden rounded-lg border border-rule bg-surface">
        <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
          <Button size="xs" variant="outline" onClick={toggleAllExpand}>{allExpanded ? '收起全部' : '展开全部'}</Button>
          <div className="relative">
            <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索设备名称 / 品牌 / 型号…" className="h-7 w-64 pl-7 text-[12.5px]" />
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
          <span className="ml-auto font-mono text-[11px] text-faint">{types.length} 个设备类型</span>
        </div>
        <div className="min-h-0 overflow-auto">
          <SortableTable<DeviceTypeView>
            columns={deviceColumns}
            rows={displayRows}
            rowKey={(dt) => dt.product.id}
            storageKey="device-types"
            onReorder={reorderDevice}
            onToggleExpand={(key) => toggleExpand(key)}
            expandedKeys={expandedIds}
            renderExpanded={(dt) => (
              <ModelRowsExpanded
                dt={dt}
                selectedIds={selectedIds}
                confirmId={confirmId}
                onToggleSelect={toggleSelect}
                onAskConfirm={askConfirm}
                onToggleStatus={toggleStatus}
                onRemoveModel={removeModel}
                onEditModel={(m) => setModelModal({ open: true, model: m })}
                onAddModel={() => setModelModal({ open: true, defaultProductId: dt.product.id })}
              />
            )}
            empty={
              <EmptyState icon={<Boxes />} title="该子系统暂无设备" description="切换子系统 / 调整筛选，或新增设备" action={<Button size="sm" onClick={() => setDeviceFormOpen(true)}><Plus className="size-3.5" />新增设备</Button>} />
            }
          />
        </div>
      </div>

      {/* 详情抽屉 */}
      {detailType && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-ink/20" onClick={() => setDetailTypeId(undefined)} />
          <aside className="relative flex h-full w-[400px] flex-col border-l border-rule bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
              <p className="truncate text-[13px] font-semibold">{detailType.product.name}</p>
              <div className="flex items-center gap-1">
                <Button size="xs" variant="outline" onClick={() => setDeviceTypeModal({ open: true, product: detailType.product })}>编辑设备</Button>
                <button type="button" className="rounded p-1 text-faint hover:bg-hover" onClick={() => setDetailTypeId(undefined)} aria-label="关闭"><CloseX className="size-4" /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <p className="flex items-center gap-1.5 text-[12px] text-muted">
                {detailType.product.device_code && <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10.5px] text-accent" title="设备编码">{detailType.product.device_code}</span>}
                <span className="mr-1 rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10.5px] text-muted">{catLabelOf(detailType.product.category)}</span>
                单位 · {detailType.product.unit || '—'}
              </p>
              {htmlToText(detailType.product.specification) && (
                <Block title="通用参数">
                  <div className="text-[12px] leading-relaxed whitespace-pre-wrap text-muted">{htmlToPlainText(detailType.product.specification)}</div>
                </Block>
              )}

              <Block title="品牌备选">
                <div className="flex flex-wrap gap-1.5">
                  {detailType.brandNames.length ? detailType.brandNames.map((b) => <Badge key={b} variant="neutral">{b}</Badge>) : <span className="text-[11px] text-faint">无品牌</span>}
                  {detailType.disabledCount > 0 && <Badge variant="warn">停用 {detailType.disabledCount}</Badge>}
                </div>
              </Block>

              <Block title="档次覆盖">
                <div className="flex flex-wrap gap-1.5">
                  {detailType.gradeCoverage.map((c) => (
                    <span key={c.grade} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', c.count > 0 ? 'bg-surface-subtle text-ink' : 'bg-surface-subtle/50 text-faint')}>
                      {GRADE_LABEL[c.grade] ?? c.grade} {c.count}
                    </span>
                  ))}
                </div>
              </Block>

              <Block title="参考价区间">
                <p className="font-mono text-[15px] font-bold text-ink">
                  {detailType.priceMin != null ? fmtMoney(detailType.priceMin) + (detailType.priceMax !== detailType.priceMin ? ` ~ ${fmtMoney(detailType.priceMax!)}` : '') : <span className="text-[12px] font-normal text-danger">全部缺价</span>}
                </p>
              </Block>

              <Block title={`品牌型号配置行（${detailType.rows.length}）`}>
                <div className="space-y-1.5">
                  {detailType.rows.map((row) => (
                    <div key={row.m.id} onClick={() => setSelectedModelId(row.m.id)} className={cn('cursor-pointer rounded-md border p-2 transition-colors', selectedModelId === row.m.id ? 'border-accent bg-accent-soft/20' : 'border-rule')}>
                      <div className="flex items-center gap-1.5">
                        <span className="flex-1 truncate text-[12px] font-medium">
                          {row.brandName || <span className="text-faint">无品牌</span>}
                          <span className="ml-1 font-mono text-muted">{row.m.model}</span>
                        </span>
                        <span className={cn('font-mono text-[12px] font-semibold', row.unitPrice <= 0 ? 'text-danger' : 'text-ink')}>{row.unitPrice > 0 ? fmtMoney(row.unitPrice) : '缺价'}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1.5 text-[11px] text-muted">
                          {row.m.grade_code ? <span className="text-ink">{GRADE_LABEL[row.m.grade_code]}</span> : <span className="text-faint">未设档</span>}
                          <StatusBadge status={row.m.status === 'disabled' ? 'disabled' : 'active'} />
                        </span>
                        <div className="flex gap-0.5">
                          <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="编辑型号" onClick={(e) => { e.stopPropagation(); setModelModal({ open: true, model: row.m }) }}><Pencil className="size-3" /></button>
                          <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-warn" title="停用/启用" onClick={(e) => { e.stopPropagation(); toggleStatus(row.m) }}><Power className="size-3" /></button>
                          <button
                            type="button"
                            className={cn('rounded p-1', confirmId === `del-${row.m.id}` ? 'bg-danger text-white' : 'text-faint hover:bg-hover hover:text-danger')}
                            title="删除（需两次确认）"
                            onClick={(e) => { e.stopPropagation(); askConfirm(`del-${row.m.id}`, () => removeModel(row.m)) }}
                          ><Trash2 className="size-3" /></button>
                        </div>
                      </div>
                      {htmlToText(row.m.detail_html, 90) && (
                        <p className="mt-1.5 border-t border-rule/60 pt-1.5 text-[11px] text-faint">{htmlToText(row.m.detail_html, 90)}</p>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setModelModal({ open: true, defaultProductId: detailType.product.id })}>
                    <Plus className="size-3.5" />在本设备下添加型号
                  </Button>
                </div>
              </Block>

              <Block title={`价格（${priceRow?.m.model ?? ''}）· 参考价 / 台账价`}>
                {priceRow ? (
                  <PriceEditor key={priceRow.m.id} modelId={priceRow.m.id} prices={DeviceService.prices(priceRow.m.id)} usageCount={DeviceService.modelUsage(priceRow.m.id).systemCount} />
                ) : (
                  <p className="text-[11.5px] text-faint">暂无配置行</p>
                )}
              </Block>

              <Block title="使用情况（其下型号聚合）">
                <TypeUsage productId={detailType.product.id} />
              </Block>

              <Block title="数量逻辑（设备链）">
                <ChainQuotaPanel productId={detailType.product.id} systemId={systemId} />
              </Block>

              <MaterialQuotaEditor productId={detailType.product.id} productName={detailType.product.name} />

              <div className="border-t border-rule pt-2">
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-[6px] text-[13px] font-medium transition-colors',
                    confirmId === `deltype-${detailType.product.id}` ? 'bg-danger py-2 text-white' : 'py-1.5 text-danger hover:bg-danger-soft',
                  )}
                  onClick={() => askConfirm(`deltype-${detailType.product.id}`, () => removeDevice(detailType))}
                >
                  <Trash2 className="size-3.5" />{confirmId === `deltype-${detailType.product.id}` ? '再次点击确认删除' : '删除设备类型'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 新增设备（设备 + 配置行） */}
      <DeviceFormModal open={deviceFormOpen} onClose={() => setDeviceFormOpen(false)} defaultSystemId={systemId} onDone={(pid) => { setDetailTypeId(pid) }} />
      {/* 新增 / 编辑型号（配置行） */}
      <ModelFormModal
        key={`mf-${modelModal.model?.id ?? modelModal.defaultProductId ?? String(modelModal.open)}`}
        open={modelModal.open}
        onClose={() => setModelModal({ open: false })}
        model={modelModal.model}
        defaultProductId={modelModal.defaultProductId}
        defaultSystemId={systemId}
      />
      {/* 编辑设备类型 */}
      <DeviceTypeFormModal key={`df-${deviceTypeModal.product?.id ?? String(deviceTypeModal.open)}`} open={deviceTypeModal.open} onClose={() => setDeviceTypeModal({ open: false })} product={deviceTypeModal.product} />
      {/* 品牌新增 / 编辑 */}
      <BrandFormModal key={`bf-${brandModal.brand?.id ?? String(brandModal.open)}`} open={brandModal.open} onClose={() => setBrandModal({ open: false })} brand={brandModal.brand} />
      {/* 缺档明细（设备类型 × 档位） */}
      <MissingGradeModal open={gradeWarnOpen} onClose={() => setGradeWarnOpen(false)} stats={stats} onGoto={(deviceTypeId) => {
        setGradeWarnOpen(false)
        const p = useDB.getState().getById<Product>(T.products, deviceTypeId)
        if (!p) return
        if (p.system_id) switchSystem(p.system_id)
        setDetailTypeId(p.id)
        setExpandedIds(new Set([p.id]))
      }} />
      {/* 供应商管理 */}
      <SupplierModal open={supplierModal.open} onClose={() => setSupplierModal({ open: false })} selected={supplierModal.supplier} onEdit={(s) => setSupplierModal({ open: true, supplier: s })} />
      {/* 批量导入 */}
      <DeviceImportModal open={importOpen} onClose={() => setImportOpen(false)} defaultSystemId={systemId} />
      {/* 价格影响分析 */}
      <PriceImpactModal open={impactOpen} onClose={() => setImpactOpen(false)} />
      {/* 价格治理 */}
      <PriceGovernModal open={governOpen} onClose={() => setGovernOpen(false)} />
      {/* 设备删除被引用提示 */}
      <DeviceInUseModal open={inUseModal.open} onClose={() => setInUseModal({ open: false })} deviceName={inUseModal.deviceName} entries={inUseModal.entries ?? []} />
      {/* 设备系统管理（自定义系统/删除级联） */}
      <SystemManageModal open={systemManageOpen} onClose={() => setSystemManageOpen(false)} />
      {/* 数据分析 */}
      <DeviceAnalytics />
    </div>
  )
}

/* ---------- 设备类型主行展开区：品牌型号配置行（SortableTable 的 renderExpanded） ---------- */
function ModelRowsExpanded({
  dt, selectedIds, confirmId,
  onToggleSelect, onAskConfirm, onToggleStatus, onRemoveModel, onEditModel, onAddModel,
}: {
  dt: DeviceTypeView
  selectedIds: Set<string>
  confirmId: string | null
  onToggleSelect: (id: string) => void
  onAskConfirm: (id: string, cb: () => void) => void
  onToggleStatus: (m: ProductModel) => void
  onRemoveModel: (m: ProductModel) => void
  onEditModel: (m: ProductModel) => void
  onAddModel: () => void
}) {
  return (
    <div className="px-2 py-1">
      <div className="flex items-center justify-between border-b border-rule pb-1">
        <p className="text-[10.5px] font-semibold tracking-wide text-faint uppercase">品牌型号配置行</p>
        <span className="font-mono text-[10px] text-faint">{dt.rows.length} 个型号</span>
      </div>
      {dt.rows.length ? (
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10.5px] text-faint">
              <th className="py-1 pr-2 font-medium"></th>
              <th className="py-1 pr-2 font-medium">品牌</th>
              <th className="py-1 pr-2 font-medium">型号</th>
              <th className="py-1 pr-2 font-medium">详细参数</th>
              <th className="py-1 pr-2 font-medium">档次</th>
              <th className="py-1 pr-2 font-medium">参考价</th>
              <th className="py-1 pr-2 font-medium">状态</th>
              <th className="py-1 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {dt.rows.map((row) => (
              <tr key={row.m.id} className={cn('border-b border-rule/40 text-[12px]', row.m.status === 'disabled' && 'opacity-60')}>
                <td className="py-1.5 pr-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(row.m.id)} onChange={() => onToggleSelect(row.m.id)} className="accent-accent" aria-label="选择型号" />
                </td>
                <td className="py-1.5 pr-2 font-medium">{row.brandName || <span className="text-faint">—</span>}</td>
                <td className="py-1.5 pr-2 font-mono">{row.m.model}</td>
                <td className="max-w-[260px] py-1.5 pr-2 text-muted">{htmlToText(row.m.detail_html, 50) || <span className="text-faint">—</span>}</td>
                <td className="py-1.5 pr-2">{row.m.grade_code ? <span className="text-ink">{GRADE_LABEL[row.m.grade_code]}</span> : <span className="text-faint">—</span>}</td>
                <td className={cn('py-1.5 pr-2 font-mono font-semibold', row.unitPrice <= 0 ? 'text-danger' : 'text-ink')}>{row.unitPrice > 0 ? fmtMoney(row.unitPrice) : '缺价'}</td>
                <td className="py-1.5 pr-2"><StatusBadge status={row.m.status === 'disabled' ? 'disabled' : 'active'} /></td>
                <td className="py-1.5 text-right">
                  <div className="flex justify-end gap-0.5">
                    <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="编辑型号" onClick={(e) => { e.stopPropagation(); onEditModel(row.m) }}><Pencil className="size-3" /></button>
                    <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-warn" title="停用/启用" onClick={(e) => { e.stopPropagation(); onToggleStatus(row.m) }}><Power className="size-3" /></button>
                    <button
                      type="button"
                      className={cn('rounded p-1', confirmId === `del-${row.m.id}` ? 'bg-danger text-white' : 'text-faint hover:bg-hover hover:text-danger')}
                      title="删除（需两次确认）"
                      onClick={(e) => { e.stopPropagation(); onAskConfirm(`del-${row.m.id}`, () => onRemoveModel(row.m)) }}
                    ><Trash2 className="size-3" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="py-3 text-center text-[11.5px] text-faint">该设备暂无型号</p>
      )}
      <div className="pt-1.5">
        <Button size="xs" variant="outline" onClick={onAddModel}><Plus className="size-3" />在本设备下添加型号</Button>
      </div>
    </div>
  )
}

/* ---------- 设备类型使用情况（其下型号引用聚合） ---------- */
function TypeUsage({ productId }: { productId: string }) {
  const [productModels, deviceSelections, billItems, projectSystems, projects] = useDBTables([
    T.product_models,
    T.device_selections,
    T.bill_items,
    T.project_systems,
    T.projects,
  ] as const)
  const agg = useMemo(() => {
    const models = productModels.filter((m) => m.product_id === productId)
    const names = new Set<string>()
    let qty = 0
    let amount = 0
    let selectionCount = 0
    for (const m of models) {
      const u = DeviceService.modelUsage(m.id)
      u.projectNames.forEach((n) => names.add(n))
      qty += u.totalQty
      amount += u.totalAmount
      selectionCount += u.selectionCount
    }
    return { projectNames: [...names], totalQty: qty, totalAmount: amount, selectionCount }
  }, [productId, productModels, deviceSelections, billItems, projectSystems, projects])
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="font-mono text-[15px] font-bold text-accent">{fmtNum(agg.selectionCount)}</p><p className="text-[10px] text-muted">选型</p></div>
        <div><p className="font-mono text-[15px] font-bold text-ink">{fmtNum(agg.totalQty)}</p><p className="text-[10px] text-muted">总量</p></div>
        <div><p className="font-mono text-[15px] font-bold text-ink">{fmtMoney(agg.totalAmount)}</p><p className="text-[10px] text-muted">金额</p></div>
      </div>
      {agg.projectNames.length ? (
        <ul className="mt-2 space-y-0.5">
          {agg.projectNames.map((n) => <li key={n} className="flex items-center gap-1.5 text-[12px] text-muted"><BadgeCheck className="size-3 text-ok" />{n}</li>)}
        </ul>
      ) : (
        <p className="mt-1 text-[11.5px] text-faint">尚未被项目选型</p>
      )}
    </div>
  )
}

/* ---------- 小部件 ---------- */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-rule pt-2.5">
      <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">{title}</p>
      {children}
    </div>
  )
}

function catLabelOf(code?: string): string {
  return DEVICE_CATEGORIES.find((c) => c.code === (code ?? '__other'))?.label ?? (code ?? '其他')
}

function inUseOf(modelId: string): boolean {
  const db = useDB.getState().db
  const sels = (db[T.device_selections] ?? []) as unknown as { model_id: string }[]
  const bills = (db[T.bill_items] ?? []) as unknown as { device_model_id?: string }[]
  return sels.some((s) => s.model_id === modelId) || bills.some((i) => i.device_model_id === modelId)
}