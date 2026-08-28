import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, RefreshCw, Plus, Trash2, Download, Zap, ShieldCheck, Sparkles, PanelRight } from 'lucide-react'
import { useDB } from '../domain/db'
import { T, type Point } from '../domain/types'
import {
  ProjectService, SystemService, PointService, DesignService, BillService, BudgetService,
} from '../domain/services'
import { DataLinkageStrip } from '../components/data-linkage-strip'
import { PointImportDialog } from '../components/point-import'
import { StepRail } from '../components/ui/tabs'
import { StatusBadge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Field, Input, Select } from '../components/ui/field'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../components/ui/table'
import { EmptyState } from '../components/ui/empty'
import { toast } from '../components/ui/toast'
import { fmtMoney, fmtNum, cn } from '../lib/utils'

const STEPS = [
  { key: 'condition', label: '设计条件' },
  { key: 'params', label: '设计参数' },
  { key: 'points', label: '点位' },
  { key: 'devices', label: '设备' },
  { key: 'derive', label: '推导' },
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
  const [rightTab, setRightTab] = useState<'attr' | 'ai' | 'check'>('attr')

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
  const params = SystemService.params(ps.id)
  const billVersions = BillService.versions(project.id)
  const lastVersion = billVersions[0]
  const billItems = lastVersion ? BillService.items(lastVersion.id) : []
  const budgets = BudgetService.byProject(project.id)
  const budgetTotal = budgets.reduce((s, b) => s + b.total_amount, 0)

  const stepDone: Record<string, boolean> = {
    condition: true,
    params: params.length > 0,
    points: points.length > 0,
    devices: selections.length > 0,
    derive: results.length > 0,
    topology: results.length > 0,
    bill: billItems.length > 0,
    budget: budgetTotal > 0,
    note: true,
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
        <DataLinkageStrip psId={ps.id} />
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
          {step === 'params' && <ParamsStep psId={ps.id} params={params} />}
          {step === 'points' && <PointsStep psId={ps.id} points={points} />}
          {step === 'devices' && <DevicesStep selections={selections} onDerive={derive} />}
          {step === 'derive' && <DeriveStep psId={ps.id} results={results} onDerive={derive} />}
          {step === 'topology' && <TopologyStep results={results} selections={selections} />}
          {step === 'bill' && <BillStep billItems={billItems} version={lastVersion} onGenerate={generateBill} />}
          {step === 'budget' && <BudgetStep psId={ps.id} total={budgetTotal} budgets={budgets} lastVersion={lastVersion} onGenerate={generateBudget} />}
          {step === 'note' && <NoteStep project={project} system={system} />}
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
            {rightTab === 'attr' && <AttrPanel params={params} selections={selections} />}
            {rightTab === 'ai' && <AIPanel checks={checks} params={params} onGoto={setStep} />}
            {rightTab === 'check' && <CheckPanel checks={checks} />}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= 各步骤 ================= */

function StepCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-surface p-4 shadow-sm">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-[12px] text-muted">{desc}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function ConditionStep({ project }: { project: { name: string; building_type?: string; building_area?: number; floor_count?: number; client_name?: string; design_stage?: string } }) {
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

function ParamsStep({ psId, params }: { psId: string; params: ReturnType<typeof SystemService.params> }) {
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

function PointsStep({ psId, points }: { psId: string; points: Point[] }) {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [cat, setCat] = useState('all')
  const [form, setForm] = useState<Partial<Point>>({ quantity: 1, unit: '台' })
  const cats = PointService.categories('sys_vss')
  const filtered = cat === 'all' ? points : points.filter((p) => p.category_id === cat)
  const total = points.reduce((s, p) => s + (p.quantity || 0), 0)

  const add = () => {
    if (!form.point_name) {
      toast('请填写点位名称', 'warn')
      return
    }
    PointService.add(psId, { ...form, category_id: form.category_id || cats[0]?.id })
    toast(`已添加点位「${form.point_name}」`)
    setOpen(false)
    setForm({ quantity: 1, unit: '台' })
  }

  const onImported = (n: number) => {
    if (n > 0) {
      useDB.getState().update(T.project_systems, psId, { progress: DesignService.progress(psId), updated_at: new Date().toISOString() })
    }
    setImportOpen(false)
  }

  return (
    <StepCard title="点位录入" desc={`共 ${points.length} 类点位，合计 ${fmtNum(total)} 台摄像机`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="h-7 w-32 text-[12px]">
            <option value="all">全部类别</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="size-3.5" />批量导入
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5" />添加点位</Button>
        </div>
      </div>
      <div className="overflow-auto rounded-md border border-rule">
        <Table>
          <THead><TR><TH>编号</TH><TH>名称</TH><TH>类别</TH><TH>楼层</TH><TH>位置</TH><TH>数量</TH><TH></TH></TR></THead>
          <TBody>
            {filtered.map((p) => (
              <TR key={p.id} className="hover:bg-hover">
                <TD><NumCell>{p.point_code}</NumCell></TD>
                <TD className="font-medium">{p.point_name}</TD>
                <TD className="text-muted">{cats.find((c) => c.id === p.category_id)?.name ?? '—'}</TD>
                <TD className="text-muted">{p.floor}</TD>
                <TD className="text-muted">{p.space}</TD>
                <TD><NumCell>{fmtNum(p.quantity)}</NumCell></TD>
                <TD className="text-right">
                  <button type="button" className="rounded p-1 text-faint hover:bg-danger-soft hover:text-danger" onClick={() => { PointService.remove(p.id); toast('点位已删除', 'info') }} aria-label="删除">
                    <Trash2 className="size-3.5" />
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!filtered.length && (
          <EmptyState icon={<Plus />} title={cat === 'all' ? '还没有点位' : '该类别暂无点位'} description="添加点位或切换筛选" action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5" />添加点位</Button>} />
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-md border border-accent/30 bg-accent-soft/40 p-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="点位名称" required><Input value={form.point_name ?? ''} onChange={(e) => setForm({ ...form, point_name: e.target.value })} placeholder="如：大厅高清枪机" /></Field>
            <Field label="类别">
              <Select value={form.category_id ?? cats[0]?.id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="楼层"><Input value={form.floor ?? ''} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="1F" /></Field>
            <Field label="位置"><Input value={form.space ?? ''} onChange={(e) => setForm({ ...form, space: e.target.value })} placeholder="大堂" /></Field>
            <Field label="数量"><Input type="number" value={form.quantity ?? 1} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })} /></Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button size="sm" onClick={add}>确认添加</Button>
          </div>
        </div>
      )}

      <PointImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        psId={psId}
        categories={cats}
        onImported={onImported}
      />
    </StepCard>
  )
}

function DevicesStep({ selections, onDerive }: { selections: ReturnType<typeof DesignService.selections>; onDerive: () => void }) {
  return (
    <StepCard title="设备选型" desc="按当前档次自动选型，价格取参考价快照">
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />重新推导</Button></div>
      <div className="overflow-auto rounded-md border border-rule">
        <Table>
          <THead><TR><TH>设备</TH><TH>规格</TH><TH>品牌</TH><TH>数量</TH><TH>单位</TH><TH>单价</TH><TH>金额</TH></TR></THead>
          <TBody>
            {selections.map((s) => (
              <TR key={s.id} className="hover:bg-hover">
                <TD className="font-medium">{s.modelName ?? s.model_id}</TD>
                <TD className="max-w-[220px] truncate text-muted">{s.spec}</TD>
                <TD className="text-muted">{s.brand ?? '—'}</TD>
                <TD><NumCell>{fmtNum(s.quantity)}</NumCell></TD>
                <TD className="text-muted">{s.unit}</TD>
                <TD className={cn('font-mono text-[12px]', !s.unit_price ? 'font-bold text-danger' : 'text-muted')}>{fmtMoney(s.unit_price)}</TD>
                <TD className="font-mono text-[12.5px] font-semibold">{fmtMoney(s.total_price)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!selections.length && <EmptyState icon={<Zap />} title="尚未推导设备" description="点击「重新推导」，按设计规则自动生成设备选型" action={<Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />立即推导</Button>} />}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">提示：项目选型价为快照，不随设备库价格变动。</p>
    </StepCard>
  )
}

function DeriveStep({ psId, results, onDerive }: { psId: string; results: ReturnType<typeof DesignService.results>; onDerive: () => void }) {
  const points = PointService.list(psId)
  const cats = PointService.categories('sys_vss')
  const catName = new Map(cats.map((c) => [c.id, c.name]))
  const byCat = new Map<string, number>()
  for (const p of points) {
    const key = p.category_id ? (catName.get(p.category_id) ?? '未分类') : '未分类'
    byCat.set(key, (byCat.get(key) ?? 0) + (p.quantity || 0))
  }
  // 规则启用条件（来自 rules 表，供展示）
  const rules = useDB.getState().getTable<{ id: string; code: string; condition_json?: string; formula_json: string }>(T.design_rules)

  return (
    <StepCard title="设计推导" desc="DesignEngine 按规则（公式快照）从点位推导设备数量">
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />重新推导</Button></div>

      {byCat.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-muted">类别分布：</span>
          {[...byCat.entries()].map(([name, qty]) => (
            <span key={name} className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-[12px] text-muted">
              {name} <b className="font-mono text-ink">{fmtNum(qty)}</b>
            </span>
          ))}
        </div>
      )}

      <div className="overflow-auto rounded-md border border-rule">
        <Table>
          <THead><TR><TH>结果</TH><TH>规则</TH><TH>公式</TH><TH>数量</TH><TH>单位</TH></TR></THead>
          <TBody>
            {results.map((r) => (
              <TR key={r.id} className="hover:bg-hover">
                <TD className="font-medium">{resultTypeName(r.result_type)}</TD>
                <TD>
                  <span className="font-mono text-[11.5px] text-accent">{r.rule_snapshot}</span>
                  <RuleConditionBadge ruleCode={r.rule_snapshot ?? ''} rules={rules} />
                </TD>
                <TD className="font-mono text-[12px] text-muted">{r.formula_snapshot}</TD>
                <TD><NumCell className="text-[14px] font-bold">{fmtNum(r.quantity)}</NumCell></TD>
                <TD className="text-muted">{r.unit}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!results.length && <EmptyState icon={<Zap />} title="还没有推导结果" action={<Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />立即推导</Button>} />}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">
        规则按优先级级联执行（POE→聚合、NVR、硬盘）；条件规则仅当变量满足时生成结果。
      </p>
    </StepCard>
  )
}

function RuleConditionBadge({ ruleCode, rules }: { ruleCode: string; rules: { id: string; code: string; condition_json?: string }[] }) {
  const rule = rules.find((r) => r.code === ruleCode || ruleCode.startsWith(r.code))
  if (!rule?.condition_json) return null
  return (
    <span className="ml-1.5 rounded-full bg-warn-soft px-1.5 py-0.5 font-mono text-[10px] text-warn" title="条件规则">
      条件 {rule.condition_json}
    </span>
  )
}

function TopologyStep({ results, selections }: { results: ReturnType<typeof DesignService.results>; selections: ReturnType<typeof DesignService.selections> }) {
  const qty = (type: string) => results.find((r) => r.result_type === type)?.quantity ?? 0
  const nodes = [
    { label: '摄像机点位', value: results[0] ? qty('camera') || qtyAll(results) : 0, color: 'bg-accent' },
    { label: 'POE 交换机', value: qty('poe_switch'), color: 'bg-accent2' },
    { label: '汇聚交换机', value: qty('aggregation'), color: 'bg-violet' },
    { label: 'NVR', value: qty('nvr'), color: 'bg-ok' },
    { label: '硬盘', value: qty('hdd'), color: 'bg-warn' },
  ]
  return (
    <StepCard title="系统拓扑" desc="点位 → 接入 → 汇聚 → 存储 的组网关系">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-rule bg-surface-subtle/50 p-4">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex items-center gap-2">
            <div className="flex flex-col items-center rounded-md border border-rule bg-surface px-4 py-3 shadow-sm">
              <span className={cn('mb-1.5 h-1 w-8 rounded-full', n.color)} />
              <span className="font-mono text-[18px] font-bold text-ink">{fmtNum(n.value)}</span>
              <span className="text-[11px] text-muted">{n.label}</span>
            </div>
            {i < nodes.length - 1 && <ArrowRight className="size-4 text-accent" />}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">设备选型：{selections.map((s) => s.modelName).filter(Boolean).join(' · ')}</p>
    </StepCard>
  )
}

function qtyAll(results: { quantity: number }[]) {
  return results[0]?.quantity ?? 0
}

function BillStep({ billItems, version, onGenerate }: { billItems: ReturnType<typeof BillService.items>; version?: { version_no: string; name?: string } | null; onGenerate: () => void }) {
  const total = billItems.reduce((s, i) => s + i.amount, 0)
  return (
    <StepCard title="清单" desc={version ? `当前版本 ${version.version_no}（${version.name}）` : '由设备选型生成，支持版本化'}>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={onGenerate}><Zap className="size-3.5" />生成清单版本</Button></div>
      <div className="overflow-auto rounded-md border border-rule">
        <Table>
          <THead><TR><TH>编码</TH><TH>名称</TH><TH>规格</TH><TH>数量</TH><TH>单价</TH><TH>金额</TH></TR></THead>
          <TBody>
            {billItems.map((i) => (
              <TR key={i.id} className="hover:bg-hover">
                <TD><NumCell>{i.item_code}</NumCell></TD>
                <TD className="font-medium">{i.item_name}</TD>
                <TD className="max-w-[220px] truncate text-muted">{i.specification}</TD>
                <TD><NumCell>{fmtNum(i.quantity)}</NumCell></TD>
                <TD className="font-mono text-[12px] text-muted">{fmtMoney(i.unit_price)}</TD>
                <TD className="font-mono text-[12.5px] font-semibold">{fmtMoney(i.amount)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!billItems.length && <EmptyState icon={<Zap />} title="清单为空" description="先生成设备推导，再生成清单" action={<Button size="sm" onClick={onGenerate}><Zap className="size-3.5" />生成清单</Button>} />}
      </div>
      {billItems.length > 0 && <div className="mt-2 flex justify-end text-[13px]"><span className="text-muted">合计：</span><span className="ml-2 font-mono font-bold">{fmtMoney(total)}</span></div>}
    </StepCard>
  )
}

function BudgetStep({ psId, total, budgets, lastVersion, onGenerate }: { psId: string; total: number; budgets: ReturnType<typeof BudgetService.byProject>; lastVersion?: { id: string } | null; onGenerate: () => void }) {
  const items = BudgetService.items(budgets[0]?.id ?? '__none__')
  const budget = budgets[0]
  const family = BudgetService.byFamily(budget?.id ?? '__none__')
  const gradeEstimate = BudgetService.estimateByGrade(psId)
  const maxGrade = Math.max(...gradeEstimate.map((g) => g.total), 1)
  const familyMax = Math.max(...family.map((f) => f.amount), 1)
  const overTarget = budget?.target_amount ? total > budget.target_amount : false

  return (
    <StepCard title="预算" desc="基于清单版本估算预算，切换档次可对比，构成按设备族聚合">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11.5px] text-muted">当前预算总额{overTarget ? ' · 已超目标预算' : ''}</p>
          <p className={cn('font-mono text-2xl font-bold', overTarget ? 'text-danger' : 'text-ink')}>{fmtMoney(total)}</p>
          {budget?.target_amount ? (
            <p className="text-[11px] text-muted">目标 {fmtMoney(budget.target_amount)}</p>
          ) : (
            <p className="text-[11px] text-faint">未设目标预算</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {budget && (
            <Input
              type="number"
              defaultValue={budget.target_amount ?? ''}
              placeholder="设定目标预算"
              className="h-7 w-32 text-[12px]"
              onBlur={(e) => {
                const v = Number(e.target.value)
                if (v > 0) BudgetService.setTargetAmount(budget.id, v)
              }}
            />
          )}
          <Button size="sm" onClick={onGenerate} disabled={!lastVersion}><Zap className="size-3.5" />生成预算</Button>
        </div>
      </div>

      {/* 三档预算对比 */}
      {gradeEstimate.length > 0 && (
        <div className="mb-4 rounded-md border border-rule bg-surface-subtle/40 p-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">档次预算对比（同一推导结果）</p>
          <div className="space-y-2">
            {gradeEstimate.map((g) => (
              <div key={g.grade} className="flex items-center gap-2.5">
                <span className="w-14 shrink-0 text-[12px] text-muted">{g.label}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-[4px] bg-rule/40">
                  <div
                    className={cn('h-full rounded-[4px]', g.grade === 'premium' ? 'bg-accent' : g.grade === 'standard' ? 'bg-accent2' : 'bg-warn')}
                    style={{ width: `${Math.max(4, (g.total / maxGrade) * 100)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-[12px] font-semibold">{fmtMoney(g.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 构成占比 */}
      {family.length > 0 && (
        <div className="mb-4 rounded-md border border-rule bg-surface-subtle/40 p-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">预算构成（按设备族）</p>
          <div className="space-y-1.5">
            {family.map((f) => (
              <div key={f.name} className="flex items-center gap-2.5">
                <span className="w-24 shrink-0 truncate text-[12px] text-muted">{f.name}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-[4px] bg-rule/40">
                  <div className="h-full rounded-[4px] bg-gradient-to-r from-accent to-accent2" style={{ width: `${Math.max(3, (f.amount / familyMax) * 100)}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-[12px]">{fmtMoney(f.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-auto rounded-md border border-rule">
          <Table>
            <THead><TR><TH>清单项</TH><TH>数量</TH><TH>单价</TH><TH>金额</TH></TR></THead>
            <TBody>
              {items.map((i) => (
                <TR key={i.id} className="hover:bg-hover">
                  <TD className="font-medium">{i.bill_item_id}</TD>
                  <TD><NumCell>{fmtNum(i.quantity)}</NumCell></TD>
                  <TD className="font-mono text-[12px] text-muted">{fmtMoney(i.unit_price)}</TD>
                  <TD className="font-mono text-[12.5px] font-semibold">{fmtMoney(i.amount)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      {!budgets.length && <p className="text-[12px] text-faint">预算按清单版本生成；切换顶部档次可对比不同档预算。</p>}
    </StepCard>
  )
}

function NoteStep({ project, system }: { project: { name: string }; system: { code: string; name: string } }) {
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

function ValidateStep({ checks }: { checks: ReturnType<typeof DesignService.check> }) {
  return (
    <StepCard title="设计校核" desc="确定性机器检查，复杂判断交由 AI">
      <ul className="space-y-2">
        {checks.map((c, i) => (
          <li key={i} className={cn(
            'flex items-start gap-2.5 rounded-md border px-3 py-2.5',
            c.severity === 'ok' ? 'border-ok/30 bg-ok-soft/40' : c.severity === 'warn' ? 'border-warn/30 bg-warn-soft/40' : 'border-danger/30 bg-danger-soft/40',
          )}>
            <ShieldCheck className={cn('mt-0.5 size-4 shrink-0', c.severity === 'ok' ? 'text-ok' : c.severity === 'warn' ? 'text-warn' : 'text-danger')} />
            <div>
              <p className="text-[13px] font-medium">{checkTypeName(c.type)}</p>
              <p className="text-[12px] text-muted">{c.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </StepCard>
  )
}

/* ---------- 右侧面板 ---------- */
function AttrPanel({ params, selections }: { params: ReturnType<typeof SystemService.params>; selections: ReturnType<typeof DesignService.selections> }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">设计参数</p>
        <dl className="space-y-1.5">
          {params.map((p) => (
            <div key={p.id} className="flex justify-between text-[12.5px]">
              <dt className="text-muted">{p.parameter_name}</dt>
              <dd className="font-mono font-medium">{String(p.value_json)}{p.unit ? ` ${p.unit}` : ''}</dd>
            </div>
          ))}
          {!params.length && <p className="text-[12px] text-faint">尚未设置参数</p>}
        </dl>
      </div>
      <div className="border-t border-rule pt-3">
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-faint uppercase">设备选型（{selections.length}）</p>
        <ul className="space-y-1.5">
          {selections.map((s) => (
            <li key={s.id} className="text-[12px] text-muted">
              <span className="text-ink">{s.modelName}</span> × {fmtNum(s.quantity)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function AIPanel({ checks, params, onGoto }: { checks: ReturnType<typeof DesignService.check>; params: ReturnType<typeof SystemService.params>; onGoto: (s: string) => void }) {
  const warnCount = checks.filter((c) => c.severity !== 'ok').length
  const bit = Number(params.find((p) => p.parameter_key === 'bitrate_mbps')?.value_json ?? 4)
  const days = Number(params.find((p) => p.parameter_key === 'storage_days')?.value_json ?? 30)
  const cameras = DesignService.selections('ps_vss_001').length
  void cameras
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-rule bg-surface-subtle p-3">
        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink"><Sparkles className="size-3.5 text-accent" />今日建议</p>
        <ul className="space-y-1.5 text-[12px] text-muted">
          <li>• 当前码流 {bit}Mbps / 存储 {days} 天，可校核容量。</li>
          <li>• 缺价与校验共 {warnCount} 项，建议到「校核」处理。</li>
        </ul>
        <button type="button" className="mt-2 text-[12px] font-medium text-accent hover:underline" onClick={() => onGoto('validate')}>去校核 →</button>
      </div>
      <p className="text-[11px] text-faint">AI 建议经 Domain Service 落库，不直接写库。</p>
    </div>
  )
}

function CheckPanel({ checks }: { checks: ReturnType<typeof DesignService.check> }) {
  return (
    <div className="space-y-1.5">
      {checks.map((c, i) => (
        <div key={i} className="flex items-start gap-2 text-[12px]">
          <PanelRight className={cn('mt-0.5 size-3.5 shrink-0', c.severity === 'ok' ? 'text-ok' : c.severity === 'warn' ? 'text-warn' : 'text-danger')} />
          <span className="text-muted">{c.message}</span>
        </div>
      ))}
    </div>
  )
}

function resultTypeName(t: string) {
  return { camera: '摄像机', poe_switch: 'POE 交换机', nvr: 'NVR', hdd: '硬盘', aggregation: '汇聚交换机', mount: '支架', cable: '线缆' }[t] ?? t
}
function checkTypeName(t: string) {
  return { missing_device: '缺设备', missing_camera: '摄像机选型', missing_price: '缺价格', storage: '存储容量', no_point: '点位', category_coverage: '类别覆盖', disabled_model: '停用型号' }[t] ?? t
}
