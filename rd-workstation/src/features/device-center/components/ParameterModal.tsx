import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ProductModel } from '../../../types/domain'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Select, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { toast } from '../../../components/ui/toast'

/* ---------- 参数双击编辑（规格 / 单位 / 参数键值） ---------- */
function ParameterModal({ open, onClose, model }: { open: boolean; onClose: () => void; model?: ProductModel }) {
  const [spec, setSpec] = useState(model?.specification ?? '')
  const [unit, setUnit] = useState(model?.unit ?? '台')
  const [params, setParams] = useState<{ k: string; v: string }[]>(() =>
    Object.entries((model?.parameter_json ?? {}) as Record<string, unknown>).map(([k, v]) => ({ k, v: String(v) })),
  )
  if (!open || !model) return null
  const save = () => {
    const parameter_json: Record<string, unknown> = {}
    params.filter((p) => p.k.trim()).forEach((p) => { parameter_json[p.k.trim()] = p.v.trim() || true })
    DeviceService.updateModel(model.id, { specification: spec, unit, parameter_json })
    toast(`「${model.model}」参数已保存`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={`编辑参数：${model.model}`} width={520}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="规格">
            <Input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="如 4MP 星光半球" />
          </Field>
          <Field label="单位">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {['台', '套', '块', '箱', '米', '根', '个'].map((u) => <option key={u}>{u}</option>)}
            </Select>
          </Field>
        </div>
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
        <Button size="sm" onClick={save}>保存参数</Button>
      </div>
    </Modal>
  )
}

export default ParameterModal