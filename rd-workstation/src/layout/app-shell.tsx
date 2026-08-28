import { NavLink, useLocation, useParams } from 'react-router-dom'
import {
  Sun, FolderKanban, PenTool, Boxes, Receipt, Calculator, BookOpen,
  Target, Repeat, Sparkles, Search, Settings, Command, ChevronRight,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { ProjectService } from '../domain/services'

const NAV = [
  { to: '/today', label: '今日', icon: Sun },
  { to: '/projects', label: '项目', icon: FolderKanban },
  { to: '/design', label: '设计', icon: PenTool },
  { to: '/devices', label: '设备', icon: Boxes },
  { to: '/bills', label: '清单', icon: Receipt },
  { to: '/tools', label: '工具', icon: Calculator },
  { to: '/knowledge', label: '知识', icon: BookOpen },
  { to: '/goals', label: '目标', icon: Target },
  { to: '/habits', label: '习惯', icon: Repeat },
  { to: '/ai', label: 'AI', icon: Sparkles },
]

const PROJECT_TABS = [
  { key: 'overview', label: '概览', path: '' },
  { key: 'systems', label: '系统', path: '/systems' },
  { key: 'tasks', label: '任务', path: '/tasks' },
  { key: 'schedules', label: '日程', path: '/schedules' },
  { key: 'points', label: '点位', path: '/points' },
  { key: 'devices', label: '设备', path: '/devices' },
  { key: 'bills', label: '清单', path: '/bills' },
  { key: 'budget', label: '预算', path: '/budget' },
  { key: 'documents', label: '文档', path: '/documents' },
  { key: 'revisions', label: '版本', path: '/revisions' },
  { key: 'review', label: '复盘', path: '/review' },
]

function Sidebar() {
  return (
    <aside className="flex h-full w-14 shrink-0 flex-col items-center border-r border-rule bg-surface py-2">
      <NavLink to="/today" className="mb-2 flex size-9 items-center justify-center" aria-label="RD Workstation">
        <span className="size-4 rounded-[4px] bg-gradient-to-br from-accent to-accent2" />
      </NavLink>
      <nav className="flex flex-1 flex-col items-center gap-0.5" aria-label="一级导航">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'flex size-9 items-center justify-center rounded-[6px] transition-colors',
                isActive ? 'bg-accent-soft text-accent' : 'text-faint hover:bg-hover hover:text-muted',
              )
            }
          >
            <item.icon className="size-[18px]" />
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-col items-center gap-0.5 border-t border-rule pt-2">
        <button className="flex size-9 items-center justify-center rounded-[6px] text-faint hover:bg-hover hover:text-muted" title="设置" type="button">
          <Settings className="size-[18px]" />
        </button>
        <span className="mt-1 flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-[11px] font-semibold text-white">
          R
        </span>
      </div>
    </aside>
  )
}

function Topbar() {
  const { projectId } = useParams()
  const project = projectId ? ProjectService.get(projectId) : undefined
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-rule bg-surface px-4">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold">
        <span>RD Workstation</span>
        {project && (
          <>
            <ChevronRight className="size-3.5 text-faint" />
            <span className="truncate text-muted">{project.name}</span>
          </>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          className="flex h-7 items-center gap-2 rounded-[6px] border border-rule bg-surface-subtle px-2.5 text-[12px] text-muted hover:bg-hover"
          type="button"
        >
          <Search className="size-3.5" />
          <span>搜索项目 / 设备 / 点位…</span>
          <span className="flex items-center gap-0.5 rounded bg-surface px-1 font-mono text-[10px] text-faint">
            <Command className="size-2.5" />K
          </span>
        </button>
        <button className="flex h-7 items-center gap-1.5 rounded-[6px] bg-accent-soft px-2.5 text-[12px] font-medium text-accent hover:bg-selected" type="button">
          <Sparkles className="size-3.5" />
          AI
        </button>
      </div>
    </header>
  )
}

function ProjectNav() {
  const { projectId } = useParams()
  const location = useLocation()
  if (!projectId) return null
  const active = PROJECT_TABS.reduce((acc, t) => (location.pathname.endsWith(t.path) || (t.path === '' && !location.pathname.match(/\/[a-z]+$/i)) ? t.key : acc), 'overview')
  void active
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-rule bg-surface px-2 scrollbar-none">
      {PROJECT_TABS.map((t) => {
        const target = `/projects/${projectId}${t.path}`
        const isActive = t.path === '' ? location.pathname === target : location.pathname.startsWith(target) && !location.pathname.includes('/systems/')
        return (
          <NavLink
            key={t.key}
            to={target}
            className={cn(
              'relative shrink-0 px-3 py-2 text-[12.5px] font-medium whitespace-nowrap',
              isActive ? 'text-accent' : 'text-muted hover:text-ink',
            )}
          >
            {t.label}
            {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </NavLink>
        )
      })}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <ProjectNav />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
