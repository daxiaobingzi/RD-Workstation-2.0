import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { DeviceService, DEVICE_SYSTEMS, DEVICE_CATEGORIES } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Select, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'
import { RichTextEditor } from '../../../components/ui/rich-text'
import { GRADE_LABEL } from '../device-center.types'

interface RowForm {
  brandId?: string
  model: string
  gradeCode?: string
  refPrice?: string
  detailHtml?: string
}

/* ---------- 新增设备：设备（名称/通用参数/单位）+ 品牌型号配置行（品牌/型号/详细参数/档次/参考价）一次添加 ---------- */
function DeviceFormModal({ open, onClose, defaultSystemId, onDone }: { open: boolean; onClose: () => void; defaultSystemId?: string; onDone?: (productId: string) => void }) {
  const [form, setForm] = useState(() => ({
    system_id: defaultSystemId ?? 'sys_vss',
    category: 'front',
    name: '',
    generic: '',
    unit: '台',
  }))
  const [rows, setRows] = useState<RowForm[]>([{ model: '' }])
  const brands = DeviceService.brands()

  const save = () => {
    if (!form.name.trim()) { toast('请填写设备名称', 'warn'); return }
    const validRows = rows.filter((r) => r.model.trim())
    if (!validRows.length) { toast('请至少添加一条品牌型号配置行', 'warn'); return }
    const dev = DeviceService.addDeviceType({
      name: form.name.trim(), system_id: form.system_id, category: form.category,
      specification: form.generic || undefined, unit: form.unit,
    })
    validRows.forEach((r) => {
      const created = DeviceService.addModel({
        product_id: dev.id, model: r.model.trim(), unit: form.unit,
        grade_code: r.gradeCode || undefined, detail_html: r.detailHtml || undefined, brand_id: r.brandId || undefined,
      })
      const p = Number(r.refPrice)
      if (created && p > 0) DeviceService.setPrice(created.id, 'reference', p, { source: '设备中心' })
    })
    toast(`设备「${form.name.trim()}」已创建（${validRows.length} 条配置行）`, 'success')
    onClose()
    onDone?.(dev.id)
  }

  const setRow = (i: number, patch: Partial<RowForm>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <Modal open={open} onClose={onClose} title="新增设备" width={760}>
      <div className="space-y-4">
        {/* 设备区 */}
        <div className="rounded-md border border-rule p-3">
          <p className="mb-2 text-[10.5px] font-semibold tracking-wide text-faint uppercase">设备（通用参数/单位/归属）</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="子系统" required>
              <Select value={form.system_id} onChange={(e) => setForm({ ...form, system_id: e.target.value })} className="h-7 text-[12px]">
                {DEVICE_SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="类别" required>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-7 text-[12px]">
                {DEVICE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_120px] gap-3">
            <Field label="设备名称" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 高清枪型摄像机" className="h-7 text-[12px]" />
            </Field>
            <Field label="单位">
              <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-7 text-[12px]">
                {['台', '套', '块', '箱', '米', '根', '个', '只', '座', '把'].map((u) => <option key={u}>{u}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="通用参数（富文本）">
              <RichTextEditor value={form.generic} onChange={(html) => setForm({ ...form, generic: html })} height={120} placeholder="输入设备的通用参数，如图像/夜视/防护能力等…" />
            </Field>
          </div>
        </div>

        {/* 配置行使 */}
        <div className="rounded-md border border-rule p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10.5px] font-semibold tracking-wide text-faint uppercase">品牌型号配置行</p>
            <Button size="xs" variant="outline" onClick={() => setRows([...rows, { model: '' }])}><Plus className="size-3" />添加配置行</Button>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="space-y-1.5 rounded-md bg-surface-subtle/40 p-2">
                <div className="grid grid-cols-[1fr_1fr_90px_90px_32px] gap-1.5">
                  <Select value={r.brandId ?? ''} onChange={(e) => setRow(i, { brandId: e.target.value || undefined })} className="h-7 text-[12px]">
                    <option value="">品牌</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                  <Input value={r.model} onChange={(e) => setRow(i, { model: e.target.value })} placeholder="型号，如 DS-2CD2346" className="h-7 text-[12px]" />
                  <Select value={r.gradeCode ?? ''} onChange={(e) => setRow(i, { gradeCode: e.target.value || undefined })} className="h-7 text-[12px]">
                    <option value="">档次</option>
                    {Object.entries(GRADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                  <Input type="number" min={0} value={r.refPrice} onChange={(e) => setRow(i, { refPrice: e.target.value })} placeholder="参考价" className="h-7 text-[12px]" />
                  <button type="button" className="flex items-center justify-center rounded text-faint hover:bg-hover hover:text-danger" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} title="删除配置行"><Trash2 className="size-3.5" /></button>
                </div>
                <RichTextEditor value={r.detailHtml ?? ''} onChange={(html) => setRow(i, { detailHtml: html })} height={90} placeholder={`${r.model || '该型号'}的详细参数（供应商实际参数）…`} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>确认新增</Button>
      </div>
    </Modal>
  )
}

export default DeviceFormModal