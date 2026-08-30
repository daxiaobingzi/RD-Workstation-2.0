import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Download, Check, Pencil } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { buildDesignNotes, exportDesignNotesDoc, saveDesignNote } from '../lib/export-notes-doc'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty'
import { toast } from '../../../components/ui/toast'
import { cn } from '../../../lib/utils'

/** 模块③ 设计说明：每子系统一个“多行内容库”（用户自行填写），导出 Word 联动正文 */
export function DesignNotesV2({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const initial = useMemo(() => buildDesignNotes(projectId), [projectId, useDB.getState().db])
  const [contents, setContents] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.systems.map((s) => [s.psId, s.content])),
  )
  const [savedAt, setSavedAt] = useState<Record<string, string>>({})
  const timer = useRef<Record<string, number>>({})

  // 数据变更（新系统/其它页改动）后与本地内容同步
  useEffect(() => {
    setContents((prev) => {
      const next = { ...prev }
      let changed = false
      for (const s of initial.systems) {
        if (!(s.psId in next)) { next[s.psId] = s.content; changed = true }
      }
      return changed ? next : prev
    })
  }, [initial])

  const setContent = (psId: string, v: string) => {
    setContents((prev) => ({ ...prev, [psId]: v }))
  }
  const save = (psId: string) => {
    saveDesignNote(projectId, psId, contents[psId] ?? '')
    setSavedAt((prev) => ({ ...prev, [psId]: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }))
  }
  const autoSave = (psId: string) => {
    // 失焦/暂停 800ms 自动保存一版
    window.clearTimeout(timer.current[psId])
    timer.current[psId] = window.setTimeout(() => save(psId), 800)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-[12px] text-faint">每个子系统一份设计说明；正文导出 Word 时联动（H1 项目 → H2 系统 分级标题）。</span>
        <Button onClick={() => { exportDesignNotesDoc(projectId); toast('已导出设计说明 Word（含已填写正文）') }}><Download className="size-4" />导出全部设计说明 Word</Button>
      </div>

      {initial.systems.map((sys, idx) => {
        const synced = contents[sys.psId] !== undefined && contents[sys.psId] !== ''
        return (
          <section key={sys.psId} className="rounded-lg border border-rule bg-surface shadow-sm">
            <div className="flex items-center gap-2 border-b border-rule px-4 py-2.5">
              <FileText className="size-4 text-accent" />
              <span className="font-mono text-[11px] text-faint">{sys.code}</span>
              <h3 className="text-[13.5px] font-semibold">{idx + 1} · {sys.name} 设计说明</h3>
              <span className="rounded-full bg-surface-subtle px-1.5 text-[10.5px] text-muted">{sys.grade}</span>
              <span className="ml-auto flex items-center gap-2">
                {synced
                  ? <span className="flex items-center gap-1 text-[11px] text-ok"><Check className="size-3" />已填写{savedAt[sys.psId] ? ` · ${savedAt[sys.psId]}` : ''}</span>
                  : <span className="text-[11px] text-faint">未填写</span>}
                <Button size="xs" variant="outline" onClick={() => save(sys.psId)}><Pencil className="size-3" />保存</Button>
              </span>
            </div>
            <div className="p-4">
              <textarea
                rows={10}
                value={contents[sys.psId] ?? ''}
                placeholder={'请填写该子系统的设计说明（多行），例如：\n1.1 设计依据\nGB 50348《安全防范工程技术标准》…\n\n1.2 点位概况\n本系统共规划 XXX 个点位，分布于 A/B 栋…\n\n1.3 系统构成\n前端设备、传输网络、存储与管理平台…'}
                onChange={(e) => { setContent(sys.psId, e.target.value); autoSave(sys.psId) }}
                onBlur={() => save(sys.psId)}
                className="w-full rounded-[6px] border border-rule bg-surface px-3 py-2.5 text-[13px] text-ink placeholder:text-faint focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none"
              />
              <p className="mt-2 flex items-center gap-3 text-[11px] text-faint">
                <span>点位 {sys.pointsQty} 个</span>
                <span>推导结果 {sys.resultsCount} 条</span>
                <span>设计参数 {sys.paramsCount} 项</span>
                <span className={cn('ml-auto')}>失焦自动保存 · 导出 Word 将包含本正文</span>
              </p>
            </div>
          </section>
        )
      })}
      {!initial.systems.length && (
        <EmptyState icon={<FileText />} title="还没有子系统" description="请先在概览「添加系统」或用项目模版生成系统集" />
      )}
    </div>
  )
}