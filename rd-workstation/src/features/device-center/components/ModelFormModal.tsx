import { useState } from 'react'
import { DeviceService } from '../../../services'
import type { ProductModel } from '../../../types/domain'
import { Button } from '../../../components/ui/button'
import { Input, Select, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'
import { RichTextEditor } from '../../../components/ui/rich-text'
import { GRADE_LABEL } from '../device-center.types'

/* ---------- 品牌型号配置行：编辑/新增（设备类型下） ---------- */
function ModelFormModal({
  open, onClose, model, defaultProductId, defaultSystemId,
}: { open: boolean; onClose: () => void; model?: ProductModel; defaultProductId?: string; defaultSystemId?: string }) {
  const [form, setForm] = useState<ModelFormState>(() => seedModelForm(model, defaultProductId))
  const [detail, setDetail] = useState<string>(model?.detail_html ?? '')

  if (!open) return null
  const editing = !!model
  const types = DeviceService.deviceTypes({ systemId: defaultSystemId })
  const brands = DeviceService.brands()

  const save = () => {
    if (!form.model.trim()) { toast('请填写型号名称', 'warn'); return }
    if (!editing && !form.product_id) { toast('请选择设备类型', 'warn'); return }
    const refPrice = Number(form.refPrice)
    if (editing) {
      DeviceService.updateModel(model!.id, { model: form.model, unit: form.unit, status: form.status, detail_html: detail })
      DeviceService.setModelDefaultGrade(model!.id, form.grade_code || undefined)
      DeviceService.setModelBrand(model!.id, form.brand_id || undefined)
      if (refPrice > 0) DeviceService.setPrice(model!.id, 'reference', refPrice, { source: '设备中心' })
      toast('型号已更新')
    } else {
      const created = DeviceService.addModel({
        product_id: form.product_id, model: form.model, unit: form.unit,
        grade_code: form.grade_code || undefined, status: 'active',
        detail_html: detail || undefined, brand_id: form.brand_id || undefined,
      })
      if (created && refPrice > 0) DeviceService.setPrice(created.id, 'reference', refPrice, { source: '设备中心' })
      toast('型号已新增')
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `编辑型号：${model!.model}` : '新增型号'} width={620}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="设备类型" required>
            <Select value={form.product_id ?? ''} disabled={editing} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="h-7 text-[12px]">
              {types.map((dt) => <option key={dt.product.id} value={dt.product.id}>{dt.product.name}</option>)}
            </Select>
          </Field>
          <Field label="品牌">
            <Select value={form.brand_id ?? ''} onChange={(e) => setForm({ ...form, brand_id: e.target.value || undefined })} className="h-7 text-[12px]">
              <option value="">未指定</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="型号名称" required>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="如 DS-2CD2346" className="h-7 text-[12px]" />
          </Field>
          <Field label="参考价">
            <Input type="number" min={0} step="0.01" value={form.refPrice} onChange={(e) => setForm({ ...form, refPrice: e.target.value })} placeholder="元（推导采用）" className="h-7 text-[12px]" />
          </Field>
          <Field label="档次">
            <Select value={form.grade_code ?? ''} onChange={(e) => setForm({ ...form, grade_code: e.target.value || undefined })} className="h-7 text-[12px]">
              <option value="">未设定</option>
              {Object.entries(GRADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="状态">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'disabled' })} className="h-7 text-[12px]">
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </Select>
          </Field>
        </div>
        <Field label="详细参数（富文本：供应商该型号实际参数）">
          <RichTextEditor value={detail} onChange={setDetail} height={150} placeholder="输入该型号的详细参数：传感器/镜头/夜视/供电/接口等…" />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>{editing ? '保存修改' : '确认新增'}</Button>
      </div>
    </Modal>
  )
}

interface ModelFormState {
  product_id?: string
  model: string
  unit: string
  grade_code?: string
  status: 'active' | 'disabled'
  brand_id?: string
  refPrice: string
}

function seedModelForm(model?: ProductModel, defaultProductId?: string): ModelFormState {
  if (model) {
    return {
      product_id: model.product_id, model: model.model, unit: model.unit ?? '台',
      grade_code: model.grade_code, status: model.status ?? 'active',
      brand_id: DeviceService.brandOf(model.id).id,
      refPrice: DeviceService.price(model.id) > 0 ? String(DeviceService.price(model.id)) : '',
    }
  }
  return { product_id: defaultProductId, model: '', unit: '台', grade_code: undefined, status: 'active', brand_id: undefined, refPrice: '' }
}

export default ModelFormModal