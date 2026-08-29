import { useState } from 'react'
import { FileText, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { useDB } from '../../../../db/memory-db'
import { DocumentService } from '../../../../services'
import type { Document } from '../../../../types/domain'
import { Button } from '../../../../components/ui/button'
import { Input, Textarea, Select, Field } from '../../../../components/ui/field'
import { Table, THead, TBody, TR, TH, TD } from '../../../../components/ui/table'
import { EmptyState } from '../../../../components/ui/empty'
import { toast } from '../../../../components/ui/toast'

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'design_note', label: '设计说明' },
  { value: 'device_list', label: '设备表' },
  { value: 'meeting', label: '会议纪要' },
  { value: 'note', label: '普通笔记' },
]

/** 文档 tab：项目文档轻量 CRUD（富文本在模块 07 接入 Tiptap） */
export function DocumentsTab({ projectId }: { projectId: string }) {
  useDB((s) => s.db)
  const [editing, setEditing] = useState<Document | 'new' | undefined>()
  const docs = DocumentService.listByProject(projectId)

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setEditing('new')}><Plus className="size-3.5" />新增文档</Button></div>

      {docs.length ? (
        <div className="rounded-lg border border-rule bg-surface">
          <Table>
            <THead><TR><TH>标题</TH><TH>类型</TH><TH>版本</TH><TH>状态</TH><TH>更新时间</TH><TH className="text-right">操作</TH></TR></THead>
            <TBody>
              {docs.map((d) => (
                <TR key={d.id} className="hover:bg-hover">
                  <TD className="font-medium">{d.title}</TD>
                  <TD className="text-muted">{DOC_TYPES.find((t) => t.value === d.type)?.label ?? d.type}</TD>
                  <TD className="font-mono text-[12px] text-muted">v{d.version}</TD>
                  <TD className="text-muted">{d.status === 'final' ? '定稿' : '草稿'}</TD>
                  <TD className="font-mono text-[12px] text-muted">{d.created_at?.slice(0, 10) ?? '—'}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <button type="button" className="rounded p-1 text-faint hover:text-accent" title="编辑" onClick={() => setEditing(d)}><Pencil className="size-3.5" /></button>
                      <button type="button" className="rounded p-1 text-faint hover:text-danger" title="删除" onClick={() => { DocumentService.remove(d.id); toast('文档已删除', 'info') }}><Trash2 className="size-3.5" /></button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-rule bg-surface shadow-sm">
          <EmptyState icon={<FileText />} title="还没有文档" description="新增设计说明 / 设备表 / 会议纪要" action={<Button size="sm" onClick={() => setEditing('new')}><Plus className="size-3.5" />新增文档</Button>} />
        </div>
      )}

      {(editing === 'new' || editing) && (
        <DocEditor
          projectId={projectId}
          doc={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}

function DocEditor({ projectId, doc, onClose }: { projectId: string; doc?: Document; onClose: () => void }) {
  const [title, setTitle] = useState(doc?.title ?? '')
  const [type, setType] = useState(doc?.type ?? 'note')
  const [content, setContent] = useState(doc?.content ?? '')
  const [status, setStatus] = useState(doc?.status ?? 'draft')

  const save = () => {
    if (!title.trim()) { toast('请输入标题', 'warn'); return }
    if (doc) {
      DocumentService.update(doc.id, { title: title.trim(), type, content, status })
      toast('文档已更新')
    } else {
      DocumentService.add(projectId, { title: title.trim(), type, content, status })
      toast('文档已创建')
    }
    onClose()
  }

  return (
    <div className="rounded-md border border-accent/30 bg-accent-soft/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold">{doc ? '编辑文档' : '新增文档'}</p>
        <button type="button" className="rounded p-1 text-faint hover:text-ink" onClick={onClose} aria-label="关闭"><X className="size-4" /></button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="标题" className="md:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="文档标题" /></Field>
        <Field label="类型"><Select value={type} onChange={(e) => setType(e.target.value)}>{DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
        <Field label="状态"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">草稿</option><option value="final">定稿</option></Select></Field>
        <Field label="内容（富文本将在知识模块接入）" className="md:col-span-4">
          <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="设计说明 / 纪要内容…" />
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}><Check className="size-3.5" />保存</Button>
      </div>
    </div>
  )
}