import { repository } from '../db/memory-db'
import type { EngineCtx } from '../engines'

/** 内部共享的 EngineCtx：Engine 通过它只读访问库表，禁止绕过 repository */
const ctx: EngineCtx = {
  get: <X>(t: string) => repository.getTable<X>(t),
}

export default ctx