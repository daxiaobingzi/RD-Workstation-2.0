import type { BillItem, BillVersion, DesignResult, DeviceSelection, ProductModel, DeviceMaterial } from '../types/domain'
import { T } from '../types/domain'
import { uid } from '../lib/utils'
import type { EngineCtx } from './ctx'
import { PricingEngine } from './pricing.engine'

/* ================= BillEngine：清单（版本化） ================= */
const BILL_MATERIAL_CATEGORY: Record<string, string> = {
  cable: '线缆', conduit: '管材', aux: '辅材', other_material: '其他材料',
}

/** 引擎内纯文本化：去 HTML 标签 → 压缩空白 → 截断（engine 层不依赖 UI 组件） */
function htmlToPlain(html?: string, max = 100): string | undefined {
  if (!html) return undefined
  const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return undefined
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export const BillEngine = {
  /** 单系统生成（兼容旧调用：工作区曾用；现为项目级 generateProject 的封装） */
  generate(ctx: EngineCtx, psId: string, projectId: string): { version: BillVersion; items: BillItem[] } {
    return this.generateProject(ctx, projectId, [psId])
  },

  /**
   * 项目级清单生成（预算页「确认生成清单」）：
   * 一次生成包含所有子系统选型 + 定额材料行的汇总版本；版本号 V{n+1}、状态 draft；
   * 增量基线沿用上一版本手工调整/自定义行/未再生成行。
   */
  generateProject(ctx: EngineCtx, projectId: string, psIds?: string[]): { version: BillVersion; items: BillItem[] } {
    const now = new Date().toISOString()
    const versions = ctx.get<BillVersion>(T.bill_versions).filter((v) => v.project_id === projectId)
    // 版本号顺延：取现存最大编号 +1（删除中间版本不改变其它版本号，也不会产生重复号）
    const maxNo = versions.reduce((m, v) => Math.max(m, Number(String(v.version_no ?? 'V0').replace(/\D/g, '')) || 0), 0)
    const versionNo = `V${maxNo + 1}`
    const version: BillVersion = {
      id: uid('bv'), project_id: projectId, version_no: versionNo, name: `清单 ${versionNo}`,
      source: 'engine', status: 'draft', created_at: now, updated_at: now,
    }
    // 项目所有子系统（未显式传 psIds 时）
    const allPsIds = psIds ?? ctx.get<{ id: string; project_id: string }>(T.project_systems)
      .filter((p) => p.project_id === projectId).map((p) => p.id)

    const models = ctx.get<ProductModel>(T.product_models)
    const familyName = new Map(ctx.get<{ id: string; name: string }>(T.product_families).map((f) => [f.id, f.name]))
    const productOfModel = new Map(ctx.get<{ id: string; product_family_id: string; name: string }>(T.products).map((p) => [p.id, p]))

    // 增量基线：取上一版本（最近创建）的清单行，供"保留手工调整 / 延续自定义行"
    const prevVersion = [...versions].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
    const prevItems: BillItem[] = prevVersion ? ctx.get<BillItem>(T.bill_items).filter((i) => i.bill_version_id === prevVersion.id) : []
    const prevByModel = new Map<string, BillItem>(prevItems.filter((i) => i.source_type !== 'quota' && i.device_model_id).map((i) => [i.device_model_id as string, i]))
    const prevBySource = new Map<string, BillItem>(prevItems.filter((i) => i.source_type === 'quota' && i.source_id).map((i) => [i.source_id as string, i]))
    const prevManualRows: BillItem[] = prevItems.filter((i) => i.source_type === 'manual')
    /** 手工调整过的行：沿用上一版本用户改动的数量/单价，并延续标记 */
    const adoptTuned = (modelId: string | undefined, sourceId: string | undefined): BillItem | undefined => {
      let prev: BillItem | undefined
      if (modelId) prev = prevByModel.get(modelId)
      if (!prev && sourceId) prev = prevBySource.get(sourceId)
      return prev?.manually_tuned ? prev : undefined
    }

    // 材料均价兜底：按产品类别（cable/aux 材料类）而非写死家族 id
    const productCategory = new Map(ctx.get<{ id: string; category?: string }>(T.products).map((p) => [p.id, p.category]))
    const materialModels = models.filter((m) => {
      const cat = m.product_id ? productCategory.get(m.product_id) : undefined
      return cat === 'cable' || cat === 'aux'
    })
    const avgPrice = materialModels.length
      ? materialModels.reduce((s, m) => s + PricingEngine.getPrice(ctx, m.id), 0) / materialModels.length
      : 0

    const allSelections = ctx.get<DeviceSelection>(T.device_selections)
    const allResults = ctx.get<DesignResult>(T.design_results)
    const quotaMats = ctx.get<DeviceMaterial>(T.device_materials)

    let sort = 0
    const items: BillItem[] = []
    for (const psId of allPsIds) {
      // 选型设备行
      for (const s of allSelections.filter((x) => x.project_system_id === psId)) {
        const model = models.find((m) => m.id === s.model_id)
        const famId = model ? productOfModel.get(model.product_id)?.product_family_id : undefined
        const tuned = adoptTuned(model ? model.id : undefined, undefined)
        sort += 1
        items.push({
          id: uid('bi'),
          bill_version_id: version.id,
          project_system_id: psId,
          device_model_id: s.model_id,
          item_code: `BI-${String(sort).padStart(3, '0')}`,
          item_name: model ? model.model : s.model_id,
          specification: model ? htmlToPlain(model.detail_html, 100) : undefined,
          unit: s.unit,
          quantity: tuned?.quantity ?? s.quantity,
          unit_price: tuned?.unit_price ?? s.unit_price,
          amount: (tuned?.quantity ?? s.quantity) * (tuned?.unit_price ?? s.unit_price),
          category: famId ? (familyName.get(famId) ?? s.remark ?? '推导设备') : (s.remark ?? '推导设备'),
          source_type: 'selection',
          source_id: s.id,
          manually_tuned: tuned?.manually_tuned,
          sort_order: sort,
        })
      }

      // 材料类推导结果（定额材料）作为清单材料行
      const materialResults = allResults.filter((r) => r.project_system_id === psId && sourceTypeIsMaterial(r.source_type))
      for (const r of materialResults) {
        const name = (r.rule_snapshot ?? '').replace('定额-', '') || '材料'
        const mat = quotaMats.find((m) => m.enabled !== false && m.name === name)
        const matPrice = mat?.price != null ? mat.price : avgPrice
        const tuned = adoptTuned(undefined, r.id)
        const qty = tuned?.quantity ?? r.quantity
        const price = tuned?.unit_price ?? matPrice
        sort += 1
        items.push({
          id: uid('bi'),
          bill_version_id: version.id,
          project_system_id: psId,
          device_model_id: undefined,
          item_code: `BI-${String(sort).padStart(3, '0')}`,
          item_name: name,
          specification: mat ? [mat.brand, mat.model, mat.params].filter(Boolean).join(' ') || r.formula_snapshot : r.formula_snapshot,
          unit: r.unit ?? '项',
          quantity: qty,
          unit_price: price,
          amount: Math.round(price * qty * 100) / 100,
          category: BILL_MATERIAL_CATEGORY[r.result_type] ?? '材料',
          source_type: 'quota',
          source_id: r.id,
          manually_tuned: tuned?.manually_tuned,
          sort_order: sort,
        })
      }
    }

    // 延续上一版本的手工自定义行（source_type = manual）
    for (const m of prevManualRows) {
      sort += 1
      items.push({
        ...m,
        id: uid('bi'),
        bill_version_id: version.id,
        item_code: `BI-${String(sort).padStart(3, '0')}`,
        sort_order: sort,
      })
    }

    // 延续上一版本引擎行（selection/quota）中本次未再生成的部分
    const existingKeys = new Set(items.map((i) => (i.source_type === 'quota' && i.source_id)
      ? `quota:${i.source_id}`
      : (i.device_model_id ? `model:${i.device_model_id}` : `name:${i.item_name}`)))
    for (const p of prevItems) {
      if (p.source_type === 'manual') continue
      const pKey = (p.source_type === 'quota' && p.source_id)
        ? `quota:${p.source_id}`
        : (p.device_model_id ? `model:${p.device_model_id}` : `name:${p.item_name}`)
      if (existingKeys.has(pKey)) continue
      existingKeys.add(pKey)
      sort += 1
      items.push({
        ...p,
        id: uid('bi'),
        bill_version_id: version.id,
        item_code: `BI-${String(sort).padStart(3, '0')}`,
        sort_order: sort,
      })
    }
    return { version, items }
  },
}

function sourceTypeIsMaterial(sourceType?: string): boolean {
  return sourceType === 'quota'
}