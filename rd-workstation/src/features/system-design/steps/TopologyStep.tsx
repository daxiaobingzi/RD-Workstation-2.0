import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Plus, Trash2, Download, Pencil, Check } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import type { TopologyNode } from '../../../types/domain'
import { TopologyService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Select } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'
import { fmtNum } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'
import type { DesignService } from '../../../services'

const NODE_W = 132
const NODE_H = 54

/** 节点分层配色 */
const KIND_COLOR: Record<string, string> = {
  camera: '#2F5AF7', poe_switch: '#0EA5BE', aggregation: '#7A5AF7',
  nvr: '#16A34A', hdd: '#E08E0B', cable: '#8AA1B8', conduit: '#8AA1B8',
  aux: '#8AA1B8', mount: '#8AA1B8', other_material: '#8AA1B8',
}

/**
 * 系统拓扑图（P6）：可编辑系统结构图 —— HTML 节点绝对定位 + SVG 连线覆盖层。
 * 节点可拖拽移动 / 重命名 / 增删；连线可增删；可导出 PNG 作为设计交付图纸。
 */
export function TopologyStep({ psId, results }: { psId: string; results: ReturnType<typeof DesignService.results> }) {
  useDB((s) => s.db)
  const nodes = TopologyService.nodes(psId)
  const edges = TopologyService.edges(psId)
  const stageRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [edgeOpen, setEdgeOpen] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')

  // 无节点且有推导结果 → 自动生成
  useEffect(() => {
    if (!nodes.length && results.length) TopologyService.rebuildFromResults(psId, results)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psId, nodes.length])

  const onDrag = (id: string, clientX: number, clientY: number) => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const x = Math.min(Math.max(0, clientX - rect.left - NODE_W / 2), rect.width - NODE_W)
    const y = Math.min(Math.max(0, clientY - rect.top - NODE_H / 2), rect.height - NODE_H)
    TopologyService.updateNode(id, { x, y })
  }

  const edgeEndpoints = edges.flatMap((e) => [e.from_kind, e.to_kind])
  const lineKinds = new Set(edgeEndpoints)
  const width = Math.max(720, ...nodes.map((n) => (n.x ?? 0) + NODE_W + 40))
  const height = Math.max(360, ...nodes.map((n) => (n.y ?? 0) + NODE_H + 40))

  const exportPng = async () => {
    const svg = document.createElement('svg')
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    for (const e of edges) {
      const f = nodes.find((n) => n.kind === e.from_kind)
      const t = nodes.find((n) => n.kind === e.to_kind)
      if (!f || !t) continue
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      const x1 = (f.x ?? 0) + NODE_W
      const y1 = (f.y ?? 0) + NODE_H / 2
      const x2 = t.x ?? 0
      const y2 = (t.y ?? 0) + NODE_H / 2
      const mx = (x1 + x2) / 2
      path.setAttribute('d', `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`)
      path.setAttribute('stroke', '#94A3B8')
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke-width', '1.5')
      svg.appendChild(path)
    }
    nodes.forEach((n) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', String(n.x ?? 0)); rect.setAttribute('y', String(n.y ?? 0))
      rect.setAttribute('width', String(NODE_W)); rect.setAttribute('height', String(NODE_H))
      rect.setAttribute('rx', '8'); rect.setAttribute('fill', '#ffffff'); rect.setAttribute('stroke', n.color ?? '#94A3B8')
      g.appendChild(rect)
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      txt.setAttribute('x', String((n.x ?? 0) + NODE_W / 2)); txt.setAttribute('y', String((n.y ?? 0) + NODE_H / 2 - 4))
      txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('font-size', '12'); txt.setAttribute('fill', '#334155')
      txt.textContent = n.label
      const qty = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      qty.setAttribute('x', String((n.x ?? 0) + NODE_W / 2)); qty.setAttribute('y', String((n.y ?? 0) + NODE_H / 2 + 14))
      qty.setAttribute('text-anchor', 'middle'); qty.setAttribute('font-size', '13'); qty.setAttribute('font-weight', 'bold'); qty.setAttribute('fill', '#0F172A')
      qty.textContent = String(fmtNum(n.quantity ?? 0))
      g.appendChild(txt); g.appendChild(qty)
      svg.appendChild(g)
    })
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')
      if (ctx) { ctx.scale(2, 2); ctx.drawImage(img, 0, 0) }
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `系统拓扑-${psId}.png`
      a.click()
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  return (
    <StepCard
      title="系统拓扑（结构图）"
      desc="组网关系图：前端点位 → 接入 → 汇聚 → 存储。拖拽节点调整布局，可增删节点与连线，可导出 PNG 图纸"
      extra={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="outline" onClick={() => { TopologyService.rebuildFromResults(psId, results); toast('已按推导重建拓扑') }}><RefreshCw className="size-3" />按推导重建</Button>
          <Button size="xs" variant="outline" onClick={() => setAddOpen(true)}><Plus className="size-3" />加节点</Button>
          <Button size="xs" variant="outline" onClick={() => setEdgeOpen(true)}><Plus className="size-3" />加连线</Button>
          <Button size="xs" variant="outline" onClick={exportPng}><Download className="size-3" />导出 PNG</Button>
        </div>
      }
    >
      {nodes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-rule py-10 text-center">
          <p className="text-[12.5px] text-faint">暂无拓扑节点。先执行「推导」自动生成，或手动添加节点。</p>
          <div className="flex gap-2">
            {results.length > 0 && <Button size="sm" onClick={() => { TopologyService.rebuildFromResults(psId, results); toast('已按推导生成拓扑') }}>按推导生成</Button>}
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><Plus className="size-3" />手动添加</Button>
          </div>
        </div>
      ) : (
        <div
          ref={stageRef}
          className="relative overflow-auto rounded-md border border-rule bg-surface-subtle/30"
          style={{ width: 792, height: 420, minWidth: 720 }}
          onPointerMove={(e) => { if (dragging) onDrag(dragging, e.clientX, e.clientY) }}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
        >
          {/* SVG 连线覆盖层 */}
          <svg width={width} height={height} className="pointer-events-none absolute inset-0">
            {edges.map((e, i) => {
              const from = nodes.find((n) => n.kind === e.from_kind)
              const to = nodes.find((n) => n.kind === e.to_kind)
              if (!from || !to) return null
              const x1 = (from.x ?? 0) + NODE_W
              const y1 = (from.y ?? 0) + NODE_H / 2
              const x2 = to.x ?? 0
              const y2 = (to.y ?? 0) + NODE_H / 2
              const mx = (x1 + x2) / 2
              const my = (y1 + y2) / 2
              return (
                <g key={i}>
                  <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none" stroke="#94A3B8" strokeWidth="1.5" />
                  <circle cx={x2} cy={y2} r="3" fill="#CBD5E1" />
                  <g
                    className="pointer-events-auto cursor-pointer"
                    opacity="0"
                    onMouseEnter={(ev) => { ev.currentTarget.style.opacity = '1' }}
                    onMouseLeave={(ev) => { ev.currentTarget.style.opacity = '0' }}
                    onClick={() => { TopologyService.removeEdge(psId, e.from_kind, e.to_kind); toast('连线已删除', 'info') }}
                  >
                    <circle cx={mx} cy={my} r="9" fill="#FEE2E2" stroke="#FCA5A5" />
                    <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="11" fill="#DC2626">×</text>
                  </g>
                </g>
              )
            })}
          </svg>

          {/* 节点（绝对定位） */}
          {nodes.map((n) => (
            <div
              key={n.id}
              className="group absolute flex cursor-move flex-col items-center justify-center rounded-lg border bg-surface shadow-sm transition-shadow hover:shadow-md"
              style={{ left: n.x ?? 0, top: n.y ?? 0, width: NODE_W, height: NODE_H, borderColor: n.color ?? '#94A3B8' }}
              onPointerDown={(e) => {
                e.preventDefault()
                setDragging(n.id)
              }}
              draggable={false}
            >
              {renaming === n.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={() => { if (renameVal.trim()) TopologyService.updateNode(n.id, { label: renameVal.trim() }); setRenaming(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { if (renameVal.trim()) TopologyService.updateNode(n.id, { label: renameVal.trim() }); setRenaming(null) } if (e.key === 'Escape') setRenaming(null) }}
                    className="w-24 rounded border border-rule bg-white px-1 text-center text-[11px]"
                  />
                  <Check className="size-3 text-ok" />
                </div>
              ) : (
                <>
                  <span
                    className="max-w-[110px] truncate px-1 text-[11.5px] font-semibold"
                    style={{ color: n.color ?? '#334155' }}
                    onDoubleClick={() => { setRenaming(n.id); setRenameVal(n.label) }}
                    title="双击重命名"
                  >
                    {n.label}
                  </span>
                  <span className="font-mono text-[13px] font-bold text-ink">{fmtNum(n.quantity ?? 0)}</span>
                </>
              )}
              <button
                type="button"
                className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="删除节点"
                onClick={() => { TopologyService.removeNode(psId, n.id); toast('节点已删除', 'info') }}
              >
                <Trash2 className="size-2.5" />
              </button>
              <Pencil className="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-accent p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-faint">
        <span>拖拽节点调整位置 · 双击节点重命名 · 悬停连线点 × 删除</span>
        {nodes.map((n) => (
          <span key={n.id} className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full" style={{ background: n.color }} />
            {n.label}: {fmtNum(n.quantity ?? 0)}
          </span>
        ))}
      </div>

      {addOpen && <AddNodeModal psId={psId} onClose={() => setAddOpen(false)} results={results} />}
      {edgeOpen && <AddEdgeModal psId={psId} nodes={nodes} onClose={() => setEdgeOpen(false)} />}
      <span className="hidden">{lineKinds.size}</span>
    </StepCard>
  )
}

/* ---------- 添加节点 ---------- */
function AddNodeModal({ psId, onClose, results }: { psId: string; onClose: () => void; results: ReturnType<typeof DesignService.results> }) {
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState(0)
  const existingKinds = new Set(TopologyService.nodes(psId).map((n) => n.kind))
  const derivedTypes = [...new Set(results.map((r) => r.result_type))].filter((k) => !existingKinds.has(k) && k !== 'camera')
  const add = (lbl: string, q: number, kind?: string) => {
    TopologyService.addNode(psId, {
      kind: kind || `manual_${Date.now()}`,
      label: lbl,
      quantity: q,
      color: kind ? (KIND_COLOR[kind] ?? '#64748B') : '#64748B',
    })
    toast('节点已添加')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="添加拓扑节点" width={440}>
      <div className="space-y-2.5">
        <div className="flex gap-2">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="节点名称" className="h-7 flex-1 text-[12px]" autoFocus />
          <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} placeholder="数量" className="h-7 w-20 text-[12px]" />
        </div>
        {derivedTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] text-faint">从推导结果添加：</span>
            {derivedTypes.map((k) => (
              <button key={k} type="button" className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11.5px] text-accent hover:bg-accent-soft" onClick={() => { const r = results.find((x) => x.result_type === k); add((r?.rule_snapshot ?? k).replace('定额-', ''), r?.quantity ?? 0, k) }}>
                {k}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button size="xs" variant="outline" onClick={onClose}>取消</Button>
          <Button size="xs" onClick={() => { if (!label.trim()) { toast('请填写节点名称', 'warn'); return } add(label.trim(), qty) }}>添加</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- 添加连线 ---------- */
function AddEdgeModal({ psId, nodes, onClose }: { psId: string; nodes: TopologyNode[]; onClose: () => void }) {
  const [from, setFrom] = useState(nodes[0]?.kind ?? '')
  const [to, setTo] = useState(nodes[1]?.kind ?? '')
  return (
    <Modal open onClose={onClose} title="添加连线（上游 → 下游）" width={440}>
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Select value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 flex-1 text-[12px]">
            <option value="">上游…</option>
            {nodes.map((n) => <option key={n.id} value={n.kind}>{n.label}</option>)}
          </Select>
          <span className="text-faint">→</span>
          <Select value={to} onChange={(e) => setTo(e.target.value)} className="h-7 flex-1 text-[12px]">
            <option value="">下游…</option>
            {nodes.map((n) => <option key={n.id} value={n.kind}>{n.label}</option>)}
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="xs" variant="outline" onClick={onClose}>取消</Button>
          <Button size="xs" onClick={() => { if (!from || !to) { toast('请选择上下游节点', 'warn'); return } TopologyService.addEdge(psId, from, to); onClose(); toast('连线已添加') }}>添加</Button>
        </div>
      </div>
    </Modal>
  )
}