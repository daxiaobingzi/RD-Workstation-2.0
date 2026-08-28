import { T } from '../types/domain'
import type { EngineCtx } from './ctx'

/* ================= PricingEngine：价格 ================= */
export const PricingEngine = {
  /** 取型号参考价（优先 reference，其次最新有效价） */
  getPrice(ctx: EngineCtx, modelId: string): number {
    const prices = ctx
      .get<{ model_id: string; price_type: string; price: number }>(T.prices)
      .filter((p) => p.model_id === modelId)
    if (!prices.length) return 0
    const ref = prices.find((p) => p.price_type === 'reference')
    return ref ? ref.price : prices[prices.length - 1].price
  },
}