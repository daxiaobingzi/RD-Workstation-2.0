import { useState } from 'react'
import { SystemService } from '../../../services'
import { Field, Input, Select } from '../../../components/ui/field'
import { Button } from '../../../components/ui/button'
import { toast } from '../../../components/ui/toast'
import { StepCard } from '../panels/StepCard'

export function ParamsStep({ psId, params }: { psId: string; params: ReturnType<typeof SystemService.params> }) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(params.map((p) => [p.parameter_key, String(p.value_json)])),
  )
  const save = () => {
    SystemService.setParam(psId, 'resolution', '分辨率', Number(form.resolution) || 4, 'MP')
    SystemService.setParam(psId, 'bitrate_mbps', '码流', Number(form.bitrate_mbps) || 4, 'Mbps')
    SystemService.setParam(psId, 'storage_days', '存储天数', Number(form.storage_days) || 30, '天')
    SystemService.setParam(psId, 'codec', '编码', form.codec || 'H.265')
    toast('设计参数已保存')
  }
  return (
    <StepCard title="设计参数" desc="系统设计的关键输入，改动后重新推导即更新结果">
      <div className="grid max-w-xl grid-cols-2 gap-3">
        <Field label="分辨率 (MP)">
          <Input type="number" value={form.resolution ?? '4'} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
        </Field>
        <Field label="码流 (Mbps)">
          <Input type="number" value={form.bitrate_mbps ?? '4'} onChange={(e) => setForm({ ...form, bitrate_mbps: e.target.value })} />
        </Field>
        <Field label="存储天数">
          <Input type="number" value={form.storage_days ?? '30'} onChange={(e) => setForm({ ...form, storage_days: e.target.value })} />
        </Field>
        <Field label="编码">
          <Select value={form.codec ?? 'H.265'} onChange={(e) => setForm({ ...form, codec: e.target.value })}>
            <option>H.265</option><option>H.264</option>
          </Select>
        </Field>
      </div>
      <Button className="mt-4" onClick={save}>保存参数</Button>
    </StepCard>
  )
}