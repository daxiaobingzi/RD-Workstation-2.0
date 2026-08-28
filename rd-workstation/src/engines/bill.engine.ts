import type { BillItem, BillVersion, DeviceSelection, ProductModel } from '../types/domain'
import { T } from '../types/domain'
import { uid } from '../lib/utils'
import type { EngineCtx } from './ctx'

/* ================= BillEngine：清单（版本化） ================= */
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
    return { version, items }
  },
}