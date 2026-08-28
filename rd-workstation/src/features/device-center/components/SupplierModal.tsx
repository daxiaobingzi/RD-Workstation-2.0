import { useState } from 'react'
import type { Supplier } from '../../../types/domain'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'

/* ---------- R2：供应商管理 ---------- */
function SupplierModal({ open, onClose, selected, onEdit }: { open: boolean; onClose: () => void; selected?: Supplier; onEdit: (s: Supplier) => void }) {
  const [form, setForm] = useState<Partial<Supplier>>(() => selected ?? {})
  const [delConfirm, setDelConfirm] = useState(false)
  if (!open) return null
  const editing = !!selected
  const list = DeviceService.suppliers()
  const save = () => {
    if (!form.name?.trim()) { toast('请填写供应商名称', 'warn'); return }
    if (editing) DeviceService.updateSupplier(selected!.id, form)
    else DeviceService.addSupplier(form)
    toast(editing ? '供应商已更新' : '供应商已新增')
    onClose()
  }
  const remove = (s: Supplier) => {
    const r = DeviceService.removeSupplier(s.id)
    if (!r.ok) { toast(r.reason ?? '无法删除', 'error'); return }
    toast('供应商已删除', 'info')
  }
  const removeCurrent = () => {
    if (!delConfirm) {
      setDelConfirm(true)
      window.setTimeout(() => setDelConfirm(false), 2500)
      return
    }
    remove(selected!)
    setDelConfirm(false)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="供应商管理" width={560} footer={
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setForm({}); onEdit({} as Supplier) }}>新增</Button>
        {editing && <Button size="sm" variant="danger" onClick={removeCurrent}>{delConfirm ? '再次点击确认删除' : '删除'}</Button>}
        <Button size="sm" onClick={save}>{editing ? '保存修改' : '新增'}</Button>
      </div>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="联系人"><Input value={form.contact ?? ''} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
        <Field label="联系电话"><Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="地区"><Input value={form.region ?? ''} onChange={(e) => setForm({ ...form, region: e.target.value })} /></Field>
        <Field label="备注"><Input value={form.remark ?? ''} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></Field>
      </div>
      <div className="mt-3 border-t border-rule pt-3">
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">供应商列表（{list.length}）</p>
        <ul className="space-y-1">
          {list.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-md border border-rule px-2.5 py-1.5 text-[12.5px]">
              <span className="font-medium">{s.name}</span>
              <span className="text-[11px] text-muted">{s.contact} · {s.region}</span>
              <Button size="xs" variant="outline" onClick={() => { setForm(s); onEdit(s) }}>编辑</Button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

export default SupplierModal