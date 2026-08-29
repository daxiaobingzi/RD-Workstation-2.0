import { useState } from 'react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import type { Document } from '../../../types/domain'
import { DocumentService, PointService, DesignService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { toast } from '../../../components/ui/toast'
import { StepCard } from '../panels/StepCard'

/**
 * 设计说明（P6 修复）：自动生成说明草稿（可编辑），保存落库到 documents（type='design_note'）。
 * 每次进入读取已有草稿；无草稿时用模板文字。推导字段变化后可点「重新生成草稿」。
 */
export function NoteStep({ projectId, psId, project, system }: {
  projectId: string; psId: string; project: { name: string }; system: { code: string; name: string }
}) {
  useDB((s) => s.db)
  const existing = useDB.getState().getTable<Document>(T.documents)
    .find((d) => d.project_system_id === psId && d.type === 'design_note')
  const [note, setNote] = useState(existing?.content ?? templateText(project.name, system.name, system.code))

  const save = () => {
    if (existing) DocumentService.update(existing.id, { content: note })
    else DocumentService.add(projectId, { project_system_id: psId, type: 'design_note', title: `${system.name}设计说明`, content: note })
    toast('设计说明已保存')
  }

  const regenerate = () => {
    setNote(templateText(project.name, system.name, system.code))
    toast('已重置为模板草稿')
  }

  const points = PointService.list(psId)
  const results = DesignService.results(psId)

  return (
    <StepCard title="设计说明" desc="自动生成的说明草稿（可编辑，保存后落库）">
      <textarea
        className="h-64 w-full rounded-md border border-rule bg-surface p-3 text-[13px] focus-visible:ring-2 focus-visible:ring-accent/30"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
        <span>点位 {points.length} 条 · 推导结果 {results.length} 项 · 保存后自动留档，可在项目「文档」与「复盘」中查看。</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={regenerate}>重新生成草稿</Button>
          <Button size="sm" onClick={save}>保存说明</Button>
        </div>
      </div>
    </StepCard>
  )
}

function templateText(projectName: string, systemName: string, systemCode: string): string {
  return `一、工程概况
本项目为${projectName}弱电智能化设计。本说明针对${systemName}（${systemCode}）系统。

二、系统设计
${systemName}（${systemCode}）设计采用高效编码与合理存储策略，点位按楼层/区域分布，设备按设计选型方案进行配置。

三、设备构成
前端点位 → 接入设备 → 汇聚设备 → 存储设备（详见"设备"与"推导"步骤）。

四、工程量
线缆、管材、辅材工程量按设备单点定额材料自动推导（详见"工程量"步骤）。

五、说明
本说明为自动生成的草稿，请在审定后保存。`
}