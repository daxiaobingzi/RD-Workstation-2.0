import { useMemo, useState } from 'react'
import { LayoutTemplate, Save, Trash2, Check } from 'lucide-react'
import { Modal } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input, Field, Select } from '../../../components/ui/field'
import { toast } from '../../../components/ui/toast'
import { ProjectTemplateService, ProjectService } from '../../../services'
import type { Project } from '../../../types/domain'
import { cn } from '../../../lib/utils'

interface TemplateItem {
  id: string
  name: string
  description: string
  builtin: boolean
  systems: { systemId: string; name: string; code: string }[]
}

/** 项目模版弹窗：按业态切换 → 模版列表联动 → 套用新建项目；从当前项目生成模版 */
export function TemplateModal({
  open,
  onClose,
  formats,
  onApplied,
  currentProjectId,
}: {
  open: boolean
  onClose: () => void
  formats: string[]
  onApplied: (p: Project) => void
  currentProjectId?: string
}) {
  const [format, setFormat] = useState('')
  const [selId, setSelId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [genOpen, setGenOpen] = useState(false)
  const [tplName, setTplName] = useState('')
  const [srcProjectId, setSrcProjectId] = useState(currentProjectId ?? '')
  const [applyOpen, setApplyOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newClient, setNewClient] = useState('')

  const projects = useMemo(() => ProjectService.list(), [open])

  const activeFormat = format || formats[0] || ''

  const list = useMemo<TemplateItem[]>(() => {
    if (!activeFormat) return []
    return ProjectTemplateService.listByFormat(activeFormat).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      builtin: t.builtin,
      systems: t.systems.map((s) => ({ ...s, name: s.name.replace(/系统$/, '') })),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFormat, open, refreshKey])

  const selectedTpl = list.find((t) => t.id === (selId || list[0]?.id || ''))

  const openApply = () => {
    if (!selectedTpl) { toast('当前业态暂无可用模版', 'warn'); return }
    setNewName(`${activeFormat}项目`)
    setNewClient('')
    setApplyOpen(true)
  }
  const confirmApply = () => {
    if (!selectedTpl) return
    if (!newName.trim()) { toast('请填写项目名称', 'warn'); return }
    const res = ProjectTemplateService.applyTemplate(activeFormat, newName.trim(), newClient.trim() || undefined)
    if (!res.ok || !res.project) { toast(res.message ?? '套用失败', 'warn'); return }
    toast(res.message ?? '项目已创建')
    setApplyOpen(false)
    onApplied(res.project)
    onClose()
  }

  const saveFromProject = () => {
    if (!srcProjectId) { toast('请选择要生成模版的源项目', 'warn'); return }
    const res = ProjectTemplateService.generateFromProject(srcProjectId, tplName)
    if (!res.ok) { toast(res.message ?? '生成失败', 'warn'); return }
    toast(res.message ?? '已生成模版')
    setGenOpen(false)
    setTplName('')
    setRefreshKey((k) => k + 1)
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="项目模版（按业态配置与套用）" width={680}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] text-muted">业态</span>
            {formats.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFormat(f); setSelId('') }}
                className={cn('rounded-full border px-3 py-1 text-[12px] transition-colors', activeFormat === f ? 'border-accent bg-accent-soft text-accent font-semibold' : 'border-rule text-muted hover:border-accent/40')}
              >
                {f}
              </button>
            ))}
          </div>

          <p className="text-[11.5px] text-faint">切换业态即联动展示该业态的模版集；套用后自动新建项目并生成系统集与默认设计参数。</p>

          <div className="rounded-lg border border-rule">
            {list.length > 0 && (
              <div className="flex items-center justify-between border-b border-rule bg-surface-subtle/60 px-3 py-1.5">
                <span className="font-mono text-[10.5px] text-faint">{activeFormat} · {list.length} 个模版</span>
                <span className="font-mono text-[10.5px] text-faint">内置集为预置系统按业态生成</span>
              </div>
            )}
            {list.map((t) => {
              const isSel = t.id === (selId || list[0]?.id || '')
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelId(t.id)}
                  className={cn('flex w-full items-center gap-3 border-b border-rule px-3.5 py-2.5 text-left transition-colors last:border-b-0', isSel ? 'bg-accent-soft/40' : 'hover:bg-hover')}
                >
                  <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors', isSel ? 'border-accent bg-accent' : 'border-rule bg-surface')}>
                    {isSel && <span className="size-2 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[13px] font-medium">
                      {t.name}
                      <span className={cn('ml-2 rounded-full px-1.5 py-px text-[10px] font-semibold', t.builtin ? 'bg-accent-soft text-accent' : 'bg-accent2/15 text-accent2')}>{t.builtin ? '内置' : '自定义'}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-muted">{t.description}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-faint">{t.systems.map((s) => s.name).join(' · ') || '（空模版，可在创建后手动添加系统）'}</span>
                  </span>
                  {!t.builtin && (
                    <span
                      role="button"
                      tabIndex={0}
                      title="删除该业态模版"
                      onClick={(e) => { e.stopPropagation(); ProjectTemplateService.removeTemplate(t.id); setRefreshKey((k) => k + 1); toast('模版已删除', 'info') }}
                      className="rounded p-1 text-faint transition-colors hover:bg-hover hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </span>
                  )}
                </button>
              )
            })}
            {!list.length && <p className="px-4 py-6 text-center text-[12.5px] text-faint">该业态暂无模版，可先用「＋ 从项目生成模版」建立。</p>}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setGenOpen(true); setTplName(''); setSrcProjectId(currentProjectId ?? '') }}><Save className="size-3.5" />从项目生成模版</Button>
            <span className="text-[11px] text-faint">选择任一项目，将其（业态/系统集/设计参数/档次）存为该业态模版复用</span>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-rule pt-3">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={openApply}><LayoutTemplate className="size-4" />套用模版新建项目</Button>
        </div>
      </Modal>

      {/* 从项目生成模版 */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="从项目生成模版" width={460}>
        <div className="space-y-3">
          <Field label="源项目（选择要用其骨架的项目）" required>
            <Select value={srcProjectId} onChange={(e) => setSrcProjectId(e.target.value)}>
              <option value="">选择项目…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}（{p.project_type ?? '未设业态'}）</option>)}
            </Select>
          </Field>
          <Field label="模版名称（缺省用项目名）">
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="如：酒店-智慧客房加强版" />
          </Field>
          <p className="text-[12px] text-muted">生成内容：源项目的业态 + 全部系统集 + 各系统默认档次与设计参数。<br />套用该模版的新建项目将自动带同业态与系统骨架。</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGenOpen(false)}>取消</Button>
            <Button onClick={saveFromProject}><Check className="size-4" />生成模版</Button>
          </div>
        </div>
      </Modal>

      {/* 套用模版 → 新建项目表单 */}
      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title={`套用模版新建项目 · ${selectedTpl?.name ?? ''}`} footer={<><Button variant="outline" onClick={() => setApplyOpen(false)}>取消</Button><Button onClick={confirmApply}><Check className="size-4" />创建项目</Button></>}>
        <div className="space-y-3">
          <p className="rounded-md bg-accent-soft/30 px-3 py-2 text-[12px] text-accent">业态：{activeFormat} · 将自动生成 {selectedTpl?.systems.length ?? 0} 个子系统与默认设计参数</p>
          <Field label="项目名称" required>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：苏州XX酒店项目" />
          </Field>
          <Field label="业主（可选）">
            <Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="业主名称" />
          </Field>
        </div>
      </Modal>
    </>
  )
}