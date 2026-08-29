import { useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import type { DesignRule } from '../../../types/domain'
import { Button } from '../../../components/ui/button'
import { Input, Select, Field } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { Table, THead, TBody, TR, TH, TD } from '../../../components/ui/table'
import { EmptyState } from '../../../components/ui/empty'
import { toast } from '../../../components/ui/toast'
import { uid } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

const RULE_TARGETS = [
  { value: 'poe_switch', label: 'POE 交换机' },
  { value: 'nvr', label: 'NVR' },
  { value: 'hdd', label: '硬盘' },
  { value: 'aggregation', label: '汇聚交换机' },
  { value: 'mount', label: '支架' },
  { value: 'cable', label: '线缆' },
  { value: 'conduit', label: '管材' },
  { value: 'aux', label: '辅材' },
  { value: 'other', label: '其他设备' },
]

/** 推导规则编辑器（P4）：可选变量 camera_count / poe_count / nvr_count / hdd_count / agg_count / storage_tb */
const VARS_HINT = '可用变量：camera_count · poe_count · nvr_count · hdd_count · agg_count · storage_tb'

/** 推导规则管理（P4）：自定义推导公式/条件/优先级，与设备中心联动选型 */
export function RulesStep({ psId, onDerive }: { psId: string; onDerive: () => void }) {
  useDB((s) => s.db)
  const systemId = useDB.getState().getById<{ system_id: string }>(T.project_systems, psId)?.system_id ?? 'sys_vss'
  const rules = useDB.getState().getTable<DesignRule>(T.design_rules).filter((r) => r.system_id === systemId)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DesignRule | null>(null)

  return (
    <StepCard title="推导规则" desc="DesignEngine 按优先级执行规则（公式快照）从点位推导设备数量，自定义后点「重新推导」生效">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-muted">规则按 priority 升序执行，条件满足才生成；材料类结果来自设备中心的「单点定额材料」。</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />重新推导</Button>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="size-3.5" />新增规则</Button>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-rule">
        <Table>
          <THead><TR><TH>优先级</TH><TH>规则</TH><TH>生成</TH><TH>公式</TH><TH>条件</TH><TH>启用</TH><TH className="w-20"></TH></TR></THead>
          <TBody>
            {rules.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)).map((r) => (
              <TR key={r.id} className={r.enabled === false ? 'opacity-50' : 'hover:bg-hover'}>
                <TD><span className="font-mono text-[12px] text-faint">{r.priority ?? 0}</span></TD>
                <TD>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-1.5 font-mono text-[10.5px] text-faint">{r.code}</span>
                </TD>
                <TD><span className="text-[12px] text-muted">{RULE_TARGETS.find((t) => t.value === r.target_type)?.label ?? r.target_type}</span></TD>
                <TD className="max-w-56 truncate font-mono text-[11.5px] text-accent">{r.formula_json}</TD>
                <TD className="max-w-40 truncate font-mono text-[11.5px] text-muted">{r.condition_json ? String(r.condition_json) : '—'}</TD>
                <TD>
                  <button
                    type="button"
                    onClick={() => setEnabled(r.id, r.enabled !== false ? false : true, systemId)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.enabled !== false ? 'bg-ok-soft text-ok' : 'bg-surface-subtle text-faint'}`}
                  >
                    {r.enabled !== false ? '启用' : '停用'}
                  </button>
                </TD>
                <TD>
                  <div className="flex justify-end gap-0.5">
                    <button type="button" className="rounded p-1 text-faint hover:bg-hover hover:text-accent" title="编辑" onClick={() => { setEditing(r); setFormOpen(true) }}><Pencil className="size-3.5" /></button>
                    <button type="button" className="rounded p-1 text-faint hover:bg-danger-soft hover:text-danger" title="删除" onClick={() => { removeRule(r.id); toast('规则已删除', 'info') }}><Trash2 className="size-3.5" /></button>
                  </div>
                </TD>
              </TR>
            ))}
            {!rules.length && <TR><TD colSpan={7}><EmptyState icon={<Plus />} title="还没有规则" description="点击「新增规则」自定义推导" /></TD></TR>}
          </TBody>
        </Table>
      </div>
      <p className="mt-2 text-[11.5px] text-faint">{VARS_HINT} · 函数支持 ceil / floor / round / max / min / abs · 运算符 + - * / % ^</p>

      <RuleFormModal open={formOpen} onClose={() => setFormOpen(false)} systemId={systemId} editing={editing} />
    </StepCard>
  )
}

function setEnabled(id: string, enabled: boolean, systemId: string) {
  const rules = useDB.getState().getTable<DesignRule>(T.design_rules)
  void systemId
  const r = rules.find((x) => x.id === id)
  if (r) useDB.getState().update(T.design_rules, id, { enabled })
}

function removeRule(id: string) {
  useDB.getState().remove(T.design_rules, id)
}

/* ---------- 规则表单 ---------- */
function RuleFormModal({ open, onClose, systemId, editing }: { open: boolean; onClose: () => void; systemId: string; editing: DesignRule | null }) {
  const [name, setName] = useState(editing?.name ?? '')
  const [code, setCode] = useState(editing?.code ?? '')
  const [targetType, setTargetType] = useState(editing?.target_type ?? 'other')
  const [formula, setFormula] = useState(editing?.formula_json ?? '')
  const [condition, setCondition] = useState<string>(editing?.condition_json != null ? String(editing.condition_json) : '')
  const [priority, setPriority] = useState(editing?.priority ?? 10)
  const [enabled, setEnabled] = useState(editing?.enabled ?? true)

  const save = () => {
    if (!name.trim()) { toast('请填写规则名称', 'warn'); return }
    if (!code.trim()) { toast('请填写规则编码（如 R-CAM-POE）', 'warn'); return }
    if (!formula.trim()) { toast('请填写推导公式', 'warn'); return }
    const payload = {
      system_id: systemId, name: name.trim(), code: code.trim(),
      target_type: targetType, formula_json: formula.trim(),
      condition_json: condition.trim() || undefined,
      priority: Number(priority) || 10, enabled,
      description: `自定义规则：${targetType}`,
    }
    if (editing) {
      useDB.getState().update(T.design_rules, editing.id, payload)
      toast('规则已更新')
    } else {
      useDB.getState().insert(T.design_rules, { id: uid('rl'), rule_type: 'derive', source_type: targetType, ...payload } as never)
      toast('规则已新增')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '编辑推导规则' : '新增推导规则'}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}>保存</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="规则名称" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 摄像机→POE交换机" /></Field>
          <Field label="规则编码" required><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="R-CAM-POE" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="生成设备类型">
            <Select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              {RULE_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="优先级（升序）"><Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} /></Field>
        </div>
        <Field label="公式" required>
          <Input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="ceil(camera_count / 24)" />
        </Field>
        <Field label="条件（可空）">
          <Input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="camera_count > 0" />
        </Field>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-accent" />
          启用此规则
        </label>
        <p className="text-[11px] text-faint">{VARS_HINT}</p>
      </div>
    </Modal>
  )
}

export default RulesStep