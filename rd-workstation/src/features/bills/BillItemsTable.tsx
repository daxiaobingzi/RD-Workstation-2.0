import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { T } from '../../types/domain'
import { BillService } from '../../services'
import type { BillItem } from '../../types/domain'
import { SysGroupedTable } from '../../components/ui/sys-grouped-table'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/field'
import { toast } from '../../components/ui/toast'
import { cn, fmtMoney, fmtNum } from '../../lib/utils'

type RichItem = BillItem & { deviceName?: string; deviceCategory?: string; brandName?: string; spec?: string; detail?: string; deviceCode?: string }

/** 清单明细交互组件（项目详情清单 tab / 全局清单页共用）：
 *  按「系统 → 五区」分组展示；行内编辑数量·单价（自动重算金额）、添加自定义行、删除行、已确认版本锁定。 */
export function BillItemsTable({ items, locked }: { items: RichItem[]; locked?: boolean }) {
  const navigate = useNavigate()
  useDB((s) => s.db)
  // 行内编辑数量/单价
  const [cellEdit, setCellEdit] = useState<{ itemId: string; field: 'quantity' | 'unit_price'; draft: string } | null>(null)
  // 删除行（二次确认）
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  // 新增自定义行
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ item_name: '', unit: '项', category: '其他', quantity: '', unit_price: '' })

  const commitCell = () => {
    if (!cellEdit) return
    const v = Number.parseFloat(cellEdit.draft)
    if (!Number.isNaN(v) && v >= 0) BillService.updateItem(cellEdit.itemId, { [cellEdit.field]: v })
    setCellEdit(null)
  }
  const askDel = (itemId: string, cb: () => void) => {
    if (confirmDel === itemId) { setConfirmDel(null); cb(); return }
    setConfirmDel(itemId)
    window.setTimeout(() => setConfirmDel((c) => (c === itemId ? null : c)), 2500)
  }
  const submitAdd = (versionId: string | null) => {
    if (!versionId) { toast('缺少版本标识', 'warn'); return }
    if (!addForm.item_name.trim()) { toast('请填写项名称', 'warn'); return }
    BillService.addItem(versionId, {
      item_name: addForm.item_name,
      unit: addForm.unit,
      category: addForm.category,
      quantity: Number.parseFloat(addForm.quantity) || 0,
      unit_price: Number.parseFloat(addForm.unit_price) || 0,
    })
    toast('已添加自定义清单行')
    setAdding(false)
    setAddForm({ item_name: '', unit: '项', category: '其他', quantity: '', unit_price: '' })
  }

  const versionId = items[0]?.bill_version_id ?? null
  const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items])

  // 按系统 → 五区分组（project_system_id → ProjectSystem → system_id → StandardSystem.name）
  const db = useDB.getState().db
  const groupedSystems = useMemo(() => {
    const psMap = new Map((db[T.project_systems] as { id: string; system_id: string }[]).map((p) => [p.id, p.system_id]))
    const sysMap = new Map((db[T.systems] as { id: string; name: string; code?: string }[]).map((s) => [s.id, s]))
    const map = new Map<string, { systemId: string; systemName: string; items: { section: string; row: RichItem }[] }>()
    for (const i of items) {
      const sid = i.project_system_id ? psMap.get(i.project_system_id) : undefined
      const key = sid ?? '__other__'
      const entry = map.get(key) ?? {
        systemId: key,
        systemName: sid ? (sysMap.get(sid)?.name ?? '未知系统') : '未归入系统',
        items: [],
      }
      // 图分类：设备行用产品类别，材料行按自身 category 归入线缆/辅材
      const sec = i.deviceCategory ?? (i.category === 'cable' ? 'cable' : (i.category === 'conduit' || i.category === 'aux' ? 'aux' : 'other'))
      entry.items.push({ section: sec, row: i })
      map.set(key, entry)
    }
    return [...map.values()]
  }, [items, db])

  const tds = (it: { section: string; row: unknown }) => {
    const i = it.row as RichItem
    return (
      <>
        <td className="px-3 py-1.5"><span className="font-mono text-[12px] text-accent">{i.item_code}</span></td>
        <td className="px-3 py-1.5 font-medium">
          {i.device_model_id ? (
            <span className="inline-flex items-center gap-1.5">
              <button type="button" className="cursor-pointer text-left text-[12.5px] text-accent hover:underline" onClick={() => navigate(`/devices?modelId=${encodeURIComponent(i.device_model_id!)}`)} title="在设备中心查看该设备">
                {i.deviceName ?? i.item_name} <ExternalLink className="inline size-3" />
              </button>
              {i.deviceCode && <span className="rounded bg-surface-subtle px-1 py-px font-mono text-[10px] text-faint" title="设备编码">{i.deviceCode}</span>}
            </span>
          ) : i.deviceName ?? i.item_name}
        </td>
        <td className="max-w-[160px] truncate px-3 py-1.5 text-muted" title={i.spec ?? i.specification ?? ''}>{i.spec ?? i.specification ?? '—'}</td>
        <td className="px-3 py-1.5 text-muted">{i.unit ?? '—'}</td>
        <td className={cn('select-none px-3 py-1.5', !locked && 'cursor-pointer')} onClick={() => { if (!locked) setCellEdit({ itemId: i.id, field: 'quantity', draft: String(i.quantity) }) }}>
          {cellEdit?.itemId === i.id && cellEdit.field === 'quantity' ? (
            <Input
              autoFocus
              value={cellEdit.draft}
              onChange={(e) => setCellEdit({ ...cellEdit, draft: e.target.value })}
              onBlur={commitCell}
              onKeyDown={(e) => { if (e.key === 'Enter') commitCell(); if (e.key === 'Escape') setCellEdit(null) }}
              className="h-6 w-16 rounded-[4px] px-1 text-right font-mono text-[12px]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-[12.5px] text-ink">{fmtNum(i.quantity)}</span>
          )}
        </td>
        <td className="px-3 py-1.5 text-muted">{i.brandName ?? '—'}</td>
        <td className="px-3 py-1.5">
          {i.device_model_id ? (
            <button type="button" className="cursor-pointer font-mono text-left text-[12px] text-accent hover:underline" onClick={() => navigate(`/devices?modelId=${encodeURIComponent(i.device_model_id!)}`)} title="在设备中心查看该型号">
              {i.item_name} <ExternalLink className="inline size-3" />
            </button>
          ) : <span className="font-mono text-[12px] text-muted">{i.item_name}</span>}
        </td>
        <td className="max-w-[140px] truncate px-3 py-1.5 text-muted" title={i.detail ?? ''}>{i.detail ?? '—'}</td>
        <td className={cn('select-none px-3 py-1.5', !locked && 'cursor-pointer')} onClick={() => { if (!locked) setCellEdit({ itemId: i.id, field: 'unit_price', draft: String(i.unit_price) }) }}>
          {cellEdit?.itemId === i.id && cellEdit.field === 'unit_price' ? (
            <Input
              autoFocus
              value={cellEdit.draft}
              onChange={(e) => setCellEdit({ ...cellEdit, draft: e.target.value })}
              onBlur={commitCell}
              onKeyDown={(e) => { if (e.key === 'Enter') commitCell(); if (e.key === 'Escape') setCellEdit(null) }}
              className="h-6 w-20 rounded-[4px] px-1 text-right font-mono text-[12px]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="font-mono text-[12px] text-muted">{fmtMoney(i.unit_price)}</span>
          )}
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-[12.5px] font-semibold">{fmtMoney(i.amount)}</td>
        <td className="px-3 py-1.5">
          {!locked ? (
            <button
              type="button"
              title={confirmDel === i.id ? '再次点击确认删除该行' : '删除该行（需两次点击确认）'}
              aria-label={confirmDel === i.id ? `再次点击确认删除 ${i.item_name}` : `删除 ${i.item_name}`}
              onClick={() => askDel(i.id, () => { BillService.removeItem(i.id); toast('已删除该清单行', 'info') })}
              className={cn(
                'rounded p-1 transition-colors',
                confirmDel === i.id ? 'bg-danger text-white' : 'text-faint hover:bg-hover hover:text-danger',
              )}
            >
              {confirmDel === i.id && <span className="mr-1 text-[10px] font-medium">确认？</span>}
              <Trash2 className="size-3.5" />
            </button>
          ) : <span className="text-[11px] text-faint">已冻结</span>}
        </td>
      </>
    )
  }

  return (
    <div>
      <SysGroupedTable
        systems={groupedSystems}
        columns={[
          { key: 'code', title: '编码' },
          { key: 'device', title: '设备名称' },
          { key: 'model', title: '型号' },
          { key: 'spec', title: '详细参数' },
          { key: 'qty', title: '数量', align: 'right' },
          { key: 'price', title: '单价', align: 'right' },
          { key: 'amount', title: '金额', align: 'right' },
          { key: 'op', title: '' },
        ]}
        renderRow={tds}
        amountOf={(it) => (it.row as RichItem).amount}
      />

      {/* 添加自定义行表单 */}
      {adding && versionId && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-rule bg-surface-subtle/50 px-2.5 py-2">
          <Input value={addForm.item_name} onChange={(e) => setAddForm({ ...addForm, item_name: e.target.value })} placeholder="项名称" className="h-6 w-36 text-[12px]" />
          <Input value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} placeholder="类别" className="h-6 w-20 text-[12px]" />
          <Input type="number" value={addForm.quantity} onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })} placeholder="数量" className="h-6 w-16 text-right font-mono text-[12px]" />
          <Input type="number" value={addForm.unit_price} onChange={(e) => setAddForm({ ...addForm, unit_price: e.target.value })} placeholder="单价" className="h-6 w-20 text-right font-mono text-[12px]" />
          <Button size="xs" onClick={() => submitAdd(versionId)} className="text-[11px]">确定</Button>
          <Button size="xs" variant="ghost" onClick={() => setAdding(false)} className="text-[11px]">取消</Button>
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between">
        {!locked && (
          <Button size="xs" variant="outline" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-3" />{adding ? '取消添加' : '添加自定义行'}
          </Button>
        )}
        <span className="ml-auto text-[13px]"><span className="text-muted">合计：</span><span className="ml-2 font-mono font-bold">{fmtMoney(total)}</span></span>
      </div>
    </div>
  )
}