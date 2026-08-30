import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

/** 五区分组固定口径：front/back/cable/aux/other（与设备中心 Product.category 对应） */
export const SYS_SECTIONS: { key: string; label: string }[] = [
  { key: 'front', label: '前端设备' },
  { key: 'back', label: '终端设备' },
  { key: 'cable', label: '管材线缆' },
  { key: 'aux', label: '辅材' },
  { key: 'other', label: '其他' },
]
export function sectionLabel(key?: string): string {
  return SYS_SECTIONS.find((s) => s.key === key)?.label ?? '其他'
}

export interface SysGroupedRow<S = string> {
  section: S
  row: unknown
}

export interface SysGroupedTableProps {
  /** 按系统分组：每个系统一个面板，内含五区行 */
  systems: { systemId: string; systemName: string; items: SysGroupedRow[] }[]
  /** 列定义（渲染表头） */
  columns: { key: string; title: string; align?: 'left' | 'right' }[]
  /** 单行渲染：返回一行 <td> 序列；参数为该行的原始数据 */
  renderRow: (item: SysGroupedRow) => ReactNode
  /** 小计取值：金额行返回金额，其他列返回 undefined/0 */
  amountOf?: (item: SysGroupedRow) => number | undefined
  /** 空态 */
  empty?: ReactNode
  /** 系统级小计是否显示（默认 true） */
  showSystemTotal?: boolean
  /** 启用表头列宽拖动（列宽存 localStorage，按 resizableKey 隔离；默认关闭不影响旧版） */
  resizable?: boolean
  resizableKey?: string
}

/** 按弱电系统分组展示的表：系统折叠面板 → 五区（前端设备/后端设备/管材线缆/辅材/其他）→ 分区行 + 小计。
 *  设备 / 清单 / 预算三模块共用。 */
export function SysGroupedTable({ systems, columns, renderRow, amountOf, empty, showSystemTotal = true, resizable, resizableKey }: SysGroupedTableProps) {
  // 默认展开第一个系统
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(systems[0] ? [systems[0].systemId] : []))
  // 列宽（resizable 时启用；localStorage 记忆）
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (!resizable || !resizableKey) return {}
    try {
      return JSON.parse(localStorage.getItem(`sys-table:w:${resizableKey}`) ?? '{}') as Record<string, number>
    } catch { return {} }
  })
  const persistWidth = (key: string, w: number) => {
    setWidths((prev) => {
      const next = { ...prev, [key]: w }
      if (resizableKey) localStorage.setItem(`sys-table:w:${resizableKey}`, JSON.stringify(next))
      return next
    })
  }
  /** 列宽拖动：pointer capture 在表头拖柄上调整列宽 */
  const startResize = (e: React.PointerEvent, key: string) => {
    if (!resizable) return
    e.preventDefault()
    const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null
    if (!th) return
    const startX = e.clientX
    const startW = th.getBoundingClientRect().width
    const move = (ev: PointerEvent) => {
      const w = Math.max(60, Math.min(560, startW + ev.clientX - startX))
      th.style.width = `${w}px`
      persistWidth(key, w)
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  if (!systems.length) return <>{empty}</>

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {systems.map((sys) => {
        const open = openIds.has(sys.systemId)
        const total = showSystemTotal && amountOf
          ? sys.items.reduce((s, it) => s + (amountOf(it) ?? 0), 0)
          : undefined
        return (
          <div key={sys.systemId} className="overflow-hidden rounded-lg border border-rule bg-surface">
            {/* 系统面板头 */}
            <button
              type="button"
              onClick={() => toggle(sys.systemId)}
              className="flex w-full items-center gap-2 border-b border-rule bg-surface-subtle/40 px-3 py-2 text-left transition-colors hover:bg-hover"
            >
              {open ? <ChevronDown className="size-3.5 text-faint" /> : <ChevronRight className="size-3.5 text-faint" />}
              <span className="text-[13px] font-semibold">{sys.systemName}</span>
              <span className="ml-auto flex items-center gap-2">
                {typeof total === 'number' && (
                  <span className="font-mono text-[12px] font-semibold text-ink">{fmtAmt(total)}</span>
                )}
                <span className="rounded-full bg-surface px-1.5 font-mono text-[10.5px] text-muted">{sys.items.length}</span>
              </span>
            </button>
            {open && (
              <div className="overflow-auto">
                <table className="border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[10.5px] text-faint">
                      {columns.map((c) => (
                        <th key={c.key} className={cn('relative px-3 py-1.5 font-medium whitespace-nowrap', c.align === 'right' && 'text-right')}
                          style={resizable && widths[c.key] ? { width: widths[c.key] } : undefined}>
                          {c.title}
                          {resizable && (
                            <span
                              className="absolute inset-y-0 -right-0.5 z-10 w-1.5 cursor-col-resize hover:bg-accent/40"
                              onPointerDown={(e) => startResize(e, c.key)}
                              title="拖动调整列宽"
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SYS_SECTIONS.map((sec) => {
                      const rows = sys.items.filter((it) => (it.section as string) === sec.key)
                      if (!rows.length) return null
                      const secTotal = amountOf ? rows.reduce((s, it) => s + (amountOf(it) ?? 0), 0) : undefined
                      return (
                        <FragmentRow key={sec.key} colSpan={columns.length} label={sec.label} count={rows.length} total={secTotal} renderRow={renderRow} rows={rows} />
                      )
                    })}
                    {!sys.items.length && (
                      <tr><td colSpan={columns.length} className="px-3 py-4 text-center text-[12px] text-faint">暂无数据</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** 五区分区行：分区标题行 + 数据行 + 分区小计行 */
function FragmentRow({
  label, count, total, rows, renderRow, colSpan,
}: {
  label: string; count: number; total?: number; rows: SysGroupedRow[]; renderRow: (item: SysGroupedRow) => ReactNode; colSpan: number
}) {
  const rowsJsx = useMemo(() => rows.map((it, idx) => <tr key={idx} className="hover:bg-hover">{renderRow(it)}</tr>), [rows, renderRow])
  return (
    <>
      <tr>
        <td colSpan={colSpan} className="bg-surface-subtle/60 px-3 py-1.5">
          <span className="flex items-center gap-2 text-[10.5px] font-semibold tracking-wide text-muted uppercase">
            {label}
            <span className="font-mono font-normal normal-case">{count}</span>
          </span>
        </td>
      </tr>
      {rowsJsx}
      {typeof total === 'number' && (
        <tr className="border-t border-rule/60">
          <td colSpan={colSpan} className="px-3 py-1 text-right">
            <span className="text-[11px] text-faint">小计 </span>
            <span className="font-mono text-[12px] font-semibold">{fmtAmt(total)}</span>
          </td>
        </tr>
      )}
    </>
  )
}

export function fmtAmt(v: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(v)
}