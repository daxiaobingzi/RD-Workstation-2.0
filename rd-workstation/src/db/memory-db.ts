import { create } from 'zustand'
import type { DB, TableMap, TableName } from '../types/table-map'
import { createMemoryRepository, type Repository } from '../repositories/repository'

/** 数据库表集合：冻结 Schema 的可选表映射。Web 先行阶段以内存对象承载，localStorage 持久化；
 *  后续 SQLite/Drizzle 落地时，把本层替换为 Repository 实现即可，上层不变。 */

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
  transaction: <T>(fn: (tx: Repository) => T) => T
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

let repositoryRef: Repository | null = null

export const useDB = create<DBState>((set, get) => {
  const state = {
    db: {},
    ready: false,
    persistenceStatus: 'idle' as PersistenceStatus,
    persistenceError: null as string | null,
    lastPersistedAt: null as number | null,
    init: (seed: () => DB) => {
      const existing = loadPersisted()
      const db = existing ?? seed()
      const now = Date.now()
      set({ db, ready: true, persistenceStatus: existing ? 'saved' : 'idle', persistenceError: null, lastPersistedAt: existing ? now : null })
    },
    getTable: <K extends TableName>(t: K) => get().db[t] ?? [],
    getById: <K extends TableName>(t: K, id: string) => get().db[t]?.find((row) => row.id === id),
    where: <K extends TableName>(t: K, pred: (row: TableMap[K]) => boolean) => (get().db[t] ?? []).filter(pred),
    insert: <K extends TableName>(t: K, row: TableMap[K]) => {
      const db = get().db
      const next = { ...db, [t]: [...(db[t] ?? []), row] } as DB
      const saved = persist(next)
      set({ db: next, persistenceStatus: saved ? 'saved' : 'error', persistenceError: saved ? null : '本地数据保存失败，请及时导出备份', lastPersistedAt: saved ? Date.now() : get().lastPersistedAt })
    },
    insertMany: <K extends TableName>(t: K, rows: TableMap[K][]) => {
      const db = get().db
      const next = { ...db, [t]: [...(db[t] ?? []), ...rows] } as DB
      const saved = persist(next)
      set({ db: next, persistenceStatus: saved ? 'saved' : 'error', persistenceError: saved ? null : '本地数据保存失败，请及时导出备份', lastPersistedAt: saved ? Date.now() : get().lastPersistedAt })
    },
    update: <K extends TableName>(t: K, id: string, patch: Partial<TableMap[K]>) => {
      const db = get().db
      const next = { ...db, [t]: (db[t] ?? []).map((row) => row.id === id ? { ...row, ...patch } : row) } as DB
      const saved = persist(next)
      set({ db: next, persistenceStatus: saved ? 'saved' : 'error', persistenceError: saved ? null : '本地数据保存失败，请及时导出备份', lastPersistedAt: saved ? Date.now() : get().lastPersistedAt })
    },
    remove: <K extends TableName>(t: K, id: string) => {
      const db = get().db
      const next = { ...db, [t]: (db[t] ?? []).filter((row) => row.id !== id) } as DB
      const saved = persist(next)
      set({ db: next, persistenceStatus: saved ? 'saved' : 'error', persistenceError: saved ? null : '本地数据保存失败，请及时导出备份', lastPersistedAt: saved ? Date.now() : get().lastPersistedAt })
    },
    removeMany: <K extends TableName>(t: K, pred: (row: TableMap[K]) => boolean) => {
      const db = get().db
      const next = { ...db, [t]: (db[t] ?? []).filter((row) => !pred(row)) } as DB
      const saved = persist(next)
      set({ db: next, persistenceStatus: saved ? 'saved' : 'error', persistenceError: saved ? null : '本地数据保存失败，请及时导出备份', lastPersistedAt: saved ? Date.now() : get().lastPersistedAt })
    },
    replace: <K extends TableName>(t: K, rows: TableMap[K][]) => {
      const db = get().db
      const next = { ...db, [t]: rows } as DB
      const saved = persist(next)
      set({ db: next, persistenceStatus: saved ? 'saved' : 'error', persistenceError: saved ? null : '本地数据保存失败，请及时导出备份', lastPersistedAt: saved ? Date.now() : get().lastPersistedAt })
    },
    transaction: <T>(fn: (tx: Repository) => T): T => {
      if (!repositoryRef) throw new Error('Repository 尚未初始化')
      return repositoryRef.transaction(fn)
    },
    reset: () => {
      const next: DB = {}
      let saved = true
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        saved = false
      }
      set({ db: next, ready: false, persistenceStatus: saved ? 'saved' : 'error', persistenceError: saved ? null : '本地数据清理失败，请检查浏览器存储权限', lastPersistedAt: saved ? Date.now() : get().lastPersistedAt })
    },
  }
  return state
})

repositoryRef = createMemoryRepository(
  () => useDB.getState().db,
  (next) => {
    const saved = persist(next)
    const current = useDB.getState()
    useDB.setState({
      db: next,
      persistenceStatus: saved ? 'saved' : 'error',
      persistenceError: saved ? null : '本地数据保存失败，请及时导出备份',
      lastPersistedAt: saved ? Date.now() : current.lastPersistedAt,
    })
  },
)

export function getDBRepository(): Repository {
  if (!repositoryRef) {
    throw new Error('Repository 尚未初始化')
  }
  return repositoryRef
}
