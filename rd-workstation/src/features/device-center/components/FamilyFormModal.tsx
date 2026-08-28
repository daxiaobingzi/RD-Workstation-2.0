import { useState } from 'react'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'

function FamilyFormModal({ open, onClose, categoryId, onDone }: { open: boolean; onClose: () => void; categoryId: string; onDone: (id: string) => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  if (!open) return null
  const save = () => {
    if (!name.trim()) { toast('请填写产品族名称', 'warn'); return }
    const f = DeviceService.addFamily({ device_category_id: categoryId, name: name.trim(), code: code.trim() || undefined })
    toast('产品族已新增')
    onDone(f.id)
  }
  return (
    <Modal open={open} onClose={onClose} title="新增产品族" width={380}>
      <div className="space-y-3">
        <Field label="产品族名称" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 门禁控制器" /></Field>
        <Field label="编码（可选）"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="如 acs_controller" /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>确认新增</Button>
      </div>
    </Modal>
  )
}

export default FamilyFormModal