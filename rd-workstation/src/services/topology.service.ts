import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { DesignResult, TopologyNode, TopologyEdge } from '../types/domain'
import { uid } from '../lib/utils'

function nowIso() {
  return new Date().toISOString()
}

/** 拓扑节点自动布局：纵向分层（每层横向排列，间距固定） */
export const TOPO_LAYERS = [
  { kinds: ['camera'], label: '前端点位', color: '#3B82F6' },
  { kinds: ['poe_switch', 'aux'], label: '接入', color: '#0EA5E9' },
  { kinds: ['aggregation', 'conduit'], label: '汇聚', color: '#8B5CF6' },
  { kinds: ['nvr', 'hdd', 'cable'], label: '存储', color: '#16A34A' },
]

const NODE_LABEL: Record<string, string> = {
  camera: '摄像机', poe_switch: 'POE 交换机', aggregation: '汇聚交换机', nvr: 'NVR',
  hdd: '硬盘', cable: '线缆', conduit: '管材', aux: '辅材', other_material: '其他材料', mount: '支架',
}

/** 默认连线：推导结果类型间的上下游关系（可被用户编辑增删） */
const DEFAULT_EDGES: [string, string][] = [
  ['camera', 'poe_switch'],
  ['poe_switch', 'aggregation'],
  ['aggregation', 'nvr'],
  ['nvr', 'hdd'],
]

/** 系统拓扑 Service（P6）：节点/连线 CRUD + 从推导结果自动生成 */
export const TopologyService = {
  nodes(psId: string): TopologyNode[] {
    return repository.where<TopologyNode>(T.topology_nodes, (r) => r.project_system_id === psId)
  },
  edges(psId: string): TopologyEdge[] {
    return repository.where<TopologyEdge>(T.topology_edges, (r) => r.project_system_id === psId)
  },

  /** 从推导结果重建拓扑（节点=结果类型，连线=默认关系）。已存在手动节点则保留坐标 */
  rebuildFromResults(psId: string, results: DesignResult[]) {
    const existing = this.nodes(psId)
    const manual = existing.filter((n) => !n.auto)
    const nodes: TopologyNode[] = []
    const seen = new Set<string>()
    const now = nowIso()
    const xSpacing = 150
    let layerIdx = -1
    const kindsInLayer = new Map<string, number>()
    for (const [, layer] of TOPO_LAYERS.entries()) {
      const present = layer.kinds.filter((k) => results.some((r) => r.result_type === k))
      if (!present.length) continue
      layerIdx += 1
      kindsInLayer.set(layer.label, present.length)
      let x = 40
      for (const kind of present) {
        if (seen.has(kind)) continue
        seen.add(kind)
        const result = results.find((r) => r.result_type === kind)
        const keep = existing.find((n) => n.kind === kind && !n.auto)
        nodes.push({
          id: keep?.id ?? uid('tn'),
          project_system_id: psId,
          kind,
          label: NODE_LABEL[kind] ?? kind,
          quantity: result?.quantity ?? 0,
          x: keep?.x ?? x,
          y: keep?.y ?? 40 + layerIdx * 150,
          auto: !keep,
          color: layer.color,
          created_at: keep?.created_at ?? now,
        })
        x += xSpacing + (present.length > 1 ? 60 : 0)
      }
    }
    // 手动节点若与自动结果无重复 kind，保留（不删除用户自定义）
    for (const m of manual) {
      if (!seen.has(m.kind)) nodes.push(m)
    }
    repository.replace(T.topology_nodes, nodes)

    // 连线：仅当前存在的 kind 间连线
    const kinds = new Set(nodes.map((n) => n.kind))
    const edges: TopologyEdge[] = DEFAULT_EDGES
      .filter(([f, t]) => kinds.has(f) && kinds.has(t))
      .map(([f, t]) => ({
        id: uid('te'),
        project_system_id: psId,
        from_kind: f,
        to_kind: t,
        label: '',
      }))
    repository.replace(T.topology_edges, edges)
    return { nodes, edges }
  },

  syncFromResults(psId: string, results: DesignResult[]) {
    // 重新推导后同步数量（保留用户手动添加的节点）
    for (const n of this.nodes(psId)) {
      const r = results.find((x) => x.result_type === n.kind)
      if (r && r.quantity !== n.quantity) repository.update(T.topology_nodes, n.id, { quantity: r.quantity })
    }
  },

  addNode(psId: string, node: Partial<TopologyNode>): TopologyNode {
    const n: TopologyNode = {
      id: uid('tn'),
      project_system_id: psId,
      kind: node.kind || 'other_material',
      label: node.label || '节点',
      quantity: node.quantity ?? 0,
      x: node.x ?? 40,
      y: node.y ?? 40,
      auto: node.auto ?? false,
      color: node.color ?? '#6B7280',
      created_at: nowIso(),
    }
    repository.insert(T.topology_nodes, n)
    return n
  },

  updateNode(id: string, patch: Partial<TopologyNode>) {
    repository.update(T.topology_nodes, id, { ...patch, updated_at: nowIso() })
  },

  removeNode(psId: string, id: string) {
    const node = repository.getById<TopologyNode>(T.topology_nodes, id)
    if (!node) return
    repository.remove(T.topology_nodes, id)
    // 清理相关连线
    const edges = this.edges(psId).filter((e) => e.from_kind === node.kind || e.to_kind === node.kind)
    edges.forEach((e) => repository.remove(T.topology_edges, e.id))
  },

  addEdge(psId: string, fromKind: string, toKind: string, label?: string) {
    const exists = this.edges(psId).some((e) => e.from_kind === fromKind && e.to_kind === toKind)
    if (exists) return
    repository.insert(T.topology_edges, {
      id: uid('te'), project_system_id: psId, from_kind: fromKind, to_kind: toKind, label,
    } as unknown as TopologyEdge)
  },

  removeEdge(psId: string, fromKind: string, toKind: string) {
    const edges = this.edges(psId).filter((e) => e.from_kind === fromKind && e.to_kind === toKind)
    edges.forEach((e) => repository.remove(T.topology_edges, e.id))
  },
}