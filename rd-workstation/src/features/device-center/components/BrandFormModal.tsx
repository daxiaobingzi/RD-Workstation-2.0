import { useState } from 'react'
import type { Brand } from '../../../types/domain'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Select, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'

/* ---------- 品牌表单 ---------- */
function BrandFormModal({ open, onClose, brand }: { open: boolean; onClose: () => void; brand?: Brand }) {
  const [name, setName] = useState(brand?.name ?? '')
  const [type, setType] = useState(brand?.manufacturer_type ?? 'domestic')
  if (!open) return null
  const editing = !!brand
  const save = () => {
    if (!name.trim()) { toast('请填写品牌名称', 'warn'); return }
    if (editing) DeviceService.updateBrand(brand!.id, { name: name.trim(), manufacturer_type: type })
    else DeviceService.addBrand({ name: name.trim(), manufacturer_type: type })
    toast(editing ? '品牌已更新' : '品牌已新增')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? `编辑品牌：${brand!.name}` : '新增品牌'} width={380}>
      <div className="space-y-3">
        <Field label="品牌名称" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="厂商类型">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="domestic">国产</option>
            <option value="foreign">进口</option>
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>{editing ? '保存' : '确认新增'}</Button>
      </div>
    </Modal>
  )
}

export default BrandFormModal