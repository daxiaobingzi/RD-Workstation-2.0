import { useEffect, type ReactNode } from 'react'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useDB } from '../db/memory-db'
import { queryClient } from './query-client'

/**
 * 同步桥：Web 先行阶段数据层是同步内存库（zustand）。
 * 当库发生任何变更（增删改）时，自动失效全部 RQ 缓存，使"服务端状态"视图与仓储始终一致。
 * 未来切换 SQLite/Drizzle 异步仓储时，此桥可整体移除，交由 RQ 自身的失效策略接管。
 */
export function RepoQueryBridge() {
  const db = useDB((s) => s.db)
  const qc = useQueryClient()
  useEffect(() => {
    qc.invalidateQueries()
  }, [db, qc])
  return null
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RepoQueryBridge />
      {children}
    </QueryClientProvider>
  )
}