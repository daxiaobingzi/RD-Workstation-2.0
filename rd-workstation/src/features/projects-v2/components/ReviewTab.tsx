import { useState } from 'react'
import { NotebookPen, Trash2, Trophy, AlertCircle, ArrowUpRight } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { DocumentService, TaskService, BillService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Textarea, Field, Select } from '../../../components/ui/field'
import { EmptyState } from '../../../components/ui/empty'
import { toast } from '../../../components/ui/toast'

/** 复盘 tab（v2 迁移自旧版）：记录项目收尾总结，沉淀为文档 type=review_record */
export function ReviewTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  useDB((s) => s.db)
  const [win, setWin] = useState('')
  const [issue, setIssue] = useState('')
  const [improve, setImprove] = useState('')
  const [score, setScore] = useState('8')

  const reviews = DocumentService.listReviews(projectId)
  const doneTasks = TaskService.list({ projectId }).filter((t) => t.status === 'done').length
  const billCount = BillService.versions(projectId).length

  const submit = () => {
    if (!win.trim() && !issue.trim() && !improve.trim()) { toast('请至少填写一项内容', 'warn'); return }
    const content = [
      win.trim() && `【做得好的】${win.trim()}`,
      issue.trim() && `【遇到的问题】${issue.trim()}`,
      improve.trim() && `【待改进】${improve.trim()}`,
      `完成度自评：${score}/10 · 完成任务 ${doneTasks} 个 · 清单 ${billCount} 版`,
    ].filter(Boolean).join('\n')
    DocumentService.add(projectId, {
      type: 'review_record',
      title: `复盘 · ${new Date().toLocaleDateString('zh-CN')} · ${projectName}`,
      content,
      status: 'final',
    })
    toast('复盘已保存')
    setWin(''); setIssue(''); setImprove('')
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 复盘输入 */}
      <div className="rounded-lg border border-rule bg-surface p-3.5 shadow-sm">
        <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold">
          <NotebookPen className="size-4 text-accent" />项目复盘
        </p>
        <div className="space-y-3">
          <Field label="做得好的"><Textarea rows={2} value={win} onChange={(e) => setWin(e.target.value)} placeholder="设计流程 / 选型 / 清单预算 中顺利的部分…" /></Field>
          <Field label="遇到的问题"><Textarea rows={2} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="中途的返工 / 缺价 / 误判…" /></Field>
          <Field label="待改进"><Textarea rows={2} value={improve} onChange={(e) => setImprove(e.target.value)} placeholder="下次项目要避免的…" /></Field>
          <div className="flex items-end gap-3">
            <Field label="完成度自评"><Select value={score} onChange={(e) => setScore(e.target.value)} className="w-24">
              {['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'].map((s) => <option key={s} value={s}>{s}/10</option>)}
            </Select></Field>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11.5px] text-faint">完成任务 {doneTasks} · 清单 {billCount} 版</span>
              <Button size="sm" onClick={submit}>保存复盘</Button>
            </div>
          </div>
        </div>
      </div>

      {/* 历史复盘列表 */}
      <div className="rounded-lg border border-rule bg-surface shadow-sm">
        <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
          <NotebookPen className="size-4 text-accent2" />
          <h3 className="text-[13px] font-semibold">历史复盘</h3>
          <span className="ml-auto font-mono text-[11px] text-faint">{reviews.length}</span>
        </div>
        <ul className="divide-y divide-rule">
          {reviews.map((r) => (
            <li key={r.id} className="group flex items-start gap-2 px-3.5 py-2.5">
              <div className="flex-1">
                <p className="text-[12.5px] font-medium">{r.title}</p>
                <p className="mt-0.5 whitespace-pre-line text-[12px] text-muted">{r.content}</p>
                <p className="mt-1 font-mono text-[10.5px] text-faint">{r.created_at?.slice(0, 16).replace('T', ' ')}</p>
              </div>
              <button type="button" className="rounded p-1 opacity-0 text-faint transition-opacity group-hover:opacity-100 hover:text-danger" title="删除复盘" onClick={() => { DocumentService.remove(r.id); toast('复盘已删除', 'info') }}><Trash2 className="size-3.5" /></button>
            </li>
          ))}
          {!reviews.length && <li className="py-10 text-center text-[12.5px] text-faint"><EmptyState icon={<Trophy />} title="还没有复盘" description="项目收尾时记录经验，复盘会沉淀为知识" /></li>}
        </ul>
      </div>

      <p className="flex items-center gap-1 text-[11.5px] text-faint lg:col-span-2">
        <ArrowUpRight className="size-3" />复盘记录保存在项目文档中（type=复盘），后续知识模块会自动归入"历史项目经验"。
      </p>
      <AlertCircle className="hidden" />
    </div>
  )
}