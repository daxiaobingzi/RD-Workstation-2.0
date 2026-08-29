import type { BillItem, BillVersion, DesignResult, DeviceSelection, ProductModel, DeviceMaterial } from '../types/domain'
import { T } from '../types/domain'
import { uid } from '../lib/utils'
import type { EngineCtx } from './ctx'
import { PricingEngine } from './pricing.engine'

/* ================= BillEngine：清单（版本化） ================= */
const BILL_MATERIAL_CATEGORY: Record<string, string> = {
  cable: '线缆', conduit: '管材', aux: '辅材', other_material: '其他材料',
}

export const BillEngine = {
  generate(ctx: EngineCtx, psId: string, projectId: string): { version: BillVersion; items: BillItem[] } {
    const now = new Date().toISOString()
    const versions = ctx.get<BillVersion>(T.bill_versions).filter((v) => v.project_id === projectId)
    const versionNo = `V${versions.length + 1}`
    const version: BillVersion = {
      id: uid('bv'), project_id: projectId, version_no: versionNo, name: `清单 ${versionNo}`,
      source: 'engine', status: 'draft', created_at: now, updated_at: now,
    }
    const models = ctx.get<ProductModel>(T.product_models)
    const familyName = new Map(ctx.get<{ id: string; name: string }>(T.product_families).map((f) => [f.id, f.name]))
    const productOfModel = new Map(ctx.get<{ id: string; product_family_id: string; name: string }>(T.products).map((p) => [p.id, p]))
    const items: BillItem[] = ctx
      .get<DeviceSelection>(T.device_selections)
      .filter((s) => s.project_system_id === psId)
      .map((s, i) => {
        const model = models.find((m) => m.id === s.model_id)
        const famId = model ? productOfModel.get(model.product_id)?.product_family_id : undefined
        return {
          id: uid('bi'),
          bill_version_id: version.id,
          project_system_id: psId,
          device_model_id: s.model_id,
          item_code: `BI-${String(i + 1).padStart(3, '0')}`,
          item_name: model ? model.model : s.model_id,
          specification: model?.specification,
          unit: s.unit,
          quantity: s.quantity,
          unit_price: s.unit_price,
          amount: s.total_price,
          category: famId ? (familyName.get(famId) ?? s.remark ?? '推导设备') : (s.remark ?? '推导设备'),
          source_type: 'selection',
          source_id: s.id,
          sort_order: i,
        }
      })

    // P4：材料类推导结果（定额材料）作为清单材料行。价格优先取"定额材料材料单价"（brand/model/price），无则回退同类别材料设备型号均价，再无处 0
    const materialResults = ctx
      .get<DesignResult>(T.design_results)
      .filter((r) => r.project_system_id === psId && sourceTypeIsMaterial(r.source_type))
    const quotaMats = ctx.get<DeviceMaterial>(T.device_materials)
    // 材料均价兜底：按产品类别（cable/aux 材料类）而非写死家族 id，用户新建产品族后仍生效
    const productCategory = new Map(
      ctx.get<{ id: string; category?: string }>(T.products).map((p) => [p.id, p.category]),
    )
    const materialModels = models.filter((m) => {
      const cat = m.product_id ? productCategory.get(m.product_id) : undefined
      return cat === 'cable' || cat === 'aux'
    })
    const avgPrice = materialModels.length
      ? materialModels.reduce((s, m) => s + PricingEngine.getPrice(ctx, m.id), 0) / materialModels.length
      : 0
    let sort = items.length
    for (const r of materialResults) {
      const name = (r.rule_snapshot ?? '').replace('定额-', '') || '材料'
      const mat = quotaMats.find((m) => m.enabled !== false && m.name === name)
      const matPrice = mat?.price != null ? mat.price : avgPrice
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
        quantity: r.quantity,
        unit_price: matPrice,
        amount: Math.round(matPrice * r.quantity * 100) / 100,
        category: BILL_MATERIAL_CATEGORY[r.result_type] ?? '材料',
        source_type: 'quota',
        source_id: r.id,
        sort_order: sort,
      })
    }
    return { version, items }
  },
}

function sourceTypeIsMaterial(sourceType?: string): boolean {
  return sourceType === 'quota'
}