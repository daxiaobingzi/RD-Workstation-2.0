import { useState } from 'react'
import type { DeviceCategory } from '../../../types/domain'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Select, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'
import { SYSTEM_GROUPS } from '../device-center.types'

/* ---------- 类别 / 产品族 新增 ---------- */
function CategoryFormModal({ open, onClose, onDone, categories }: { open: boolean; onClose: () => void; onDone: (id: string) => void; categories: DeviceCategory[] }) {
  const [name, setName] = useState('')
  const [sysId, setSysId] = useState('sys_vss')
  if (!open) return null
  const save = () => {
    if (!name.trim()) { toast('请填写类别名称', 'warn'); return }
    const c = DeviceService.addCategory({ name: name.trim(), system_id: sysId, code: name.trim(), category_type: name.trim() })
    toast('类别已新增')
    onDone(c.id)
  }
  return (
    <Modal open={open} onClose={onClose} title="新增设备类别" width={420}>
      <div className="space-y-3">
        <Field label="类别名称" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 中控台" /></Field>
        <Field label="归属系统（弱电智能化系统目录，P2）">
          <Select value={sysId} onChange={(e) => setSysId(e.target.value)}>
            {Object.entries(SYSTEM_GROUPS).filter(([k]) => k !== '__other').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="__other">通用（跨系统）</option>
          </Select>
        </Field>
        <p className="text-[11.5px] text-faint">现有类别：{categories.map((c) => c.name).join('、')}</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>确认新增</Button>
      </div>
    </Modal>
  )
}

export default CategoryFormModal