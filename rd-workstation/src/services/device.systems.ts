import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { DeviceSystem, Product, ProductModel, Brand } from '../types/domain'
import { uid } from '../lib/utils'
import { DeviceCode } from './device.code'

/** 设备中心系统管理：组织维度自定义（增删改 / 简写唯一 / 编码联动 / 删除引用保护） */
function nowIso() {
  return new Date().toISOString()
}

/** 系统简写合法性：1~6 位大写字母/数字（设备编码前缀） */
const CODE_RE = /^[A-Z0-9]{1,6}$/

function collectModelRefs(modelIds: Set<string>): { model: string; brand: string; projectNames: string[] }[] {
  const db = repository.db
  const modelName = new Map((db[T.product_models] ?? []).map((m) => [(m as ProductModel).id, (m as ProductModel).model]))
  const brandNameById = new Map((db[T.brands] ?? []).map((b) => [(b as Brand).id, (b as Brand).name]))
  const brandIdOfModel = new Map<string, string>()
  for (const mb of db[T.model_brands] ?? []) brandIdOfModel.set((mb as unknown as { model_id: string }).model_id, (mb as unknown as { brand_id: string }).brand_id)
  const psOf = new Map((db[T.project_systems] ?? []).map((s) => [s.id, s as unknown as { project_id: string }]))
  const projName = new Map((db[T.projects] ?? []).map((p) => [p.id, (p as unknown as { name: string }).name]))
  const used: { model: string; brand: string; projectNames: string[] }[] = []
  const sels = (db[T.device_selections] ?? []) as unknown as { model_id: string; project_system_id?: string }[]
  const bills = (db[T.bill_items] ?? []) as unknown as { device_model_id?: string }[]
  for (const mid of modelIds) {
    const selPs = sels.filter((s) => s.model_id === mid).map((s) => s.project_system_id)
    const billHit = bills.some((b) => b.device_model_id === mid)
    if (!selPs.length && !billHit) continue
    const projectNames = new Set<string>()
    for (const psId of selPs) {
      const ps = psOf.get(psId ?? '')
      if (ps) { const n = projName.get(ps.project_id); if (n) projectNames.add(n) }
    }
    used.push({
      model: modelName.get(mid) ?? '未知型号',
      brand: brandNameById.get(brandIdOfModel.get(mid) ?? '') ?? '',
      projectNames: [...projectNames],
    })
  }
  return used
}

export const DeviceSystemService = {
  /** 启动兜底：device_systems 表缺失/为空时从标准系统（systems）派生 + 通用设备 */
  ensureDeviceSystems(): number {
    const rows = repository.getTable<DeviceSystem>(T.device_systems)
    if (rows.length) return 0
    const derived: DeviceSystem[] = [
      ...((repository.db[T.systems] ?? []) as Array<{ id: string; code: string; name: string; category?: string; sort_order?: number; enabled?: boolean }>).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        group: s.category || '通用',
        sort_order: s.sort_order ?? 99,
        enabled: s.enabled !== false,
        created_at: nowIso(),
      })),
      { id: '__other', code: 'GEN', name: '通用设备', group: '通用', sort_order: 999, enabled: true, created_at: nowIso() },
    ]
    repository.insertMany(T.device_systems, derived)
    return derived.length
  },

  /** 系统列表（启用的在前，按 sort_order 排序） */
  systems(): DeviceSystem[] {
    return repository
      .getTable<DeviceSystem>(T.device_systems)
      .filter((s) => s.enabled !== false)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
  },

  systemById(id: string): DeviceSystem | undefined {
    return repository.getById<DeviceSystem>(T.device_systems, id)
  },

  /** 分组列表（保留出现顺序、去重） */
  groups(): string[] {
    const out: string[] = []
    for (const s of this.systems()) {
      if (s.group && !out.includes(s.group)) out.push(s.group)
    }
    return out
  },

  /** 分组重命名：该分组下全部系统一并更新 group 字段（系统简写不受影响） */
  renameGroup(from: string, to: string): { ok: boolean; reason?: string } {
    const n = (to || '').trim()
    if (!n) return { ok: false, reason: '请输入分组名称' }
    if (n === from) return { ok: false, reason: '分组名称未变化' }
    const others = this.groups().filter((g) => g !== from)
    if (others.includes(n)) return { ok: false, reason: `分组「${n}」已存在` }
    let moved = 0
    for (const s of this.systems()) {
      if (s.group === from) {
        repository.update(T.device_systems, s.id, { group: n, updated_at: nowIso() })
        moved += 1
      }
    }
    return { ok: true, reason: moved ? `已将分组「${from}」重命名为「${n}」（${moved} 个系统）` : '该分组下暂无系统' }
  },

  /** 简写校验：返回错误文案（合法返回空字符串） */
  validateCode(code: string, excludeId?: string): string {
    const c = (code || '').trim().toUpperCase()
    if (!c) return '请填写系统简写'
    if (!CODE_RE.test(c)) return '简写仅允许 1~6 位大写字母或数字'
    const dup = repository.getTable<DeviceSystem>(T.device_systems).find((s) => s.code === c && s.id !== excludeId)
    return dup ? `简写「${c}」已被系统「${dup.name}」使用，需唯一` : ''
  },

  /** 新增系统：校验名称/简写唯一 */
  add(data: { name: string; code: string; group: string }): { ok: boolean; reason?: string; system?: DeviceSystem } {
    const name = (data.name || '').trim()
    if (!name) return { ok: false, reason: '请填写系统名称' }
    const err = this.validateCode(data.code)
    if (err) return { ok: false, reason: err }
    const list = this.systems()
    const system: DeviceSystem = {
      id: uid('sys'),
      code: data.code.trim().toUpperCase(),
      name,
      group: (data.group || '').trim() || '通用',
      sort_order: list.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0) + 1,
      enabled: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    repository.insert(T.device_systems, system)
    return { ok: true, system }
  },

  /** 编辑系统：名称/分组直接改；简写变更时校验唯一并重算该系统全部设备编码（保留序号） */
  update(id: string, patch: Partial<Pick<DeviceSystem, 'name' | 'code' | 'group'>>): { ok: boolean; reason?: string } {
    const sys = repository.getById<DeviceSystem>(T.device_systems, id)
    if (!sys) return { ok: false, reason: '系统不存在' }
    if (patch.name != null && !patch.name.trim()) return { ok: false, reason: '请填写系统名称' }
    if (patch.code != null) {
      const err = this.validateCode(patch.code, id)
      if (err) return { ok: false, reason: err }
    }
    const next: Record<string, unknown> = {}
    if (patch.name != null) next.name = patch.name.trim()
    if (patch.group != null) next.group = (patch.group || '').trim() || '通用'
    if (patch.code != null) next.code = patch.code.trim().toUpperCase()
    if (Object.keys(next).length) {
      next.updated_at = nowIso()
      repository.update(T.device_systems, id, next)
      // 简写变更 → 重算该系统全部设备编码（前缀替换，序号保留）
      if (patch.code != null) DeviceCode.remapSystemCodes(id)
    }
    return { ok: true }
  },

  /** 删除系统：若型号已被项目选型/清单引用则阻止；否则级联删除该系统全部设备/类别/族 */
  remove(id: string): { ok: boolean; reason?: string; used?: { model: string; brand: string; projectNames: string[] }[] } {
    const sys = repository.getById<DeviceSystem>(T.device_systems, id)
    if (!sys) return { ok: false, reason: '系统不存在' }
    const db = repository.db
    const sysProductIds = new Set(
      (db[T.products] ?? []).filter((p) => ((p as Product).system_id ?? '__other') === id).map((p) => (p as Product).id),
    )
    const modelIds = new Set(
      (db[T.product_models] ?? []).filter((m) => sysProductIds.has((m as ProductModel).product_id)).map((m) => (m as ProductModel).id),
    )
    // 引用保护：型号被项目选型 / 清单引用 → 阻止
    const used = collectModelRefs(modelIds)
    if (used.length) {
      return { ok: false, reason: `「${sys.name}」下 ${used.length} 个型号已被项目引用，无法删除`, used }
    }
    // 级联删除
    repository.removeMany(T.device_materials, (r) => sysProductIds.has((r as unknown as { product_id: string }).product_id))
    repository.removeMany(T.product_models, (r) => sysProductIds.has((r as ProductModel).product_id))
    repository.removeMany(T.prices, (r) => modelIds.has((r as unknown as { model_id: string }).model_id))
    repository.removeMany(T.model_brands, (r) => modelIds.has((r as unknown as { model_id: string }).model_id))
    repository.removeMany(T.model_grade_bindings, (r) => modelIds.has((r as unknown as { model_id: string }).model_id))
    repository.removeMany(T.products, (r) => sysProductIds.has((r as Product).id))
    // 归属该系统且不再被引用的类别 / 产品族
    const catIds = new Set<string>()
    for (const c of db[T.device_categories] ?? []) {
      const row = c as unknown as { id: string; system_id?: string }
      if (row.system_id === id) catIds.add(row.id)
    }
    repository.removeMany(T.product_families, (r) => catIds.has((r as unknown as { device_category_id: string }).device_category_id))
    repository.removeMany(T.device_categories, (r) => catIds.has((r as unknown as { id: string }).id))
    repository.remove(T.device_systems, id)
    return { ok: true }
  },

  /** 设备中心页签数据源（含设备数）：读自定义系统表，label = 分组 · 名称 */
  deviceSystems(): { id: string; label: string; count: number }[] {
    const counts = new Map<string, number>()
    for (const p of repository.getTable<Product>(T.products)) {
      const sys = (p as Product).system_id ?? '__other'
      counts.set(sys, (counts.get(sys) ?? 0) + 1)
    }
    return this.systems().map((s) => ({ id: s.id, label: `${s.group} · ${s.name}`, count: counts.get(s.id) ?? 0 }))
  },
}