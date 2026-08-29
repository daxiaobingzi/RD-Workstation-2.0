import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDB } from '../../db/memory-db'
import { T } from '../../types/domain'
import {
  ProjectService, PointService, DesignService, BillService, BudgetService,
} from '../../services'
import { DataLinkageStrip } from '../../components/data-linkage-strip'
import { StepRail } from '../../components/ui/tabs'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Select } from '../../components/ui/field'
import { toast } from '../../components/ui/toast'
import { cn } from '../../lib/utils'
import { ConditionStep } from './steps/ConditionStep'
import { PointsStep } from './steps/PointsStep'
import { DevicesStep } from './steps/DevicesStep'
import { DeriveStep } from './steps/DeriveStep'
import { RulesStep } from './steps/RulesStep'
import { QuantityStep } from './steps/QuantityStep'
import { TopologyStep } from './steps/TopologyStep'
import { BillStep } from './steps/BillStep'
import { BudgetStep } from './steps/BudgetStep'
import { NoteStep } from './steps/NoteStep'
import { ValidateStep } from './steps/ValidateStep'
import { AttrPanel } from './panels/AttrPanel'
import { AIPanel } from './panels/AIPanel'
import { CheckPanel } from './panels/CheckPanel'
import { type RightTab } from './system-design.types'

// P3：取消"设计参数"步骤 —— 各系统参数体系尚未建立，
// 硬编码视频监控参数会让所有系统显示同一表单，误导设计。
// 推导侧由 DEFAULT_RULES 兜底默认值，后续可改为「系统参数定义表」再恢复。
const STEPS = [
  { key: 'condition', label: '设计条件' },
  { key: 'points', label: '点位' },
  { key: 'derive', label: '推导' },
  { key: 'devices', label: '设备' },
  { key: 'rules', label: '推导规则' },
  { key: 'quantity', label: '工程量' },
  { key: 'topology', label: '拓扑' },
  { key: 'bill', label: '清单' },
  { key: 'budget', label: '预算' },
  { key: 'note', label: '说明' },
  { key: 'validate', label: '校核' },
]

const GRADES = [
  { value: 'economic', label: '经济型' },
  { value: 'standard', label: '标准型' },
  { value: 'premium', label: '高端型' },
]

export function SystemDesignPage() {
  const { projectId, psId } = useParams<{ projectId: string; psId: string }>()
  useDB((s) => s.db)
  const navigate = useNavigate()
  const [step, setStep] = useState('points')
  const [rightTab, setRightTab] = useState<RightTab>('attr')

  const project = projectId ? ProjectService.get(projectId) : undefined
  const ps = useDB.getState().getById<{ id: string; project_id: string; system_id: string; status: string; progress: number; design_grade?: string }>(T.project_systems, psId ?? '')
  const system = ps ? useDB.getState().getById<{ id: string; code: string; name: string }>(T.systems, ps.system_id) : undefined

  if (!ps || !system || !project) {
    return <div className="p-8 text-muted">系统设计工作区不存在。</div>
  }

  const points = PointService.list(ps.id)
  const results = DesignService.results(ps.id)
  const selections = DesignService.selections(ps.id)
  const checks = DesignService.check(ps.id)
  const billVersions = BillService.versions(project.id)
  const lastVersion = billVersions[0]
  const billItems = lastVersion ? BillService.items(lastVersion.id) : []
  const budgets = BudgetService.byProject(project.id)
  const budgetTotal = budgets.reduce((s, b) => s + b.total_amount, 0)

  const stepDone: Record<string, boolean> = {
    points: points.length > 0,
    devices: selections.length > 0,
    derive: results.length > 0,
    quantity: results.some((r) => r.source_type === 'quota'),
    topology: results.length > 0,
    bill: billItems.length > 0,
    budget: budgetTotal > 0,
    validate: checks.length > 0,
  }

  const changeGrade = (grade: string) => {
    useDB.getState().update(T.project_systems, ps.id, { design_grade: grade, updated_at: new Date().toISOString() })
    if (results.length) DesignService.derive(ps.id)
    toast(`已切换为「${GRADES.find((g) => g.value === grade)?.label}」并重新推导`)
  }

  const derive = () => {
    const { selections: sels } = DesignService.derive(ps.id)
    useDB.getState().update(T.project_systems, ps.id, { progress: DesignService.progress(ps.id), updated_at: new Date().toISOString() })
    toast(`推导完成：生成 ${sels.length} 类设备选型`)
  }

  const generateBill = () => {
    const { version, items } = BillService.generate(ps.id, project.id)
    toast(`已生成清单 ${version.version_no}（${items.length} 项）`)
  }

  const generateBudget = () => {
    if (!lastVersion) {
      toast('请先生成清单', 'warn')
      return
    }
    BudgetService.generate(ps.id, project.id, lastVersion.id)
    toast('预算已生成')
  }

  return (
    <div className="flex h-full flex-col">
      {/* 工作区头部 */}
      <div className="flex items-center gap-3 border-b border-rule bg-surface px-4 py-2.5">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold">{system.name}</h1>
          <p className="truncate text-[11.5px] text-muted">{project.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={ps.design_grade ?? 'standard'} onChange={(e) => changeGrade(e.target.value)} className="h-7 w-24 text-[12px]">
            {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </Select>
          <StatusBadge status={ps.status} />
          <Button size="sm" variant="outline" onClick={() => navigate(`/projects/${project.id}`)}>返回项目</Button>
        </div>
      </div>

      <div className="border-b border-rule bg-surface px-4 py-2">
        <DataLinkageStrip psId={ps.id} projectId={project.id} />
      </div>

      {/* 三栏主体 */}
      <div className="flex min-h-0 flex-1">
        {/* 左：步骤栏 */}
        <div className="w-44 shrink-0 overflow-y-auto border-r border-rule bg-surface p-2">
          <StepRail
            steps={STEPS.map((s) => ({ ...s, done: stepDone[s.key] && s.key !== step }))}
            current={step}
            onSelect={setStep}
          />
          <div className="mt-3 border-t border-rule pt-3">
            <p className="mb-1.5 px-2 text-[10.5px] font-semibold tracking-wide text-faint uppercase">设计进度</p>
            <div className="px-2">
              <div className="relative h-1.5 overflow-hidden rounded-full bg-rule/70">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2" style={{ width: `${ps.progress}%` }} />
              </div>
              <p className="mt-1 text-right font-mono text-[11px] text-muted">{ps.progress}%</p>
            </div>
          </div>
        </div>

        {/* 中：主工作区 */}
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {step === 'condition' && <ConditionStep project={project} />}
          {step === 'points' && <PointsStep psId={ps.id} points={points} />}
          {step === 'devices' && <DevicesStep psId={ps.id} selections={selections} onDerive={derive} />}
          {step === 'derive' && <DeriveStep psId={ps.id} results={results} onDerive={derive} />}
          {step === 'rules' && <RulesStep psId={ps.id} onDerive={derive} />}
          {step === 'quantity' && <QuantityStep psId={ps.id} results={results} onDerive={derive} />}
          {step === 'topology' && <TopologyStep psId={ps.id} results={results} />}
          {step === 'bill' && <BillStep billItems={billItems} version={lastVersion} onGenerate={generateBill} />}
          {step === 'budget' && <BudgetStep psId={ps.id} total={budgetTotal} budgets={budgets} lastVersion={lastVersion} onGenerate={generateBudget} />}
          {step === 'note' && <NoteStep projectId={project.id} psId={ps.id} project={project} system={system} />}
          {step === 'validate' && <ValidateStep checks={checks} />}
        </div>

        {/* 右：属性 / AI / 校核 */}
        <div className="flex w-72 shrink-0 flex-col border-l border-rule bg-surface">
          <div className="flex border-b border-rule">
            {([
              ['attr', '属性'],
              ['ai', 'AI 建议'],
              ['check', '校核'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setRightTab(k)}
                className={cn(
                  'flex-1 px-2 py-2 text-[12px] font-medium',
                  rightTab === k ? 'border-b-2 border-accent text-accent' : 'text-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {rightTab === 'attr' && <AttrPanel selections={selections} />}
            {rightTab === 'ai' && <AIPanel checks={checks} onGoto={setStep} />}
            {rightTab === 'check' && <CheckPanel checks={checks} />}
          </div>
        </div>
      </div>
    </div>
  )
}