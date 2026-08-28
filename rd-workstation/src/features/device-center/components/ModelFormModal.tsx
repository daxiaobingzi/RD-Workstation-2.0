import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T, type ProductModel } from '../../../types/domain'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Select, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'
import { GRADE_LABEL } from '../device-center.types'

/* ---------- 型号表单 ---------- */
function ModelFormModal({ open, onClose, model, defaultFamilyId }: { open: boolean; onClose: () => void; model?: ProductModel; defaultFamilyId?: string }) {
  const [form, setForm] = useState(() => seedModelForm(model, defaultFamilyId))
  const [params, setParams] = useState<{ k: string; v: string }[]>(() =>
    Object.entries((model?.parameter_json ?? {}) as Record<string, unknown>).map(([k, v]) => ({ k, v: String(v) })),
  )

  if (!open) return null
  const editing = !!model
  const families = DeviceService.families()

  const save = () => {
    if (!form.model.trim() || !form.product_family_id) {
      toast('请填写型号名称与所属产品族', 'warn')
      return
    }
    const parameter_json: Record<string, unknown> = {}
    params.filter((p) => p.k.trim()).forEach((p) => { parameter_json[p.k.trim()] = p.v.trim() || true })
    if (editing) {
      DeviceService.updateModel(model!.id, {
        model: form.model, specification: form.specification, unit: form.unit, status: form.status, parameter_json,
      })
      // 主档统一入口：同时写绑定表与 grade_code（引擎以绑定表优先）
      DeviceService.setModelDefaultGrade(model!.id, form.grade_code || undefined)
      DeviceService.setModelBrand(model!.id, form.brand_id || undefined)
      toast('型号已更新')
    } else {
      DeviceService.addModel({ product_family_id: form.product_family_id, model: form.model, specification: form.specification, unit: form.unit, grade_code: form.grade_code || undefined, status: 'active', parameter_json, brand_id: form.brand_id || undefined })
      toast('型号已新增')
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `编辑型号：${model!.model}` : '新增型号'} width={560}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="型号名称" required>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="如 DS-2CD2346" />
          </Field>
          <Field label="所属产品族" required>
            <Select
              value={form.product_family_id}
              disabled={editing}
              onChange={(e) => setForm({ ...form, product_family_id: e.target.value })}
            >
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </Field>
          <Field label="品牌">
            <Select value={form.brand_id ?? ''} onChange={(e) => setForm({ ...form, brand_id: e.target.value || undefined })}>
              <option value="">未指定</option>
              {DeviceService.brands().map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="单位">
            <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {['台', '套', '块', '箱', '米', '根', '个'].map((u) => <option key={u}>{u}</option>)}
            </Select>
          </Field>
          <Field label="档次">
            <Select value={form.grade_code ?? ''} onChange={(e) => setForm({ ...form, grade_code: e.target.value || undefined })}>
              <option value="">未设定</option>
              {Object.entries(GRADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="状态">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'disabled' })}>
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </Select>
          </Field>
        </div>
        <Field label="规格">
          <Input value={form.specification ?? ''} onChange={(e) => setForm({ ...form, specification: e.target.value })} placeholder="如 4MP 星光半球" />
        </Field>
        <Field label="技术参数（键值对，如 分辨率=4MP）">
          <div className="space-y-1.5">
            {params.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={p.k} onChange={(e) => setParams(params.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} placeholder="参数名" className="h-7 flex-1 text-[12px]" />
                <Input value={p.v} onChange={(e) => setParams(params.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} placeholder="值" className="h-7 flex-1 text-[12px]" />
                <button type="button" className="rounded p-1 text-faint hover:text-danger" onClick={() => setParams(params.filter((_, j) => j !== i))}><X className="size-3.5" /></button>
              </div>
            ))}
            <Button size="xs" variant="outline" onClick={() => setParams([...params, { k: '', v: '' }])}><Plus className="size-3" />添加参数</Button>
          </div>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>{editing ? '保存修改' : '确认新增'}</Button>
      </div>
    </Modal>
  )
}

function seedModelForm(model?: ProductModel, defaultFamilyId?: string) {
  if (model) {
    const famId = (useDB.getState().getTable<{ id: string; product_family_id: string }>(T.products).find((p) => p.id === model.product_id)?.product_family_id) ?? ''
    return { product_family_id: famId, model: model.model, specification: model.specification ?? '', unit: model.unit ?? '台', grade_code: model.grade_code, status: model.status ?? 'active', brand_id: DeviceService.brandOf(model.id).id }
  }
  return { product_family_id: defaultFamilyId ?? '', model: '', specification: '', unit: '台', grade_code: undefined as string | undefined, status: 'active' as const, brand_id: undefined as string | undefined }
}

export default ModelFormModal