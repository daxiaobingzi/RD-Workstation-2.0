import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './layout'
import { TodayPage } from '../features/today/TodayPage'
import { ProjectsPage } from '../features/projects/ProjectsList'
import { ProjectDetailPage } from '../features/projects/ProjectDetail/ProjectDetailPage'
import { SystemDesignPage } from '../features/system-design/SystemDesignPage'
import { DeviceCenterPage } from '../features/device-center/DeviceCenterPage'
import { DesignPage } from '../features/design/DesignPage'
import { BillsPage } from '../features/bills/BillsPage'
import { PlaceholderPage } from './route-placeholders'
import { Toaster } from '../components/ui/toast'

function Shell() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/systems/:psId" element={<SystemDesignPage />} />
          <Route path="/projects/:projectId/:tab" element={<ProjectDetailPage />} />
          <Route path="/devices" element={<DeviceCenterPage />} />
          <Route path="/design" element={<DesignPage />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/budget" element={<PlaceholderPage label="预算" desc="预算总览 · 档次切换 · 优化（第二批）" />} />
          <Route path="/tools" element={<PlaceholderPage label="设计工具" desc="各专业计算器：计算 → 预览 → 写入（第四批）" />} />
          <Route path="/knowledge" element={<PlaceholderPage label="知识" desc="知识库 · 规范 · 产品资料 · 案例（第四批）" />} />
          <Route path="/goals" element={<PlaceholderPage label="目标" desc="年 / 季 / 月 / 周目标（第三批）" />} />
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
