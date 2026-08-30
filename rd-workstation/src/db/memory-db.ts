import { create } from 'zustand'
import type { Row } from '../types/domain'
import type { TableMap, TableName } from '../types/table-map'
import type { Repository } from '../repositories/repository'

/** 数据库表集合：冻结 Schema 的可选表映射。Web 先行阶段以内存对象承载，localStorage 持久化；
 *  后续 SQLite/Drizzle 落地时，把本层替换为 Repository 实现即可，上层不变。 */
export type DB = Partial<{ [K in TableName]: TableMap[K][] }>

type PersistenceStatus = 'idle' | 'saved' | 'error'

export interface DBState {
  db: DB
  ready: boolean
  persistenceStatus: PersistenceStatus
  persistenceError: string | null
  lastPersistedAt: number | null
  init: (seed: () => DB) => void
  getTable: <K extends TableName>(t: K) => TableMap[K][]
  getById: <K extends TableName>(t: K, id: string) => TableMap[K] | undefined
  where: <K extends TableName>(t: K, pred: (row: TableMap[K]) => boolean) => TableMap[K][]
  insert: <K extends TableName>(t: K, row: TableMap[K]) => void
  insertMany: <K extends TableName>(t: K, rows: TableMap[K][]) => void
  update: <K extends TableName>(t: K, id: string, patch: Partial<TableMap[K]>) => void
  remove: <K extends TableName>(t: K, id: string) => void
  removeMany: <K extends TableName>(t: K, pred: (row: TableMap[K]) => boolean) => void
  replace: <K extends TableName>(t: K, rows: TableMap[K][]) => void
  reset: () => void
}

const STORAGE_KEY = 'rdw-db-v5'

function loadPersisted(): DB | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DB
    if (typeof parsed !== 'object' || !parsed || !parsed.projects) return null
    return parsed
  } catch {
    return null
  }
}

function persist(db: DB): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    return true
  } catch {
    return false
  }
}

function persistenceResult(ok: boolean) {
  return ok
    ? {
        persistenceStatus: 'saved' as const,
        persistenceError: null,
        lastPersistedAt: Date.now(),
      }
    : {
        persistenceStatus: 'error' as const,
        persistenceError: '本地数据保存失败，请及时导出备份。',
        lastPersistedAt: null,
      }
}

export const useDB = create<DBState>((set, get) => ({
  db: {},
  ready: false,
  persistenceStatus: 'idle',
  persistenceError: null,
  lastPersistedAt: null,

  init: (seed) => {
    const existing = loadPersisted()
    const db = existing ?? seed()
    const persisted = persist(db)
    set({ db, ready: true, ...persistenceResult(persisted) })
  },

  getTable: (t) => get().db[t] ?? [],
  getById: (t, id) => get().db[t]?.find((r) => r.id === id),
  where: (t, pred) => (get().db[t] ?? []).filter(pred),

  insert: (t, row) =>
    set((s) => {
      const db: DB = { ...s.db, [t]: [...(s.db[t] ?? []), row] }
      return { db, ...persistenceResult(persist(db)) }
    }),

  insertMany: (t, rows) =>
    set((s) => {
      const db: DB = { ...s.db, [t]: [...(s.db[t] ?? []), ...rows] }
      return { db, ...persistenceResult(persist(db)) }
    }),

  update: (t, id, patch) =>
    set((s) => {
      const db: DB = {
        ...s.db,
        [t]: (s.db[t] ?? []).map((r) => (r.id === id ? { ...r, ...patch, id } : r)),
      }
      return { db, ...persistenceResult(persist(db)) }
    }),

  remove: (t, id) =>
    set((s) => {
      const db: DB = { ...s.db, [t]: (s.db[t] ?? []).filter((r) => r.id !== id) }
      return { db, ...persistenceResult(persist(db)) }
    }),

  removeMany: (t, pred) =>
    set((s) => {
      const db: DB = { ...s.db, [t]: (s.db[t] ?? []).filter((r) => !pred(r)) }
      return { db, ...persistenceResult(persist(db)) }
    }),

  replace: (t, rows) =>
    set((s) => {
      const db: DB = { ...s.db, [t]: rows }
      return { db, ...persistenceResult(persist(db)) }
    }),

  reset: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      set({ db: {}, ready: false, persistenceStatus: 'saved', persistenceError: null, lastPersistedAt: Date.now() })
    } catch {
      set({ db: {}, ready: false, persistenceStatus: 'error', persistenceError: '本地数据清理失败，请检查浏览器存储权限。', lastPersistedAt: null })
    }
  },
}))

export class MemoryRepository implements Repository {
  get db(): DB { return useDB.getState().db }
  getTable<K extends TableName>(t: K): TableMap[K][] { return useDB.getState().getTable(t) }
  getById<K extends TableName>(t: K, id: string): TableMap[K] | undefined { return useDB.getState().getById(t, id) }
  where<K extends TableName>(t: K, pred: (row: TableMap[K]) => boolean): TableMap[K][] { return useDB.getState().where(t, pred) }
  insert<K extends TableName>(t: K, row: TableMap[K]): void { useDB.getState().insert(t, row) }
  insertMany<K extends TableName>(t: K, rows: TableMap[K][]): void { useDB.getState().insertMany(t, rows) }
  update<K extends TableName>(t: K, id: string, patch: Partial<TableMap[K]>): void { useDB.getState().update(t, id, patch) }
  remove<K extends TableName>(t: K, id: string): void { useDB.getState().remove(t, id) }
  removeMany<K extends TableName>(t: K, pred: (row: TableMap[K]) => boolean): void { useDB.getState().removeMany(t, pred) }
  replace<K extends TableName>(t: K, rows: TableMap[K][]): void { useDB.getState().replace(t, rows) }
}

/** 组合根单例：Service 经它访问数据，类型为 Repository 接口 */
export const repository: Repository = new MemoryRepository()
