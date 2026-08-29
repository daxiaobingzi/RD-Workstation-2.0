import { QueryClient } from '@tanstack/react-query'

/** 应用级 QueryClient：本地仓储为同步数据源，查询即刻返回 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
})