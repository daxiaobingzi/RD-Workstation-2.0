import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Columns3, GripVertical } from 'lucide-react'
import { THead, TBody, TR, TH, TD } from './table'
import { cn } from '../../lib/utils'

/* =============================================================================================================
 * SortableTable —— 自研轻量可排序/可调宽表格（不依赖第三方数据网格）
 *
 * 交互实现参照成熟规范（react-data-grid / AG Grid）：
 *  1. 列宽拖动：列头右缘 10px 热区，Pointer Capture 锁定拖拽，clamp(min/max) 约束
 *  2. 双击手柄 = max-content 自适应（精确测量，非字符估算）
 *  3. Ctrl+←/→ 微调列宽（聚焦表头后 ±10px，clamp 约束）
 *  4. 列拖拽换序：自定义幽灵列 drag image + 源列高亮 + 目标悬停高亮
 *  5. 行拖拽排序：拖拽中显示插入位置线（before/after），宿主持久化 sort_order
 *  6. 列布局记忆（localStorage：宽度 + 顺序 + 显隐，按 storageKey 隔离）
 *  7. 列显隐菜单（计数 + 重置布局）
 * 用法：<SortableTable columns rows rowKey storageKey onReorder />
 * ==============================================================================================================*/

export interface SortableColumn<R> {
  key: string
  title: ReactNode
  width?: number
  minWidth?: number
  maxWidth?: number
  /** 默认隐藏（可在「列」菜单中打开） */
  hiddenByDefault?: boolean
  /** 锁定列：始终显示，不允许在「列」菜单中隐藏（如承载跳转/操作的关键列） */
  locked?: boolean
  /** 行渲染；缺省显示文本 */
  render?: (row: R) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface Layout {
  widths: Record<string, number>
  order: string[]
  hidden: string[]
}

function loadLayout(key: string): Layout | null {
  try {
    const raw = localStorage.getItem(`sortable-table:${key}`)
    return raw ? (JSON.parse(raw) as Layout) : null
  } catch {
    return null
  }
}

export function SortableTable<R>({
  columns,
  rows,
  rowKey,
  storageKey,
  onReorder,
  renderRow,
  onRowClick,
  onRowDoubleClick,
  expandedKeys,
  onToggleExpand,
  renderExpanded,
  className,
  empty,
  minColWidth = 40,
}: {
  columns: SortableColumn<R>[]
  rows: R[]
  rowKey: (row: R) => string
  storageKey: string
  /** 行拖拽排序回调（from, to 为当前显示序下标）；实现方应持久化 */
  onReorder?: (from: number, to: number) => void
  /** 自定义整行渲染（如设备中心树展开行）；缺省按列 render */
  renderRow?: (row: R, rowIndex: number) => ReactNode
  /** 行点击（如整行展开） */
  onRowClick?: (row: R, rowIndex: number) => void
  /** 行双击（如打开编辑弹窗）；不响应按钮/输入控件上的双击 */
  onRowDoubleClick?: (row: R, rowIndex: number, e: React.MouseEvent) => void
  /** 展开态 key 集合（与 onToggleExpand 配合显示展开行） */
  expandedKeys?: ReadonlySet<string>
  onToggleExpand?: (key: string) => void
  /** 展开行渲染（占整行，colSpan 全列） */
  renderExpanded?: (row: R) => ReactNode
  className?: string
  empty?: ReactNode
  minColWidth?: number
}) {
  const baseKeys = useMemo(() => columns.map((c) => c.key), [columns])
  const [layout, setLayout] = useState<Layout>(() => {
    const saved = loadLayout(storageKey)
    if (saved) {
      // 兼容旧布局：锁定列不允许出现在 hidden（即使历史遗留）
      return { ...saved, hidden: saved.hidden.filter((k) => !(columns.find((c) => c.key === k)?.locked)) }
    }
    return {
      widths: Object.fromEntries(columns.filter((c) => c.width).map((c) => [c.key, c.width!])),
      order: baseKeys,
      hidden: columns.filter((c) => c.hiddenByDefault && !c.locked).map((c) => c.key),
    }
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [draggedCol, setDraggedCol] = useState<string | null>(null)
  const [hoverCol, setHoverCol] = useState<string | null>(null)
  const [focusedCol, setFocusedCol] = useState<string | null>(null)
  const [colDropPos, setColDropPos] = useState<{ key: string; pos: 'before' | 'after' } | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [rowDropPos, setRowDropPos] = useState<{ i: number; pos: 'before' | 'after' } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // 新增列（配置演进）自动追加
  useEffect(() => {
    const missing = baseKeys.filter((k) => !layout.order.includes(k))
    if (!missing.length) return
    const next = { ...layout, order: [...layout.order, ...missing] }
    setLayout(next)
    localStorage.setItem(`sortable-table:${storageKey}`, JSON.stringify(next))
  }, [baseKeys, layout, storageKey])

  const persist = (patch: Partial<Layout>) => {
    const next = { ...layout, ...patch }
    setLayout(next)
    localStorage.setItem(`sortable-table:${storageKey}`, JSON.stringify(next))
  }

  const visible = useMemo(
    () =>
      layout.order
        .filter((k) => {
          const col = columns.find((c) => c.key === k)
          // 锁定列恒显示，不受 hidden 影响（布局校验失败时也不误隐藏）
          if (col?.locked) return true
          return !layout.hidden.includes(k)
        })
        .map((k) => columns.find((c) => c.key === k)!)
        .filter(Boolean),
    [layout.order, layout.hidden, columns],
  )

  /** 固定列（折叠列 / 行拖拽列）：始终存在，宽度也入 layout（可调），参与 colgroup 一一对应，避免 fixed 布局下列宽错位 */
  const fixedCols = useMemo(() => {
    const list: { key: string; className: string; width: number; minWidth: number; title: string }[] = []
    if (onToggleExpand) list.push({ key: '__expand__', className: 'px-1 text-center', width: 32, minWidth: 28, title: '展开/折叠该行（可调列宽）' })
    if (onReorder) list.push({ key: '__drag__', className: 'px-1 text-center', width: 36, minWidth: 32, title: '按住拖动行排序（可调列宽）' })
    return list
  }, [onToggleExpand, onReorder])

  /** 当前列宽（持久化优先，其次列配置默认值） */
  const colWidth = (key: string) => layout.widths[key] ?? fixedCols.find((f) => f.key === key)?.width ?? columns.find((c) => c.key === key)?.width ?? 120

  /** 表格总宽 = 各列宽之和。fixed 布局下每列严格等于 <col> 宽 → 内容按列宽截断（ellipsis），列宽互不影响 */
  const totalWidth = useMemo(
    () => fixedCols.reduce((s, f) => s + colWidth(f.key), 0) + visible.reduce((s, c) => s + colWidth(c.key), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout.widths, layout.order, layout.hidden, fixedCols, visible],
  )

  /** 列宽 clamp：minWidth/maxWidth 约束（参照 rdg clampColumnWidth）；固定列按自身最小宽 */
  const clampWidth = (w: number, key: string) => {
    const fixed = fixedCols.find((f) => f.key === key)
    if (fixed) return Math.min(Math.max(w, fixed.minWidth), 560)
    const col = columns.find((c) => c.key === key)
    const min = col?.minWidth ?? minColWidth
    const max = col?.maxWidth ?? 560
    return Math.min(Math.max(w, min), max)
  }
  const applyWidth = (key: string, w: number) => {
    setLayout((prev) => {
      const widths = { ...prev.widths, [key]: w }
      localStorage.setItem(`sortable-table:${storageKey}`, JSON.stringify({ ...prev, widths }))
      return { ...prev, widths }
    })
  }

  const resetLayout = () => {
    localStorage.removeItem(`sortable-table:${storageKey}`)
    setLayout({
      widths: Object.fromEntries(columns.filter((c) => c.width).map((c) => [c.key, c.width!])),
      order: baseKeys,
      hidden: columns.filter((c) => c.hiddenByDefault && !c.locked).map((c) => c.key),
    })
  }

  /* ---------- 列宽拖动（Pointer Capture + clamp，参照 rdg HeaderCell） ---------- */
  const startResize = (e: React.PointerEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget as HTMLElement
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startW = colWidth(key)
    const onMove = (ev: PointerEvent) => applyWidth(key, clampWidth(startW + (ev.clientX - startX), key))
    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }

  /** 双击手柄：max-content 自适应（精确测量可见单元格 scrollWidth） */
  const autoFit = (key: string) => {
    const root = tableRef.current
    if (!root) return
    let max = 0
    root.querySelectorAll<HTMLElement>(`td[data-col="${key}"], th[data-col="${key}"]`).forEach((el) => {
      if (el.scrollWidth > max) max = el.scrollWidth
    })
    applyWidth(key, clampWidth(max + 4, key))
  }

  /* ---------- Ctrl+←/→ 微调列宽 ---------- */
  const onTableKeyDown = (e: React.KeyboardEvent) => {
    if (!e.ctrlKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    // 只响应列头获得焦点时（列头 tabIndex=-1 可聚焦但不可进入 Tab 序列）
    if (e.target instanceof HTMLElement && !e.target.closest('th')) return
    const key = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('.sortable-th-focused')?.getAttribute('data-col') ?? (e.target as HTMLElement).closest('th')?.getAttribute('data-col')
    if (!key) return
    e.preventDefault()
    const delta = e.key === 'ArrowRight' ? 10 : -10
    applyWidth(key, clampWidth(colWidth(key) + delta, key))
  }

  /* ---------- 列拖拽换序（幽灵列 + 源列高亮 + 半区 before/after 落点指示） ---------- */
  const onColDragStart = (e: React.DragEvent, key: string) => {
    const th = (e.currentTarget as HTMLElement).closest('th')
    if (th) {
      const ghost = th.cloneNode(true) as HTMLElement
      ghost.style.cssText =
        'position:fixed;top:-9999px;opacity:.9;border:1px solid var(--accent,#6366f1);border-radius:6px;background:var(--surface,#fff);box-shadow:0 4px 14px rgba(0,0,0,.15);padding:4px 10px;white-space:nowrap;z-index:9999;max-width:220px;overflow:hidden;text-overflow:ellipsis;'
      document.body.appendChild(ghost)
      e.dataTransfer.setDragImage(ghost, 24, 20)
      requestAnimationFrame(() => ghost.remove())
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
    setDraggedCol(key)
  }
  const onColDragOver = (e: React.DragEvent, targetKey: string) => {
    const fromKey = draggedCol ?? e.dataTransfer.getData('text/plain')
    if (!fromKey) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pos = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    setColDropPos((d) => (d?.key === targetKey && d?.pos === pos ? d : { key: targetKey, pos }))
  }
  const onColDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault()
    const fromKey = draggedCol ?? e.dataTransfer.getData('text/plain')
    const pos = colDropPos?.key === targetKey ? colDropPos.pos : 'before'
    setDraggedCol(null)
    setHoverCol(null)
    setColDropPos(null)
    if (!fromKey || fromKey === targetKey) return
    const order = [...layout.order]
    const i = order.indexOf(fromKey)
    const j = order.indexOf(targetKey)
    if (i < 0 || j < 0) return
    order.splice(i, 1)
    // 从数组移除后，j 需要基于原始位置换算
    const targetIndexAfter = order.indexOf(targetKey)
    let insertAt = targetIndexAfter + (pos === 'after' ? 1 : 0)
    // 从目标之前移走时不改变插入位；从目标之后移走时 -1（补偿右移）
    if (i < j && pos === 'before') insertAt -= 1
    order.splice(Math.max(0, Math.min(insertAt, order.length)), 0, fromKey)
    persist({ order })
  }

  /* ---------- 行拖拽排序（插入位置线 before/after） ---------- */
  const onRowDragStart = (e: React.DragEvent, i: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(i))
    setDragFrom(i)
  }
  const onRowDragOver = (e: React.DragEvent, i: number) => {
    if (dragFrom === null) return
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setRowDropPos({ i, pos })
  }
  const onRowDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    const from = Number(e.dataTransfer.getData('text/plain'))
    const pos = rowDropPos?.i === i ? rowDropPos.pos : null
    setDragFrom(null)
    setRowDropPos(null)
    if (Number.isNaN(from) || from === i || !onReorder) return
    // from 移除后，目标行下标会左移（若 from < i）。pos 决定插到目标行前还是后。
    let to = from < i ? i - 1 : i
    if (pos === 'after') to += 1
    onReorder(from, Math.max(0, Math.min(to, rows.length - 1)))
  }

  const toggleHidden = (key: string, hide: boolean) => {
    // 锁定列不允许隐藏；若尝试隐藏锁定列则直接忽略（并强制显示）
    const col = columns.find((c) => c.key === key)
    if (col?.locked && hide) return
    const hidden = hide ? [...layout.hidden, key] : layout.hidden.filter((k) => k !== key)
    persist({ hidden })
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* 工具栏：计数 + 列显隐 */}
      <div className="flex items-center justify-between border-b border-rule px-2 py-1">
        <span className="font-mono text-[11px] text-faint">{rows.length} 行</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-muted hover:bg-hover hover:text-ink"
          >
            <Columns3 className="size-3.5" />列
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 z-30 mt-1 min-w-44 overflow-hidden rounded-md border border-rule bg-surface shadow-lg">
              <div className="flex items-center justify-between border-b border-rule px-2 py-1">
                <span className="text-[11px] font-semibold text-muted">列显示</span>
                <span className="font-mono text-[10px] text-faint">{visible.length}/{columns.length}</span>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {columns.map((c) => {
                  const isVisible = c.locked || !layout.hidden.includes(c.key)
                  return (
                    <label key={c.key} className={cn('flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[12px] hover:bg-hover', c.locked && 'cursor-not-allowed opacity-60')}>
                      <input
                        type="checkbox"
                        checked={isVisible}
                        disabled={c.locked}
                        onChange={(e) => toggleHidden(c.key, !e.target.checked)}
                        className="accent-accent"
                      />
                      <span className="truncate">{c.title}</span>
                      {c.locked && <span className="ml-auto shrink-0 rounded bg-surface-subtle px-1 text-[9.5px] text-faint">固定</span>}
                    </label>
                  )
                })}
              </div>
              <div className="border-t border-rule p-1">
                <button
                  type="button"
                  onClick={resetLayout}
                  className="w-full rounded px-2 py-1 text-left text-[11.5px] text-muted hover:bg-hover hover:text-ink"
                >重置布局</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 overflow-auto" ref={tableRef} tabIndex={0} onKeyDown={onTableKeyDown} style={{ outline: 'none' }}>
        <table className="border-collapse text-[13px]" style={{ tableLayout: 'fixed', width: totalWidth }}>
          <colgroup>
            {/* 固定列也必须进 colgroup，与 cell 一一对应，否则 fixed 布局下列宽错位 */}
            {fixedCols.map((f) => <col key={f.key} style={{ width: layout.widths[f.key] ?? f.width }} />)}
            {visible.map((c) => <col key={c.key} style={{ width: layout.widths[c.key] ?? c.width ?? 120 }} />)}
          </colgroup>
          <THead>
            <TR>
              {fixedCols.map((f) => (
                <TH
                  key={f.key}
                  data-col={f.key}
                  onFocus={() => setFocusedCol(f.key)}
                  onBlur={() => setFocusedCol((k) => (k === f.key ? null : k))}
                  tabIndex={-1}
                  className={cn(
                    'group relative select-none',
                    f.className,
                    focusedCol === f.key && 'sortable-th-focused ring-2 ring-inset ring-accent/60',
                  )}
                >
                  <span className="inline-flex items-center gap-1 py-1">
                    {f.key === '__expand__' ? <ChevronRight className="size-3 text-faint" /> : <GripVertical className="size-3 text-faint" />}
                  </span>
                  {/* 固定列同样支持列宽拖动（拖拽/双击自适应/Ctrl+←/→） */}
                  <span
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize touch-none after:absolute after:inset-y-0.5 after:right-1 after:w-px after:bg-transparent after:transition-colors hover:after:bg-accent/60 group-hover:after:bg-rule"
                    onPointerDown={(e) => startResize(e, f.key)}
                    onDoubleClick={() => autoFit(f.key)}
                    title={f.title}
                    aria-hidden="true"
                  />
                </TH>
              ))}
              {visible.map((c) => {
                const dropLine = colDropPos?.key === c.key ? colDropPos.pos : null
                return (
                <TH
                  key={c.key}
                  data-col={c.key}
                  onDragOver={(e) => { e.preventDefault(); onColDragOver(e, c.key); setHoverCol(c.key) }}
                  onDragLeave={() => setHoverCol((h) => (h === c.key ? null : h))}
                  onDrop={(e) => onColDrop(e, c.key)}
                  onFocus={() => setFocusedCol(c.key)}
                  onBlur={() => setFocusedCol((k) => (k === c.key ? null : k))}
                  tabIndex={-1}
                  className={cn(
                    'group relative select-none',
                    c.align === 'right' && 'text-right',
                    draggedCol === c.key && 'bg-accent-soft/50',
                    hoverCol === c.key && 'bg-accent-soft/30',
                    focusedCol === c.key && 'sortable-th-focused ring-2 ring-inset ring-accent/60',
                  )}
                >
                  {/* 仅按住标题文字可拖动换列；resize 手柄区域不参与换序拖拽 */}
                  <span
                    draggable
                    onDragStart={(e) => onColDragStart(e, c.key)}
                    onDragEnd={() => { setDraggedCol(null); setHoverCol(null); setColDropPos(null) }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={cn('inline-flex cursor-grab items-center gap-1 py-1 whitespace-nowrap', c.align === 'right' && 'justify-end')}
                    title="按住表头文字拖动换列"
                  >{c.title}</span>
                  {/* 列宽拖动：仅作用于自己这一列。10px 热区 + Pointer Capture + clamp */}
                  <span
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize touch-none after:absolute after:inset-y-0.5 after:right-1 after:w-px after:bg-transparent after:transition-colors hover:after:bg-accent/60 group-hover:after:bg-rule"
                    onPointerDown={(e) => startResize(e, c.key)}
                    onDoubleClick={() => autoFit(c.key)}
                    title="拖拽调整本列宽；双击自适应；Ctrl+←/→ 微调"
                    aria-hidden="true"
                  />
                  {draggedCol && draggedCol !== c.key && dropLine && (
                    <span
                      className={cn(
                        'pointer-events-none absolute inset-y-1 z-10 w-0.5 rounded-full bg-accent',
                        dropLine === 'before' ? 'left-0' : 'right-0',
                      )}
                    />
                  )}
                </TH>
                )
              })}
            </TR>
          </THead>
          <TBody>
            {rows.map((row, i) => {
              const key = rowKey(row)
              const expanded = expandedKeys?.has(key) ?? false
              const dropLine = rowDropPos?.i === i ? rowDropPos.pos : null
              return (
                <Fragment key={key}>
                  <TR
                    draggable={false}
                    className={cn('hover:bg-hover', dragFrom === i && 'opacity-40', dropLine && 'bg-accent-soft/40')}
                    style={dropLine ? { boxShadow: dropLine === 'before' ? 'inset 0 2px 0 0 var(--accent,#6366f1)' : 'inset 0 -2px 0 0 var(--accent,#6366f1)' } : undefined}
                    onClick={onRowClick ? () => onRowClick(row, i) : onToggleExpand ? () => onToggleExpand(key) : undefined}
                    onDoubleClick={onRowDoubleClick ? (e) => {
                      // 双击按钮/输入控件不触发行双击（避免双击名称跳转或误触操作列）
                      if ((e.target as HTMLElement).closest('button, a, input, select')) return
                      onRowDoubleClick(row, i, e)
                    } : undefined}
                  >
                    {onToggleExpand && (
                      <TD data-col="__expand__" className="px-0 text-center align-middle">
                        {expanded ? <ChevronDown className="size-3.5 text-faint" /> : <ChevronRight className="size-3.5 text-faint" />}
                      </TD>
                    )}
                    {onReorder && (
                      <TD data-col="__drag__" className="px-0 text-center align-middle">
                        <button
                          type="button"
                          draggable
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onDragStart={(e) => onRowDragStart(e, i)}
                          onDragOver={(e) => onRowDragOver(e, i)}
                          onDragLeave={() => setRowDropPos((d) => (d?.i === i ? null : d))}
                          onDrop={(e) => onRowDrop(e, i)}
                          className="inline-flex cursor-grab items-center justify-center rounded p-1 text-faint hover:bg-hover hover:text-accent"
                          title="按住拖动排序"
                        ><GripVertical className="size-3.5" /></button>
                      </TD>
                    )}
                    {renderRow ? (
                      <td colSpan={fixedCols.length + visible.length} className="p-0">
                        {renderRow(row, i)}
                      </td>
                    ) : (
                      visible.map((c) => (
                        <TD key={c.key} data-col={c.key} className={cn('overflow-hidden text-ellipsis whitespace-nowrap', c.align === 'right' && 'text-right', c.className)}>
                          {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                        </TD>
                      ))
                    )}
                  </TR>
                  {expanded && renderExpanded && (
                    <TR className="bg-surface-subtle/40 align-top">
                      <td colSpan={fixedCols.length + visible.length}>{renderExpanded(row)}</td>
                    </TR>
                  )}
                </Fragment>
              )
            })}
          </TBody>
        </table>
        {!rows.length && empty}
      </div>
    </div>
  )
}