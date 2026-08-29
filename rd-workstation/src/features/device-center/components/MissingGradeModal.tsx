import { Plus } from 'lucide-react'
import { DeviceService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/dialog'

/* ---------- 缺档明细（设备类型 × 档位） ---------- */
function MissingGradeModal({ open, onClose, stats, onGoto }: { open: boolean; onClose: () => void; stats: ReturnType<typeof DeviceService.stats>; onGoto: (deviceTypeId: string) => void }) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={`缺档组合（${stats.missingGrade.length}）`} width={460}>
      <p className="-mt-1 mb-2 text-[12px] text-muted">以下「设备类型 × 档次」没有可用型号，推导时会被回退到其他档。</p>
      <ul className="space-y-1">
        {stats.missingGrade.map((g) => (
          <li key={`${g.deviceTypeId}-${g.grade}`} className="flex items-center justify-between rounded-md border border-rule px-3 py-2 text-[12.5px]">
            <span><b>{g.deviceTypeName}</b> <span className="text-muted">缺</span> {g.gradeLabel}</span>
            <Button size="xs" variant="outline" onClick={() => onGoto(g.deviceTypeId)}><Plus className="size-3" />补型号</Button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export default MissingGradeModal