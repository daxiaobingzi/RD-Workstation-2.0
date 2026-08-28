/**
 * seed 模块级共享。
 * 计数器 n + id() 生成器：所有调用共享同一计数器（原样保留自 index.ts 顶部）。
 */

/** 模块级共享的自增计数器。 */
export let n = 0

/** 生成形如 price_1 / price_a 的唯一 id（原样保留机制）。 */
export const id = (p: string) => `${p}_${(++n).toString(36)}`

/** 种子数据统一时间戳（原样保留）。 */
export const now = '2026-08-27T09:00:00'