import { useShallow } from 'zustand/react/shallow'
import { useDB } from './memory-db'
import type { TableMap, TableName } from '../types/table-map'

/** 只订阅单张表，避免业务页面因无关表变化而重新渲染。 */
export function useDBTable<K extends TableName>(table: K): TableMap[K][] {
  return useDB((state) => (state.db[table] ?? []) as TableMap[K][])
}

/** 一次订阅多个相关表，使用浅比较避免无关表变化造成重复渲染。 */
export function useDBTables<K extends TableName>(tables: readonly K[]): TableMap[K][][] {
  return useDB(
    useShallow((state) => tables.map((table) => (state.db[table] ?? []) as TableMap[K][])),
  )
}
