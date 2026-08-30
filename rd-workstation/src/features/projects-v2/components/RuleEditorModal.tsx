import { useMemo, useState } from 'react'
import { BookMarked, Plus, Trash2, Zap, PencilLine, Info } from 'lucide-react'
import { Modal } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Field, Input, Select } from '../../../components/ui/field'
import { toast } from '../../../components/ui/toast'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import { DesignService } from '../../../services'
import { deviceKindOf } from '../../../engines/selection.engine'
import { cn } from '../../../lib/utils'

type Tpl = 'camera_count' | 'camera_factor' | 'ceil_div' | 'fixed' | 'storage_div' | 'custom'
const FORMULA_VARS = ['camera_count（点位合计）', 'poe_count（POE台数）', 'nvr_count（NVR台数）', 'hdd_count（硬盘数）', 'agg_count（汇聚数）', 'storage_tb（存储TB）', 'bitrate_mbps（码流）', 'storage_days（存储天数）']

/** 推导规则编辑器（v2）：按系统为设备中心设备自定义数量推导规则，保存后一键推导即生效 */
export function RuleEditorModal({
  systemId, systemName, open, onClose,
}: {
  systemId?: string
  systemName: string
  open: boolean
  onClose: () => void
}) {
  useDB((s) => s.db)
  const [selDeviceId, setSelDeviceId] = useState('')
  const [tpl, setTpl] = useState<Tpl>('camera_count')
  const [name, setName] = useState('')
  const [factor, setFactor] = useState('1')
  const [capacity, setCapacity] = useState('24')
  const [fixed, setFixed] = useState('1')
  const [starage, setStorage] = useState('8')
  const [custom, setCustom] = useState('camera_count')
  const [priority, setPriority] = useState('10')
  const [editingId, setEditingId] = useState('')

  const devices = useMemo(() => {
    const rows = (useDB.getState().db[T.products] ?? []) as { id: string; name: string; system_id?: string }[]
    return rows
      .filter((p) => p.system_id === systemId)
      .filter((p) => !p.name.includes('摄像机')) // 摄像机数量由点位合计汇总行生成（引擎固定逻辑）
      .map((p) => ({ ...p, kind: deviceKindOf(p as never) }))
      .filter((p) => p.kind) // 仅可推导识别 kind 的设备可驱动选型/清单
  }, [systemId, open])

  const rules = useMemo<ReturnType<typeof DesignService.listRulesBySystem>>(() => (systemId ? DesignService.listRulesBySystem(systemId) : []), [systemId, open])

  const buildFormula = (): string => {
    switch (tpl) {
      case 'camera_count': return 'camera_count'
      case 'camera_factor': return `camera_count * ${Number(factor) || 1}`
      case 'ceil_div': return `ceil(camera_count / ${Math.max(1, Number(capacity) || 1)})`
      case 'fixed': return `${Number(fixed) || 0}`
      case 'storage_div': return `ceil(storage_tb / ${Math.max(1, Number(starage) || 1)})`
      case 'custom': return custom.trim() || 'camera_count'
      default: return 'camera_count'
    }
  }

  const save = () => {
    if (!systemId) { toast('缺少系统上下文', 'warn'); return }
    const formula = buildFormula()
    const dev = devices.find((d) => d.id === selDeviceId)
    const ruleName = name.trim() || (dev?.name ?? '设备') + '数量推导'
    if (editingId) {
      DesignService.updateRule(editingId, { name: ruleName, formula_json: formula, priority: Number(priority) || 10 })
      toast('规则已更新')
    } else {
      if (!dev) { toast('请先选择目标设备', 'warn'); return }
      DesignService.addRule({
        system_id: systemId,
        name: ruleName,
        description: `${systemName} · 自定义推导规则（${dev.name}）`,
        rule_type: 'derive',
        target_type: dev.kind,
        source_type: 'custom',
        formula_json: formula,
        priority: Number(priority) || 10,
        enabled: true,
      })
      toast('规则已保存，执行「推导」后生效')
    }
    setEditingId('')
    setName('')
  }

  const startEdit = (id: string) => {
    const r = rules.find((x) => x.id === id)
    if (!r) return
    setEditingId(id)
    setName(r.name)
    setPriority(String(r.priority ?? 10))
    setCustom(r.formula_json)
    setTpl('custom')
  }

  const selectedDevice = devices.find((d) => d.id === selDeviceId)

  return (
    <Modal open={open} onClose={onClose} title={`推导规则自定义 · ${systemName}`} width={720}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>关闭</Button>
          <Button onClick={save}><Zap className="size-4" />保存{editingId ? '更新' : '并添加'}规则</Button>
        </>
      }>
      <div className="space-y-4">
        {/* 已配置规则 */}
        <div className="rounded-lg border border-rule">
          <div className="flex items-center justify-between border-b border-rule bg-surface-subtle/60 px-3 py-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-faint"><BookMarked className="size-3" />已配置规则（{rules.length}）· 按优先级执行，设备链优先于规则</span>
          </div>
          {rules.length ? (
            <ul className="divide-y divide-rule/60">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-[12px]">
                  <span className="font-mono text-faint">{r.priority ?? 10}</span>
                  <span className="w-40 truncate font-medium" title={r.name}>{r.name}</span>
                  <span className="max-w-[260px] flex-1 truncate font-mono text-muted" title={r.formula_json}>{r.formula_json}</span>
                  <button type="button" onClick={() => { DesignService.updateRule(r.id, { enabled: !r.enabled }); toast(r.enabled ? '已停用该规则' : '已启用该规则', 'info') }}
                    className={cn('rounded-full px-1.5 text-[10px] font-semibold', r.enabled ? 'bg-ok-soft/60 text-ok' : 'bg-surface-subtle text-faint')}>
                    {r.enabled ? '启用' : '停用'}
                  </button>
                  <button type="button" title="编辑" onClick={() => startEdit(r.id)} className="rounded p-1 text-faint hover:text-accent"><PencilLine className="size-3.5" /></button>
                  <button type="button" title="删除" onClick={() => { DesignService.removeRule(r.id); toast('已删除规则', 'info') }} className="rounded p-1 text-faint hover:text-danger"><Trash2 className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center text-[12px] text-faint">暂无自定义规则。下方选择设备与公式，保存后执行「推导」即可按规则推算设备数量。</p>
          )}
        </div>

        {/* 新增/编辑规则 */}
        <div className={cn('rounded-lg border p-3', editingId ? 'border-accent/40 bg-accent-soft/20' : 'border-rule')}>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
            {editingId ? <PencilLine className="size-3.5" /> : <Plus className="size-3.5" />}{editingId ? '编辑规则' : '新增规则'}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="目标设备（设备中心 · 同系统，摄像机除外）">
              <Select value={selDeviceId} onChange={(e) => setSelDeviceId(e.target.value)} disabled={!!editingId}>
                <option value="">选择设备…</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="规则名称">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={selectedDevice ? `${selectedDevice.name}数量推导` : '如：NVR 数量推导'} />
            </Field>
            <Field label="公式类型">
              <Select value={tpl} onChange={(e) => setTpl(e.target.value as Tpl)} disabled={!!editingId}>
                <option value="camera_count">数量 = 点位合计</option>
                <option value="camera_factor">数量 = 点位合计 × 系数</option>
                <option value="ceil_div">数量 = ceil(点位合计 ÷ 容量)</option>
                <option value="fixed">数量 = 固定值</option>
                <option value="storage_div">数量 = ceil(存储TB ÷ 单盘容量)</option>
                <option value="custom">自定义表达式（高级）</option>
              </Select>
            </Field>
            <Field label="优先级（小者先执行）">
              <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </Field>
            {tpl === 'camera_factor' && <Field label="系数"><Input type="number" value={factor} onChange={(e) => setFactor(e.target.value)} /></Field>}
            {tpl === 'ceil_div' && <Field label="容量（每台上限）"><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>}
            {tpl === 'fixed' && <Field label="固定数量"><Input type="number" value={fixed} onChange={(e) => setFixed(e.target.value)} /></Field>}
            {tpl === 'storage_div' && <Field label="单盘容量（TB）"><Input type="number" value={starage} onChange={(e) => setStorage(e.target.value)} /></Field>}
            {tpl === 'custom' && <Field label="表达式（evalExpr 语法）"><Input value={custom} onChange={(e) => setCustom(e.target.value)} /></Field>}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
            <Info className="size-3.5 shrink-0" />可用变量：{FORMULA_VARS.join(' · ')}；函数：ceil / floor / round / max / min。
          </p>
        </div>

        {rules.some((r) => r.target_type === 'camera') && (
          <p className="text-[11px] text-warn">注意：摄像机数量由「点位合计」汇总行固定生成，无需也不能为其定义规则。</p>
        )}
      </div>
    </Modal>
  )
}