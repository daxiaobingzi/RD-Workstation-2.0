import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { Product } from '../types/domain'

/**
 * 设备类型编码（device_code）：
 * 格式 = {系统简写}-{分类拼音首字母}-{三位序号}，如 VSS-QD-001、PDS-GCXL-004。
 * 规则：
 *  - 系统简写取 systems.code（sys_vss→VSS）；未归属/未配置的系统（__other 等）统一用 GEN。
 *  - 分类拼音首字母：前端 QD / 后端 HD / 管材线缆 GCXL / 辅材 FC / 网络设备 WL（备用）/ 其他 QT。
 *  - 序号按「系统+分类」组内自增（取现有最大序号 +1）；删除设备不回收序号，保证编码永不与现存设备重复。
 *  - 设备迁移系统/分类时自动重算为新组下一序号（归属变了编码跟着变）。
 */
export const DEVICE_CODE_PINYIN: Record<string, string> = {
  front: 'QD', // 前端设备
  back: 'HD', // 后端设备
  cable: 'GCXL', // 管材线缆
  aux: 'FC', // 辅材
  net: 'WL', // 网络设备（备用映射）
  __other: 'QT', // 其他
  other: 'QT',
}

/** 未归属/未配置系统（含 __other 通用设备）的兜底简写 */
export const DEVICE_CODE_FALLBACK_ABBR = 'GEN'

const pad = (n: number) => String(Math.max(1, n)).padStart(3, '0')

/** 系统简写：优先设备中心自定义系统（device_systems.code），其次标准系统（systems.code），最后 GEN */
function systemAbbr(systemId?: string): string {
  if (!systemId) return DEVICE_CODE_FALLBACK_ABBR
  const ds = repository.getById<{ code?: string }>(T.device_systems, systemId)
  if (ds?.code) return ds.code.toUpperCase()
  const sys = repository.getById<{ code?: string }>(T.systems, systemId)
  if (sys?.code) return sys.code.toUpperCase()
  return DEVICE_CODE_FALLBACK_ABBR
}

/** 分类拼音首字母；未知分类回退 QT */
function categoryPinyin(category?: string): string {
  return DEVICE_CODE_PINYIN[category ?? ''] ?? DEVICE_CODE_PINYIN.__other
}

/** 解析已分配编码的后三位序号（编码格式不符时返回 0） */
function seqFromCode(code?: string): number {
  if (!code) return 0
  const m = /-(\d{3,})$/.exec(code)
  return m ? Number(m[1]) : 0
}

/** 该「系统+分类」组的现有最大序号（只统计已按本规则编码的产品） */
function maxSeq(systemId?: string, category?: string): number {
  const abbr = systemAbbr(systemId)
  const py = categoryPinyin(category)
  const prefix = `${abbr}-${py}-`
  let max = 0
  for (const p of repository.getTable<Product>(T.products)) {
    if (p.device_code?.startsWith(prefix)) {
      const n = seqFromCode(p.device_code)
      if (n > max) max = n
    }
  }
  return max
}

/** 依据归属（系统+分类）构建下一可用编码（不复用空号） */
function buildNextCode(systemId?: string, category?: string): string {
  return `${systemAbbr(systemId)}-${categoryPinyin(category)}-${pad(maxSeq(systemId, category) + 1)}`
}

/** 为单个设备类型构建并落库编码（已有合法编码则跳过；返回最终编码） */
function assignCode(product: Product | string): string {
  const existing = typeof product === 'string' ? repository.getById<Product>(T.products, product) : product
  if (!existing) return ''
  if (existing.device_code) return existing.device_code
  const code = buildNextCode(existing.system_id, existing.category)
  repository.update(T.products, existing.id, { device_code: code })
  return code
}

/** 存量补齐：为所有缺编码的设备类型幂等生成编码；返回本次补齐数量 */
function ensureDeviceCodes(): number {
  let count = 0
  for (const p of repository.getTable<Product>(T.products)) {
    if (!p.device_code) {
      assignCode(p)
      count += 1
    }
  }
  return count
}

/** 迁移重算：设备类型改了系统/分类后，编码按新归属重算（归属未变则保持原编码） */
function reassignCode(productId: string): string {
  const p = repository.getById<Product>(T.products, productId)
  if (!p) return ''
  const expect = `${systemAbbr(p.system_id)}-${categoryPinyin(p.category)}-`
  if (p.device_code?.startsWith(expect)) return p.device_code
  const code = buildNextCode(p.system_id, p.category)
  repository.update(T.products, productId, { device_code: code })
  return code
}

/** 依据当前归属重建所有编码（供 seed/恢复后整体重建，正常不启用） */
function rebuildAllCodes(): number {
  let count = 0
  for (const p of repository.getTable<Product>(T.products)) {
    const c = buildNextCode(p.system_id, p.category)
    if (c !== p.device_code) {
      repository.update(T.products, p.id, { device_code: c })
      count += 1
    }
  }
  return count
}

/** 系统简写变更后重算该系统全部设备编码：保留原序号，仅替换前缀；无原码的按组内下一序号补齐 */
function remapSystemCodes(systemId: string): number {
  const sys = repository.getById<{ code?: string }>(T.device_systems, systemId)
  const abbr = (sys?.code || DEVICE_CODE_FALLBACK_ABBR).toUpperCase()
  const used = new Map<string, number>()
  const list = repository.getTable<Product>(T.products).filter((p) => (p.system_id ?? '__other') === systemId)
  let changed = 0
  // 第一遍：已有编码 → 保留序号换前缀
  for (const p of list) {
    if (!p.device_code) continue
    const seq = seqFromCode(p.device_code)
    const py = categoryPinyin(p.category)
    const code = `${abbr}-${py}-${pad(seq)}`
    if (code !== p.device_code) {
      repository.update(T.products, p.id, { device_code: code })
      changed += 1
    }
    if (seq > (used.get(py) ?? 0)) used.set(py, seq)
  }
  // 第二遍：无编码设备 → 组内下一序号
  for (const p of list) {
    if (p.device_code) continue
    const py = categoryPinyin(p.category)
    const seq = (used.get(py) ?? 0) + 1
    used.set(py, seq)
    repository.update(T.products, p.id, { device_code: `${abbr}-${py}-${pad(seq)}` })
    changed += 1
  }
  return changed
}

export const DeviceCode = {
  systemAbbr,
  categoryPinyin,
  buildNextCode,
  assignCode,
  ensureDeviceCodes,
  reassignCode,
  rebuildAllCodes,
  remapSystemCodes,
}