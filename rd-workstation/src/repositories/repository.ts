import type { DB } from '../db/memory-db'
import type { Row } from '../types/domain'
import type { TableMap, TableName } from '../types/table-map'

/** 表级泛型同步 Repository：Service 只依赖本接口，SQLite 阶段替换实现即可 */
export interface Repository {
  /** 当前整库快照（只读） */
  readonly db: DB

  /** 表名为冻结 Schema 时自动推导行类型；保留泛型重载兼容现有 Service 调用。 */
  getTable<K extends TableName>(table: K): TableMap[K][]
  getTable<T>(table: string): T[]

  getById<K extends TableName>(table: K, id: string): TableMap[K] | undefined
  getById<T>(table: string, id: string): T | undefined

  where<K extends TableName>(table: K, pred: (row: TableMap[K]) => boolean): TableMap[K][]
  where<T>(table: string, pred: (row: T) => boolean): T[]

  insert<K extends TableName>(table: K, row: TableMap[K]): void
  insert<T extends Row>(table: string, row: T): void
  insertMany<K extends TableName>(table: K, rows: TableMap[K][]): void
  insertMany<T extends Row>(table: string, rows: T[]): void

  /** 表名为冻结 Schema 时，patch 自动限制为对应行类型；保留宽泛重载兼容历史调用。 */
  update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>): void
  update(table: string, id: string, patch: Record<string, unknown>): void

  remove(table: string, id: string): void
  removeMany(table: string, pred: (row: Row) => boolean): void

  replace<K extends TableName>(table: K, rows: TableMap[K][]): void
  replace<T extends Row>(table: string, rows: T[]): void
}
