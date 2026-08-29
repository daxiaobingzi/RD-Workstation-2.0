import { AlertTriangle } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/dialog'

/* ---------- 设备删除被引用提示：列出 哪款品牌型号被哪些项目使用 ---------- */
export interface DeviceInUseEntry {
  model: string
  brand: string
  projectNames: string[]
}

function DeviceInUseModal({ open, onClose, deviceName, entries }: { open: boolean; onClose: () => void; deviceName?: string; entries: DeviceInUseEntry[] }) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title="无法删除：设备被项目引用" width={520}>
      <p className="-mt-1 mb-2 flex items-start gap-1.5 text-[12px] text-muted">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
        设备「{deviceName ?? ''}」下有以下品牌型号已被项目选型/清单引用，请先改用其他设备或停用这些型号后再删除。
      </p>
      <ul className="max-h-[42vh] space-y-1.5 overflow-y-auto">
        {entries.map((e) => (
          <li key={e.model} className="rounded-md border border-rule px-3 py-2 text-[12.5px]">
            <span className="font-medium">{e.brand || '无品牌'} <span className="font-mono text-muted">{e.model}</span></span>
            <span className="ml-2 text-faint">被引用项目：</span>
            <span className="text-muted">{e.projectNames.length ? e.projectNames.join('、') : '（其他项目引用）'}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={onClose}>知道了</Button>
      </div>
    </Modal>
  )
}

export default DeviceInUseModal