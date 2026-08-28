import { useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T, type Point } from '../../../types/domain'
import { PointService, DesignService } from '../../../services'
import { PointImportDialog } from '../importers/PointImport'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../../components/ui/table'
import { EmptyState } from '../../../components/ui/empty'
import { toast } from '../../../components/ui/toast'
import { fmtNum } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

export function PointsStep({ psId, points }: { psId: string; points: Point[] }) {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [cat, setCat] = useState('all')
  const [form, setForm] = useState<Partial<Point>>({ quantity: 1, unit: '台' })
  const cats = PointService.categories('sys_vss')
  const filtered = cat === 'all' ? points : points.filter((p) => p.category_id === cat)
  const total = points.reduce((s, p) => s + (p.quantity || 0), 0)

  const add = () => {
    if (!form.point_name) {
      toast('请填写点位名称', 'warn')
      return
    }
    PointService.add(psId, { ...form, category_id: form.category_id || cats[0]?.id })
    toast(`已添加点位「${form.point_name}」`)
    setOpen(false)
    setForm({ quantity: 1, unit: '台' })
  }

  const onImported = (n: number) => {
    if (n > 0) {
      useDB.getState().update(T.project_systems, psId, { progress: DesignService.progress(psId), updated_at: new Date().toISOString() })
    }
    setImportOpen(false)
  }

  return (
    <StepCard title="点位录入" desc={`共 ${points.length} 类点位，合计 ${fmtNum(total)} 台摄像机`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="h-7 w-32 text-[12px]">
            <option value="all">全部类别</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="size-3.5" />批量导入
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5" />添加点位</Button>
        </div>
      </div>
      <div className="overflow-auto rounded-md border border-rule">
        <Table>
          <THead><TR><TH>编号</TH><TH>名称</TH><TH>类别</TH><TH>楼层</TH><TH>位置</TH><TH>数量</TH><TH></TH></TR></THead>
          <TBody>
            {filtered.map((p) => (
              <TR key={p.id} className="hover:bg-hover">
                <TD><NumCell>{p.point_code}</NumCell></TD>
                <TD className="font-medium">{p.point_name}</TD>
                <TD className="text-muted">{cats.find((c) => c.id === p.category_id)?.name ?? '—'}</TD>
                <TD className="text-muted">{p.floor}</TD>
                <TD className="text-muted">{p.space}</TD>
                <TD><NumCell>{fmtNum(p.quantity)}</NumCell></TD>
                <TD className="text-right">
                  <button type="button" className="rounded p-1 text-faint hover:bg-danger-soft hover:text-danger" onClick={() => { PointService.remove(p.id); toast('点位已删除', 'info') }} aria-label="删除">
                    <Trash2 className="size-3.5" />
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!filtered.length && (
          <EmptyState icon={<Plus />} title={cat === 'all' ? '还没有点位' : '该类别暂无点位'} description="添加点位或切换筛选" action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5" />添加点位</Button>} />
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-md border border-accent/30 bg-accent-soft/40 p-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="点位名称" required><Input value={form.point_name ?? ''} onChange={(e) => setForm({ ...form, point_name: e.target.value })} placeholder="如：大厅高清枪机" /></Field>
            <Field label="类别">
              <Select value={form.category_id ?? cats[0]?.id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="楼层"><Input value={form.floor ?? ''} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="1F" /></Field>
            <Field label="位置"><Input value={form.space ?? ''} onChange={(e) => setForm({ ...form, space: e.target.value })} placeholder="大堂" /></Field>
            <Field label="数量"><Input type="number" value={form.quantity ?? 1} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })} /></Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button size="sm" onClick={add}>确认添加</Button>
          </div>
        </div>
      )}

      <PointImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        psId={psId}
        categories={cats}
        onImported={onImported}
      />
    </StepCard>
  )
}