import type { DB, TableMap, TableName } from '../types/table-map'

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

  /** 多步写操作在内存中完成，最终只提交一次；任一步抛错则整批不提交。 */
  transaction<T>(fn: (tx: Repository) => T): T
}

function cloneDB(db: DB): DB {
  return structuredClone(db)
}

/**
 * 创建基于内存 DB 的 Repository。
 * Repository 本身不关心 Zustand/localStorage，只通过 commit 把结果交回宿主。
 */
export function createMemoryRepository(
  getDB: () => DB,
  commit: (db: DB) => void,
): Repository {
  const create = (workingDB: DB, transactional: boolean): Repository => {
    const api: Repository = {
      get db() {
        return workingDB
      },

      getTable: <K extends TableName>(table: K) => workingDB[table] ?? [],

      getById: <K extends TableName>(table: K, id: string) =>
        workingDB[table]?.find((row) => row.id === id),

      where: <K extends TableName>(table: K, pred: (row: TableMap[K]) => boolean) =>
        (workingDB[table] ?? []).filter(pred),

      insert: <K extends TableName>(table: K, row: TableMap[K]) => {
        workingDB[table] = [...(workingDB[table] ?? []), row] as TableMap[K][]
        if (!transactional) commit(workingDB)
      },

      insertMany: <K extends TableName>(table: K, rows: TableMap[K][]) => {
        workingDB[table] = [...(workingDB[table] ?? []), ...rows] as TableMap[K][]
        if (!transactional) commit(workingDB)
      },

      update: <K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>) => {
        workingDB[table] = (workingDB[table] ?? []).map((row) =>
          row.id === id ? { ...row, ...patch } : row,
        ) as TableMap[K][]
        if (!transactional) commit(workingDB)
      },

      remove: <K extends TableName>(table: K, id: string) => {
        workingDB[table] = (workingDB[table] ?? []).filter((row) => row.id !== id) as TableMap[K][]
        if (!transactional) commit(workingDB)
      },

      removeMany: <K extends TableName>(table: K, pred: (row: TableMap[K]) => boolean) => {
        workingDB[table] = (workingDB[table] ?? []).filter((row) => !pred(row)) as TableMap[K][]
        if (!transactional) commit(workingDB)
      },

      replace: <K extends TableName>(table: K, rows: TableMap[K][]) => {
        workingDB[table] = rows
        if (!transactional) commit(workingDB)
      },

      transaction: <T>(fn: (tx: Repository) => T): T => {
        const draft = cloneDB(workingDB)
        const tx = create(draft, true)
        const result = fn(tx)
        commit(draft)
        return result
      },
    }

    return api
  }

  return create(getDB(), false)
}
