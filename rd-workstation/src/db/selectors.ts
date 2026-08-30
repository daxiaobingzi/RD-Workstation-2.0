import { useDB } from './memory-db'
import type { TableMap, TableName } from '../types/table-map'

/** 只订阅单张表，避免业务页面因无关表变化而重新渲染。 */
export function useDBTable<K extends TableName>(table: K): TableMap[K][] {
  return useDB((state) => (state.db[table] ?? []) as TableMap[K][]) 
}
