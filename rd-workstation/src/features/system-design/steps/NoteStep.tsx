import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { PointService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { toast } from '../../../components/ui/toast'
import { StepCard } from '../panels/StepCard'

export function NoteStep({ project, system }: { project: { name: string }; system: { code: string; name: string } }) {
  const cameras = PointService.list(useDB.getState().getTable<{ id: string }>(T.project_systems).find((s) => s.id === 'ps_vss_001')?.id ?? '')
  void cameras
  return (
    <StepCard title="设计说明" desc="自动生成设计说明草稿（可编辑）">
      <textarea
        className="h-48 w-full rounded-md border border-rule bg-surface p-3 text-[13px] focus-visible:ring-2 focus-visible:ring-accent/30"
        defaultValue={`一、工程概况\n本项目为${project.name}弱电智能化设计，包含视频监控系统。\n\n二、系统设计\n${system.name}（${system.code}）设计采用 H.265 编码、30 天存储，点位按楼层/区域分布，设备按标准档选型。\n\n三、设备构成\n摄像机 → POE 交换机 → 汇聚交换机 → NVR → 硬盘。`}
      />
      <div className="mt-3 flex justify-end"><Button size="sm" onClick={() => toast('设计说明已保存（草稿）')}>保存说明</Button></div>
    </StepCard>
  )
}