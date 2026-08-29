import { T } from '../types/domain'
import type { EngineCtx } from './ctx'

/* ================= PricingEngine：价格 ================= */
export const PricingEngine = {
  /** 取型号参考价（优先 reference，其次最早生效价）——口径与设备中心 DevicePricing.price 保持一致 */
  getPrice(ctx: EngineCtx, modelId: string): number {
    const prices = ctx
      .get<{ model_id: string; price_type: string; price: number; effective_date?: string }>(T.prices)
      .filter((p) => p.model_id === modelId)
    if (!prices.length) return 0
    const ref = prices.find((p) => p.price_type === 'reference')
    if (ref) return ref.price
    return [...prices].sort((a, b) => (a.effective_date ?? '').localeCompare(b.effective_date ?? ''))[0].price
  },
}