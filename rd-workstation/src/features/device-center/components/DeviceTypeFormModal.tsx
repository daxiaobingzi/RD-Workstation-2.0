import { useState } from 'react'
import { DeviceService, DEVICE_SYSTEMS, DEVICE_CATEGORIES } from '../../../services'
import type { Product } from '../../../types/domain'
import { Button } from '../../../components/ui/button'
import { Input, Select, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'
import { RichTextEditor } from '../../../components/ui/rich-text'

/* ---------- 编辑设备类型（通用参数/归属）---------- */
function DeviceTypeFormModal({
  open, onClose, product,
}: { open: boolean; onClose: () => void; product?: Product }) {
  const [form, setForm] = useState(() => ({
    system_id: product?.system_id ?? 'sys_vss',
    category: product?.category ?? 'front',
    name: product?.name ?? '',
    generic: product?.specification ?? '',
    unit: product?.unit ?? '台',
  }))

  if (!open) return null

  const save = () => {
    if (!form.name.trim()) { toast('请填写设备名称', 'warn'); return }
    if (!product) return
    DeviceService.updateDeviceType(product.id, {
      name: form.name.trim(), specification: form.generic || undefined, unit: form.unit || undefined,
      system_id: form.system_id, category: form.category,
    })
    toast('设备类型已更新')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`编辑设备类型：${product?.name ?? ''}`} width={640}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="子系统" required>
            <Select value={form.system_id} disabled onChange={(e) => setForm({ ...form, system_id: e.target.value })} className="h-7 text-[12px]">
              {DEVICE_SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="类别" required>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-7 text-[12px]">
              {DEVICE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="设备名称" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-7 text-[12px]" />
          </Field>
          <Field label="单位">
            <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-7 text-[12px]">
              {['台', '套', '块', '箱', '米', '根', '个', '只', '座', '把'].map((u) => <option key={u}>{u}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="通用参数（富文本）">
          <RichTextEditor value={form.generic} onChange={(html) => setForm({ ...form, generic: html })} height={150} placeholder="设备的通用参数，如图像/夜视/防护能力等…" />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>保存修改</Button>
      </div>
    </Modal>
  )
}

export default DeviceTypeFormModal