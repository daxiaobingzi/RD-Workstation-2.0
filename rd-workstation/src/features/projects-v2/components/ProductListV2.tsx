import { useMemo, useState } from 'react'
import { Boxes, RefreshCw, Download, ExternalLink, FileText, X } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { BillService, BudgetService } from '../../../services'
import { SysGroupedTable, SYS_SECTIONS, sectionLabel } from '../../../components/ui/sys-grouped-table'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/empty'
import { toast } from '../../../components/ui/toast'
import { fmtNum, cn } from '../../../lib/utils'
import { exportBillFlat, exportBillSplit } from '../../bills/export-xlsx'

type RichItem = ReturnType<typeof BillService.items>[number]

/** 模块⑥ 材料表：清单最新版本明细，系统 → 五区；通用参数列=设备中心 Product.specification 富文本（可点击预览） */
export function ProductListV2({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const [versionId, setVersionId] = useState('')
  const [preview, setPreview] = useState<RichItem | null>(null)
  const [delVersionId, setDelVersionId] = useState('')

  const versions = useMemo(() => BillService.versions(projectId), [projectId, useDB.getState().db])
  const activeId = versionId || versions[0]?.id || ''
  const items = useMemo<RichItem[]>(() => (activeId ? BillService.items(activeId) : []), [activeId, useDB.getState().db])
  const version = versions.find((v) => v.id === activeId)

  const grouped = useMemo(() => {
    const psMap = new Map((useDB.getState().db[T.project_systems] as { id: string; system_id: string }[]).map((p) => [p.id, p.system_id]))
    const sysMap = new Map((useDB.getState().db[T.systems] as { id: string; name: string }[]).map((s) => [s.id, s]))
    const map = new Map<string, { systemId: string; systemName: string; items: { section: string; row: RichItem }[] }>()
    for (const i of items) {
      const sid = i.project_system_id ? psMap.get(i.project_system_id) : undefined
      const key = sid ?? '__other__'
      const entry = map.get(key) ?? { systemId: key, systemName: sid ? (sysMap.get(sid)?.name ?? '未知系统') : '未归入系统', items: [] }
      entry.items.push({ section: i.deviceCategory ?? 'other', row: i })
      map.set(key, entry)
    }
    return [...map.values()]
  }, [items])

  const generateNew = () => {
    const { version: v, items: its } = BillService.generateProject(projectId)
    BudgetService.generateProject(projectId, v.id)
    toast(`已重新生成材料表版本 ${v.version_no}（${its.length} 项），预算已同步`)
    setVersionId(v.id)
  }

  const removeVersion = (v: { id: string; version_no: string }) => {
    if (delVersionId !== v.id) { setDelVersionId(v.id); setTimeout(() => setDelVersionId((cur) => (cur === v.id ? '' : cur)), 2500); return }
    BillService.remove(v.id)
    setDelVersionId('')
    setVersionId('')
    toast(`版本 ${v.version_no} 已删除（其余版本号不变，同步清理依赖预算）`, 'info')
  }

  const tds = (it: { section: string; row: unknown }) => {
    const r = it.row as RichItem
    const editable = !version || version.status !== 'confirmed'
    return (
      <>
        <td className="px-3 py-1.5">
          <button type="button" className="inline-flex items-center gap-1 text-left text-[12.5px] font-medium text-accent hover:underline" title="点击查看设备中心通用参数/详细参数（同源联动）"
            onClick={() => setPreview(r)}>
            <ExternalLink className="size-3" />{r.deviceName ?? r.item_name ?? '—'}
          </button>
        </td>
        <td className="max-w-[300px] truncate px-3 py-1.5 text-muted" title={r.spec ?? r.specification}>
          {r.spec ?? r.specification ?? '—'}
        </td>
        <td className="px-3 py-1.5 text-muted">{r.unit}</td>
        <td className="px-3 py-1.5 text-right font-mono text-[12px]">
          {editable ? (
            <input
              type="number"
              defaultValue={r.quantity}
              className="h-6 w-20 rounded-[5px] border border-rule bg-surface px-1 text-right font-mono text-[12px] focus:border-accent focus:outline-none"
              onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== r.quantity) { BillService.updateItem(r.id, { quantity: v }); toast('数量已更新') } }}
            />
          ) : (
            <span>{fmtNum(r.quantity)}</span>
          )}
        </td>
        <td className="max-w-[160px] px-3 py-1.5">
          {editable ? (
            <input
              defaultValue={(r as { remark?: string }).remark ?? ''}
              placeholder="填写备注（单行）"
              className="h-6 w-full min-w-[96px] rounded-[5px] border border-rule bg-surface px-1.5 text-[11.5px] focus:border-accent focus:outline-none"
              onBlur={(e) => { BillService.updateItem(r.id, { remark: e.target.value }); toast('备注已保存', 'info') }}
            />
          ) : (
            <span className="truncate text-faint">{(r as { remark?: string }).remark ?? '—'}</span>
          )}
        </td>
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-0.5">
            <button type="button" title="删除此条" onClick={() => { BillService.removeItem(r.id); toast('已删除该材料行', 'info') }} className="rounded p-1 text-faint hover:bg-hover hover:text-danger">🗑</button>
          </div>
        </td>
      </>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-surface px-3.5 py-2.5">
        {versions.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {versions.slice(0, 8).map((v) => (
                <span key={v.id}
                  className={cn('flex items-center overflow-hidden rounded-full border text-[11px] transition-colors',
                    activeId === v.id ? 'border-accent bg-accent-soft text-accent' : 'border-rule bg-surface text-muted hover:border-accent/40')}>
                  <button type="button" onClick={() => setVersionId(v.id)} className="px-2 py-0.5">
                    {v.version_no}{v.status === 'confirmed' ? ' · 已确认' : ''}
                  </button>
                  <button
                    type="button"
                    title={delVersionId === v.id ? '再次点击确认删除该版本（其余版本号不变，并同步清理关联预算）' : '删除该版本'}
                    onClick={() => removeVersion(v)}
                    className={cn('border-l border-rule/60 px-1.5 py-0.5 transition-colors', delVersionId === v.id ? 'bg-danger text-white' : 'text-faint hover:text-danger')}
                  >
                    {delVersionId === v.id ? '确认?' : '🗑'}
                  </button>
                </span>
              ))}
              {versions.length > 8 && <span className="text-[10.5px] text-faint">+{versions.length - 8}</span>}
            </div>
            <span className="ml-2 text-[11.5px] text-faint">共 {versions.length} 版 · 当前 {version?.version_no ?? '—'} · {items.length} 项</span>
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={generateNew}><RefreshCw className="size-3.5" />重新生成材料表</Button>
          <Button size="sm" variant="outline" onClick={() => { if (activeId) { exportBillFlat(projectId, activeId); toast('已导出 Excel 整表分组') } }}><Download className="size-3.5" />Excel 整表</Button>
          <Button size="sm" variant="outline" onClick={() => { if (activeId) { exportBillSplit(projectId, activeId); toast('已导出 Excel 分系统') } }}><Download className="size-3.5" />Excel 分系统</Button>
        </div>
      </div>

      {version && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-surface-subtle/50 px-3.5 py-2 text-[12px] text-muted">
          <FileText className="size-3.5 text-accent" />
          当前版本 <b className="font-mono">{version.version_no}</b>
          <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold', version.status === 'confirmed' ? 'bg-ok-soft/60 text-ok' : 'bg-warn-soft/50 text-warn')}>
            {version.status === 'confirmed' ? '已确认（冻结不可编辑）' : '草稿（可编辑）'}
          </span>
          <span className="ml-auto text-faint">五区：{SYS_SECTIONS.map((s) => sectionLabel(s.key)).join(' / ')}</span>
        </div>
      )}

      <p className="rounded-md border border-dashed border-rule bg-surface px-3 py-1.5 text-[11.5px] text-faint">
        生成逻辑：每点一次「确认生成清单」/「重新生成材料表」即依据<b>当前推导结果 + 选型</b>生成新版本（版本号自动递增，草稿）；已确认版本冻结不可再改；重新生成时保留上一版本的手工调整行（数量/备注）与自定义行。材料表只统计工程量，不展示单价与金额。
      </p>

      {grouped.length ? (
        <SysGroupedTable
          systems={grouped}
          columns={[
            { key: 'name', title: '设备名称' },
            { key: 'spec', title: '通用参数' },
            { key: 'unit', title: '单位' },
            { key: 'qty', title: '数量', align: 'right' },
            { key: 'remark', title: '备注' },
            { key: 'actions', title: '操作' },
          ]}
          renderRow={tds}
          resizable
          resizableKey={`mat-${projectId}-${activeId}`}
          empty={<EmptyState icon={<Boxes />} title="暂无材料" description="请先在「推导」页执行推导，再「重新生成材料表」" />}
        />
      ) : (
        <EmptyState icon={<Boxes />} title="暂无材料版本" description="点击「重新生成材料表」将推导结果固化为清单版本" action={<Button onClick={generateNew}><RefreshCw className="size-4" />重新生成材料表</Button>} />
      )}

      {/* 设备中心通用参数预览（非富文本 · 一行一条/分号分隔） */}
      {preview && (
        <Modal open onClose={() => setPreview(null)} title={cn('设备中心 · 通用参数', preview.deviceName ?? '')} footer={<Button variant="outline" onClick={() => setPreview(null)}><X className="size-4" />关闭</Button>} width={560}>
          <div className="space-y-2 rounded-md border border-rule bg-surface-subtle/50 p-3">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold">{preview.deviceName ?? preview.item_name} <span className="rounded bg-surface px-1.5 font-mono text-[10.5px] text-faint">{preview.deviceCode}</span></p>
            <div className="space-y-1 text-[12.5px] text-muted" style={{ whiteSpace: 'pre-wrap' }}>
              {splitLines(preview.spec ?? preview.specification).length ? splitLines(preview.spec ?? preview.specification).map((line, i) => (
                <p key={i}>• {line.trim()}</p>
              )) : <p>暂无通用参数内容</p>}
            </div>
            <p className="pt-1 text-[11px] text-faint">数据源：设备中心 Product.specification（纯文本），改参数即联动</p>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** 参数文本按 换行 / 分号 拆成条目（兼容"一行一条"录入与历史分号存储） */
function splitLines(text?: string): string[] {
  return String(text ?? '').split(/\r?\n|；|;|\u3000/).map((l) => l.trim()).filter(Boolean)
}