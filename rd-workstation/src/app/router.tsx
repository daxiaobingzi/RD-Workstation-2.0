import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { AppShell } from './layout'
import { TodayPage } from '../features/today/TodayPage'
import { ProjectsV2ListPage } from '../features/projects-v2/ProjectsV2ListPage'
import { ProjectV2Page } from '../features/projects-v2/ProjectV2Page'
import { DeviceCenterPage } from '../features/device-center/DeviceCenterPage'
import { BillsPage } from '../features/bills/BillsPage'
import { GoalsPage } from '../features/goals/GoalsPage'
import { PlaceholderPage } from './route-placeholders'
import { Toaster } from '../components/ui/toast'

function Shell() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

/** 旧版项目中心 URL 重定向到 v2（携带参数解析，避免字面占位符；旧 tab 键映射到 v2 模块） */
const LEGACY_TAB_MAP: Record<string, string> = {
  overview: 'overview',
  systems: 'points', // 旧「系统」tab → v2 点表（系统集中管理）
  tasks: 'overview', schedules: 'overview',
  points: 'points',
  devices: 'materials', // 旧「设备」tab → v2 材料表
  bills: 'budget', budget: 'budget',
  documents: 'documents', revisions: 'versions',
  review: 'review',
}
function RedirectToV2() {
  const { projectId, tab, psId } = useParams<{ projectId?: string; tab?: string; psId?: string }>()
  // 旧「子系统工作区」已删除：/systems/:psId 一律落到 v2 推导页
  const href = projectId
    ? psId
      ? `/projects-v2/${projectId}/derive`
      : `/projects-v2/${projectId}${tab ? `/${LEGACY_TAB_MAP[tab] ?? 'overview'}` : ''}`
    : '/projects-v2'
  return <Navigate to={href} replace />
}

/** 残留的 v2 子系统工作区链接 → v2 推导页（旧工作区已删除） */
function SystemToDeriveRedirect() {
  const { projectId } = useParams<{ projectId: string }>()
  return <Navigate to={`/projects-v2/${projectId}/derive`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          {/* 旧项目中心已删除：/projects 相关路径重定向到 v2 */}
          <Route path="/projects" element={<Navigate to="/projects-v2" replace />} />
          <Route path="/projects/:projectId" element={<RedirectToV2 />} />
          <Route path="/projects/:projectId/:tab" element={<RedirectToV2 />} />
          <Route path="/projects/:projectId/systems/:psId" element={<RedirectToV2 />} />
          {/* 项目中心 v2（顶层规划新方案） */}
          <Route path="/projects-v2" element={<ProjectsV2ListPage />} />
          <Route path="/projects-v2/:projectId" element={<ProjectV2Page />} />
          <Route path="/projects-v2/:projectId/:tab" element={<ProjectV2Page />} />
          {/* 旧「子系统设计工作区」已删除：残留链接一律落到 v2 推导页 */}
          <Route path="/projects-v2/:projectId/systems/:psId" element={<SystemToDeriveRedirect />} />
          <Route path="/devices" element={<DeviceCenterPage />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/budget" element={<PlaceholderPage label="预算" desc="预算总览 · 档次切换 · 优化（第二批）" />} />
          <Route path="/tools" element={<PlaceholderPage label="设计工具" desc="各专业计算器：计算 → 预览 → 写入（第四批）" />} />
          <Route path="/knowledge" element={<PlaceholderPage label="知识" desc="知识库 · 规范 · 产品资料 · 案例（第四批）" />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/habits" element={<PlaceholderPage label="习惯" desc="今日打卡 · 连续记录 · 热力图（第三批）" />} />
          <Route path="/ai" element={<PlaceholderPage label="AI 助手" desc="规划 · 选型 · 预算优化 · 审核（第五批）" />} />
          <Route path="/tasks" element={<PlaceholderPage label="任务" desc="全部 / 今天 / 本周 / 项目（第三批）" />} />
          <Route path="/schedules" element={<PlaceholderPage label="日程" desc="Day / Week / Project 视图（第三批）" />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
