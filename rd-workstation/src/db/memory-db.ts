import { create } from 'zustand'
import type { Row } from '../types/domain'
import type { TableMap, TableName } from '../types/table-map'
import type { Repository } from '../repositories/repository'

/** 数据库表集合：{ 表名: 行[] }。Web 先行阶段以内存对象承载，localStorage 持久化；
 *  后续 SQLite/Drizzle 落地时，把本层替换为 Repository 实现即可，上层不变。 */
export type DB = Record<string, Row[]>

type PersistenceStatus = 'idle' | 'saved' | 'error'

export interface DBState {
  db: DB
  ready: boolean
  persistenceStatus: PersistenceStatus
  persistenceError: string | null
  lastPersistedAt: number | null
  init: (seed: () => DB) => void
  getTable: <T>(t: string) => T[]
  getById: <T>(t: string, id: string) => T | undefined
  where: <T>(t: string, pred: (row: T) => boolean) => T[]
  insert: (t: string, row: Row) => void
  insertMany: (t: string, rows: Row[]) => void
  update: (t: string, id: string, patch: Record<string, unknown>) => void
  remove: (t: string, id: string) => void
  removeMany: (t: string, pred: (row: Row) => boolean) => void
  replace: (t: string, rows: Row[]) => void
  reset: () => void
}

const STORAGE_KEY = 'rdw-db-v5' // v5：点位收敛为「设备名称/建筑/弱电间/数量」，去除"区域"层级（用户决策）

function loadPersisted(): DB | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DB
    if (typeof parsed !== 'object' || !parsed.projects) return null
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
    set({
      db,
      ready: true,
      ...persistenceResult(persisted),
    })
  },

  getTable: (t) => (get().db[t] ?? []) as unknown as never[],

  getById: (t, id) =>
    (get().db[t] ?? []).find((r) => r.id === id) as unknown as never | undefined,

  where: (t, pred) =>
    (get().db[t] ?? []).filter((r) => (pred as unknown as (r: Row) => boolean)(r)) as unknown as never[],

  insert: (t, row) =>
    set((s) => {
      const db = { ...s.db, [t]: [...(s.db[t] ?? []), row] }
      return { db, ...persistenceResult(persist(db)) }
    }),

  insertMany: (t, rows) =>
    set((s) => {
      const db = { ...s.db, [t]: [...(s.db[t] ?? []), ...rows] }
      return { db, ...persistenceResult(persist(db)) }
    }),

  update: (t, id, patch) =>
    set((s) => {
      const db = {
        ...s.db,
        [t]: (s.db[t] ?? []).map((r) => (r.id === id ? { ...r, ...patch, id } : r)),
      }
      return { db, ...persistenceResult(persist(db)) }
    }),

  remove: (t, id) =>
    set((s) => {
      const db = { ...s.db, [t]: (s.db[t] ?? []).filter((r) => r.id !== id) }
      return { db, ...persistenceResult(persist(db)) }
    }),

  removeMany: (t, pred) =>
    set((s) => {
      const db = { ...s.db, [t]: (s.db[t] ?? []).filter((r) => !(pred as (r: Row) => boolean)(r)) }
      return { db, ...persistenceResult(persist(db)) }
    }),

  replace: (t, rows) =>
    set((s) => {
      const db = { ...s.db, [t]: rows }
      return { db, ...persistenceResult(persist(db)) }
    }),

  reset: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      set({
        db: {},
        ready: false,
        persistenceStatus: 'saved',
        persistenceError: null,
        lastPersistedAt: Date.now(),
      })
    } catch {
      set({
        db: {},
        ready: false,
        persistenceStatus: 'error',
        persistenceError: '本地数据清理失败，请检查浏览器存储权限。',
        lastPersistedAt: null,
      })
    }
  },
}))

export class MemoryRepository implements Repository {
  get db(): DB { return useDB.getState().db }

  getTable<K extends TableName>(t: K): TableMap[K][]
  getTable<T>(t: string): T[]
  getTable<T>(t: string): T[] { return useDB.getState().getTable<T>(t) }

  getById<K extends TableName>(t: K, id: string): TableMap[K] | undefined
  getById<T>(t: string, id: string): T | undefined
  getById<T>(t: string, id: string): T | undefined { return useDB.getState().getById<T>(t, id) }

  where<K extends TableName>(t: K, pred: (row: TableMap[K]) => boolean): TableMap[K][]
  where<T>(t: string, pred: (row: T) => boolean): T[]
  where<T>(t: string, pred: (row: T) => boolean): T[] { return useDB.getState().where<T>(t, pred) }

  insert<K extends TableName>(t: K, row: TableMap[K]): void
  insert<T extends Row>(t: string, row: T): void
  insert<T extends Row>(t: string, row: T): void { useDB.getState().insert(t, row) }

  insertMany<K extends TableName>(t: K, rows: TableMap[K][]): void
  insertMany<T extends Row>(t: string, rows: T[]): void
  insertMany<T extends Row>(t: string, rows: T[]): void { useDB.getState().insertMany(t, rows) }

  update(t: string, id: string, patch: Record<string, unknown>): void { useDB.getState().update(t, id, patch) }
  remove(t: string, id: string): void { useDB.getState().remove(t, id) }
  removeMany(t: string, pred: (row: Row) => boolean): void { useDB.getState().removeMany(t, pred) }

  replace<K extends TableName>(t: K, rows: TableMap[K][]): void
  replace<T extends Row>(t: string, rows: T[]): void
  replace<T extends Row>(t: string, rows: T[]): void { useDB.getState().replace(t, rows) }
}
/** 组合根单例：Service 经它访问数据，类型为 Repository 接口 */
export const repository: Repository = new MemoryRepository()
