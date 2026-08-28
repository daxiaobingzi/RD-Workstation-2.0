import type { DB } from '../db/memory-db'
import type { Row } from '../types/domain'

/** 表级泛型同步 Repository：Service 只依赖本接口，SQLite 阶段替换实现即可 */
export interface Repository {
  /** 当前整库快照（只读） */
  readonly db: DB
  getTable<T>(table: string): T[]
  getById<T>(table: string, id: string): T | undefined
  where<T>(table: string, pred: (row: T) => boolean): T[]
  insert<T extends Row>(table: string, row: T): void
  insertMany<T extends Row>(table: string, rows: T[]): void
  update(table: string, id: string, patch: Record<string, unknown>): void
  remove(table: string, id: string): void
  removeMany(table: string, pred: (row: Row) => boolean): void
  replace<T extends Row>(table: string, rows: T[]): void
}