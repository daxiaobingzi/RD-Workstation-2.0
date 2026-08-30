import type { DB } from '../db/memory-db'
import type { TableMap, TableName } from '../types/table-map'

/** 表级泛型同步 Repository：Service 只依赖本接口，SQLite 阶段替换实现即可 */
export interface Repository {
  /** 当前整库快照（只读） */
  readonly db: DB

  /** 表名为冻结 Schema 时自动推导行类型。 */
  getTable<K extends TableName>(table: K): TableMap[K][]
  getById<K extends TableName>(table: K, id: string): TableMap[K] | undefined
  where<K extends TableName>(table: K, pred: (row: TableMap[K]) => boolean): TableMap[K][]

  insert<K extends TableName>(table: K, row: TableMap[K]): void
  insertMany<K extends TableName>(table: K, rows: TableMap[K][]): void

  /** patch 自动限制为对应表的行类型。 */
  update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>): void

  remove<K extends TableName>(table: K, id: string): void
  removeMany<K extends TableName>(table: K, pred: (row: TableMap[K]) => boolean): void

  replace<K extends TableName>(table: K, rows: TableMap[K][]): void
}
