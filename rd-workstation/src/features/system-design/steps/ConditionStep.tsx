import { fmtNum } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

export function ConditionStep({ project }: { project: { name: string; building_type?: string; building_area?: number; floor_count?: number; client_name?: string; design_stage?: string } }) {
  const rows = [
    ['项目名称', project.name],
    ['建筑类型', project.building_type],
    ['建筑面积', `${fmtNum(project.building_area)} ㎡`],
    ['层数', `${fmtNum(project.floor_count)} 层`],
    ['业主', project.client_name],
    ['设计阶段', project.design_stage],
  ]
  return (
    <StepCard title="设计条件" desc="项目基本条件，作为系统设计输入">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 md:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <p className="text-[11px] text-muted">{k}</p>
            <p className="text-[13px] font-medium">{v || '—'}</p>
          </div>
        ))}
      </div>
    </StepCard>
  )
}