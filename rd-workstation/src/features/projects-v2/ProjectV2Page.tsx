import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Download, Upload, Archive, ArchiveRestore, LayoutGrid, FileText, MapPinned,
  Sigma, Boxes, Wallet, Calculator, Files, GitCompare, NotebookPen,
} from 'lucide-react'
import { useDB } from '../../db/memory-db'
import { ProjectService } from '../../services'
import { StatusBadge } from '../../components/ui/badge'
import { Modal } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { toast } from '../../components/ui/toast'
import { cn } from '../../lib/utils'
import { OverviewV2 } from './components/OverviewV2'
import { DesignNotesV2 } from './components/DesignNotesV2'
import { ProjectPointsV2 } from './components/ProjectPointsV2'
import { DeriveResultsV2 } from './components/DeriveResultsV2'
import { ProductListV2 } from './components/ProductListV2'
import { BudgetListV2 } from './components/BudgetListV2'
import { VersionsV2 } from './components/VersionsV2'
import { DocumentsTab } from './components/DocumentsTab'
import { ReviewTab } from './components/ReviewTab'

const TABS = [
  { key: 'overview', label: '概览', icon: LayoutGrid },
  { key: 'notes', label: '设计说明', icon: FileText },
  { key: 'points', label: '点位', icon: MapPinned },
  { key: 'derive', label: '推导', icon: Sigma },
  { key: 'materials', label: '材料表', icon: Boxes },
  { key: 'budget', label: '预算清单', icon: Wallet },
  { key: 'estimate', label: '概算清单', icon: Calculator },
  { key: 'documents', label: '文档', icon: Files },
  { key: 'versions', label: '版本', icon: GitCompare },
  { key: 'review', label: '复盘', icon: NotebookPen },
]

/** 项目中心 v2 · 单项目壳：项目头（导出/导入备份、归档/恢复）+ 内部 tab 导航（②~⑪ 模块） */
export function ProjectV2Page() {
  const { projectId, tab } = useParams<{ projectId: string; tab?: string }>()
  useDB((s) => s.db)
  const navigate = useNavigate()
  const project = projectId ? ProjectService.get(projectId) : undefined
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const askConfirm = (id: string, cb: () => void) => {
    if (confirmId === id) { setConfirmId(null); cb(); return }
    setConfirmId(id)
    window.setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 2500)
  }
  const archiveThis = () => {
    if (!project) return
    ProjectService.archive(project.id)
    toast(`项目「${project.name}」已归档`)
    navigate('/projects-v2')
  }
  const restoreThis = () => {
    if (!project) return
    ProjectService.restore(project.id)
    toast(`项目「${project.name}」已恢复`)
  }

  if (!project) {
    return <div className="p-8 text-muted">项目不存在或已删除。</div>
  }

  const active = TABS.find((t) => (tab ?? 'overview') === t.key)?.key ?? 'overview'

  const triggerExportBackup = () => {
    const json = ProjectService.exportBackup(project.id)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.project_code}-backup.rdw.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('项目备份已导出')
  }
  const doImportBackup = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = ProjectService.importBackup(String(reader.result ?? ''))
      if (res.ok) toast(res.message ?? '已导入项目备份')
      else toast(res.message ?? '备份导入失败', 'warn')
      if (res.ok) setBackupOpen(false)
    }
    reader.readAsText(file)
  }

  const renderTab = () => {
    switch (active) {
      case 'overview': return <OverviewV2 projectId={project.id} />
      case 'notes': return <DesignNotesV2 projectId={project.id} />
      case 'points': return <ProjectPointsV2 projectId={project.id} />
      case 'derive': return <DeriveResultsV2 projectId={project.id} />
      case 'materials': return <ProductListV2 projectId={project.id} />
      case 'budget': return <BudgetListV2 projectId={project.id} mode="budget" />
      case 'estimate': return <BudgetListV2 projectId={project.id} mode="estimate" />
      case 'documents': return <DocumentsTab projectId={project.id} />
      case 'versions': return <VersionsV2 projectId={project.id} />
      case 'review': return <ReviewTab projectId={project.id} projectName={project.name} />
      default: return <OverviewV2 projectId={project.id} />
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 p-5">
      {/* 项目头 */}
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">{project.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          <span className="font-mono">{project.project_code}</span>
          <span>·</span>
          <span>业态 {project.project_type ?? '—'}</span>
          <span>·</span>
          <StatusBadge status={project.status} />
          {project.archived_at && <StatusBadge status="archived" />}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={triggerExportBackup}><Download className="size-3.5" />导出备份</Button>
            <Button size="sm" variant="outline" onClick={() => setBackupOpen(true)}><Upload className="size-3.5" />导入备份</Button>
            {project.archived_at ? (
              <Button size="sm" variant="outline" onClick={() => askConfirm('restore', restoreThis)} className={confirmId === 'restore' ? 'bg-accent text-white' : ''}>
                <ArchiveRestore className="size-3.5" />{confirmId === 'restore' ? '再次点击确认恢复' : '恢复项目'}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => askConfirm('archive', archiveThis)} className={confirmId === 'archive' ? 'bg-danger text-white' : ''}>
                <Archive className="size-3.5" />{confirmId === 'archive' ? '再次点击确认归档' : '归档项目'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 内部 tab 导航（②~⑪ 模块） */}
      <div className="flex h-9 items-center gap-0.5 overflow-x-auto border-b border-rule bg-surface px-2">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate(`/projects-v2/${project.id}/${t.key}`)}
              className={cn('relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium whitespace-nowrap transition-colors', isActive ? 'text-accent' : 'text-muted hover:text-ink')}
            >
              <Icon className="size-3.5" />{t.label}
              {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          )
        })}
      </div>

      {renderTab()}

      {/* 导入备份 */}
      <Modal open={backupOpen} onClose={() => setBackupOpen(false)} title="导入项目备份" width={440}>
        <div className="space-y-3">
          <p className="text-[12.5px] text-muted">
            选择由本应用导出的 <span className="font-mono">*.rdw.json</span> 备份文件。导入将按 id 合并项目表数据：已存在的记录被覆盖，新记录被插入。
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-rule py-8 text-faint transition-colors hover:border-accent/50 hover:text-accent">
            <Upload className="size-6" />
            <span className="text-[12.5px]">点击选择备份文件</span>
            <input ref={fileRef} type="file" accept=".json,.rdw.json" className="hidden" onChange={(e) => { doImportBackup(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </Modal>
    </div>
  )
}