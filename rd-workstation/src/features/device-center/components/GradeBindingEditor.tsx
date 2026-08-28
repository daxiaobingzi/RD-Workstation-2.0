import { DeviceService } from '../../../services'
import { cn } from '../../../lib/utils'
import { toast } from '../../../components/ui/toast'
import { GRADE_LABEL } from '../device-center.types'

/* ---------- R2：档次绑定编辑器 ---------- */
function GradeBindingEditor({ modelId, familyId }: { modelId: string; familyId?: string }) {
  const bindings = DeviceService.gradeBindings(modelId).map((b) => b.grade_id)
  const coverage = familyId ? DeviceService.familyGradeCoverage(familyId) : []
  const gradeIdByLabel = new Map(DeviceService.grades().map((g) => [g.code, g.id]))
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(GRADE_LABEL).map(([code, label]) => {
          const gradeId = gradeIdByLabel.get(code)
          const on = !!gradeId && bindings.includes(gradeId)
          return (
            <button
              key={code}
              type="button"
              onClick={() => { DeviceService.setGradeBinding(modelId, code, !on); toast(on ? `已摘出「${label}」档` : `已挂载到「${label}」档`) }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                on ? 'border-accent bg-accent-soft text-accent' : 'border-rule text-muted hover:border-accent/40',
              )}
            >
              {label}{on && ' ✓'}
            </button>
          )
        })}
      </div>
      {coverage.length > 0 && (
        <p className="mt-1.5 text-[10.5px] text-faint">
          族内可用：{coverage.map((c) => `${c.label}${c.count}`).join(' · ')}
        </p>
      )}
    </div>
  )
}

export default GradeBindingEditor