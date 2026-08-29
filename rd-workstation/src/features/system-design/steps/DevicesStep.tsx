import { useMemo, useState } from 'react'
import { RefreshCw, Zap, Settings2, Plus, Trash2, Pencil, Star } from 'lucide-react'
import { useDB } from '../../../db/memory-db'
import { T } from '../../../types/domain'
import type { SelectionScheme, SchemeRule } from '../../../types/domain'
import { DesignService, SchemeService } from '../../../services'
import { Button } from '../../../components/ui/button'
import { Input, Field, Textarea } from '../../../components/ui/field'
import { Modal } from '../../../components/ui/dialog'
import { Table, THead, TBody, TR, TH, TD, NumCell } from '../../../components/ui/table'
import { EmptyState } from '../../../components/ui/empty'
import { toast } from '../../../components/ui/toast'
import { fmtMoney, fmtNum, cn } from '../../../lib/utils'
import { StepCard } from '../panels/StepCard'

const KINDS = [
  { value: 'camera', label: '摄像机' },
  { value: 'poe_switch', label: 'POE 交换机' },
  { value: 'nvr', label: 'NVR' },
  { value: 'hdd', label: '硬盘' },
  { value: 'aggregation', label: '汇聚交换机' },
  { value: 'mount', label: '支架' },
]

/** 设备选型步骤（P5）：支持自定义选型方案（勾选后按方案规则推导）+ 结果表 */
export function DevicesStep({ psId, selections, onDerive }: {
  psId: string; selections: ReturnType<typeof DesignService.selections>; onDerive: () => void
}) {
  useDB((s) => s.db)
  const systemId = useDB.getState().getById<{ system_id: string }>(T.project_systems, psId)?.system_id ?? 'sys_vss'
  const lockedSchemeId = useDB.getState().getById<{ selection_scheme_id?: string }>(T.project_systems, psId)?.selection_scheme_id
  const schemes = useMemo(() => SchemeService.list(systemId), [systemId, useDB.getState().db])
  const [manageOpen, setManageOpen] = useState(false)

  const applyScheme = (schemeId: string | undefined) => {
    DesignService.setScheme(psId, schemeId)
    if (schemeId) {
      const affected = DesignService.derive(psId, schemeId)
      toast(`已应用选型方案并重新推导（${affected.selections.length} 类选型）`)
      return
    }
    toast('已恢复默认档次选型')
  }

  const totalAmount = selections.reduce((s, x) => s + x.total_price, 0)

  return (
    <StepCard
      title="设备选型"
      desc="勾选自定义选型方案后推导；未勾选则按项目档次默认选型（价格参考价快照）"
      extra={
        <div className="flex items-center gap-2">
          <select
            value={lockedSchemeId ?? ''}
            onChange={(e) => applyScheme(e.target.value || undefined)}
            className="h-7 rounded-[6px] border border-rule bg-surface px-2 text-[12px]"
          >
            <option value="">默认（按档次）</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.is_default ? ' ★默认' : ''}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}><Settings2 className="size-3.5" />方案管理</Button>
          <Button size="sm" onClick={onDerive}><RefreshCw className="size-3.5" />重新推导</Button>
        </div>
      }
    >
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
      <div className="mt-2 flex items-center justify-between text-[11.5px] text-faint">
        <span>选型方案：{lockedSchemeId ? (schemes.find((s) => s.id === lockedSchemeId)?.name ?? '自定义方案') : '项目默认档次'}</span>
        {selections.length > 0 && <span className="font-mono">设备合计 <b className="text-ink">{fmtMoney(totalAmount)}</b></span>}
      </div>

      <SchemeManager open={manageOpen} onClose={() => setManageOpen(false)} systemId={systemId} />
    </StepCard>
  )
}

/* ---------- 方案管理：新建/编辑/规则增删 ---------- */
function SchemeManager({ open, onClose, systemId }: { open: boolean; onClose: () => void; systemId: string }) {
  const [editingScheme, setEditingScheme] = useState<SelectionScheme | null>(null)
  const schemes = SchemeService.list(systemId)

  const newScheme = () => {
    const s = SchemeService.add({ name: `方案 ${schemes.length + 1}`, system_id: systemId, description: '自定义选型方案' })
    setEditingScheme(s)
  }

  return (
    <Modal open={open} onClose={onClose} title="选型方案管理" width={860}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-muted">方案 = 一组「设备类型 → 品牌 / 档次 / 型号关键词」偏好。勾选方案后引擎按其选型（未命中回退档次默认）。</p>
          <Button size="xs" onClick={newScheme}><Plus className="size-3" />新建方案</Button>
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
          {schemes.map((s) => (
            <div key={s.id} className="rounded-md border border-rule">
              <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
                <span className="text-[13px] font-semibold">{s.name}</span>
                {s.is_default && <Star className="size-3.5 fill-ok text-ok" />}
                <span className="text-[11px] text-faint">{s.description}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="xs" variant="outline" onClick={() => { SchemeService.setDefault(s.id); toast('已设为默认方案') }}>设默认</Button>
                  <Button size="xs" variant="outline" onClick={() => setEditingScheme(s)}><Pencil className="size-3" />编辑</Button>
                  <Button size="xs" variant="outline" className="text-danger" onClick={() => { SchemeService.remove(s.id); toast('方案已删除', 'info') }}><Trash2 className="size-3" /></Button>
                </div>
              </div>
              <RuleList schemeId={s.id} />
            </div>
          ))}
          {!schemes.length && <p className="py-8 text-center text-[12.5px] text-faint">还没有方案，点击「新建方案」创建。</p>}
        </div>
      </div>

      {/* 方案编辑/规则增删 */}
      {editingScheme && (
        <SchemeEditor
          key={editingScheme.id}
          scheme={editingScheme}
          onClose={() => setEditingScheme(null)}
        />
      )}
    </Modal>
  )
}

function RuleList({ schemeId }: { schemeId: string }) {
  const rules = SchemeService.rules(schemeId)
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState('camera')
  const [brandId, setBrandId] = useState('')
  const [grade, setGrade] = useState('')
  const [kw, setKw] = useState('')
  const [lowPrice, setLowPrice] = useState(false)
  const [editingRule, setEditingRule] = useState<SchemeRule | null>(null)

  const brands = useDB.getState().getTable<{ id: string; name: string }>(T.brands)

  const addRule = () => {
    SchemeService.addRule(schemeId, {
      kind, brand_id: brandId || undefined, grade_code: grade || undefined,
      model_keyword: kw.trim() || undefined, prefer_lowest_price: lowPrice, priority: rules.length * 10,
    })
    setKind('camera'); setBrandId(''); setGrade(''); setKw(''); setLowPrice(false)
    setAdding(false)
  }

  const saveRule = () => {
    if (!editingRule) return
    SchemeService.updateRule(editingRule.id, {
      kind, brand_id: brandId || undefined, grade_code: grade || undefined,
      model_keyword: kw.trim() || undefined, prefer_lowest_price: lowPrice,
    })
    setEditingRule(null)
  }

  return (
    <div className="px-3 py-2">
      {rules.length > 0 && (
        <ul className="mb-2 space-y-1">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md bg-surface-subtle/60 px-2 py-1 text-[12px] text-muted">
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10.5px] font-medium text-ink">{KINDS.find((k) => k.value === r.kind)?.label ?? r.kind}</span>
              {r.brand_id && <span className="text-accent">{brandName(r.brand_id)}</span>}
              {r.grade_code && <span>档次：{GRADE_LABEL[r.grade_code]}</span>}
              {r.model_keyword && <span className="font-mono text-[11px]">kw:「{r.model_keyword}」</span>}
              {r.prefer_lowest_price && <span className="text-faint">最低价</span>}
              <div className="ml-auto flex gap-0.5">
                <button type="button" className="rounded p-0.5 text-faint hover:text-accent" onClick={() => { setEditingRule(r); setKind(r.kind); setBrandId(r.brand_id ?? ''); setGrade(r.grade_code ?? ''); setKw(r.model_keyword ?? ''); setLowPrice(r.prefer_lowest_price ?? false) }}><Pencil className="size-3" /></button>
                <button type="button" className="rounded p-0.5 text-faint hover:text-danger" onClick={() => { SchemeService.removeRule(r.id) }}><Trash2 className="size-3" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding || editingRule ? (
        <div className="space-y-1.5 rounded-md border border-accent/30 bg-accent-soft/20 p-2">
          <div className="grid grid-cols-2 gap-1.5">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-7 rounded-[6px] border border-rule bg-surface px-2 text-[12px]">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="h-7 rounded-[6px] border border-rule bg-surface px-2 text-[12px]">
              <option value="">不限品牌</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="h-7 rounded-[6px] border border-rule bg-surface px-2 text-[12px]">
              <option value="">不限档次</option>
              {Object.entries(GRADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="型号关键词（可选）" className="h-7 text-[12px]" />
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-muted">
            <input type="checkbox" checked={lowPrice} onChange={(e) => setLowPrice(e.target.checked)} className="accent-accent" />
            命中多个时优先最低价
          </label>
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => { setAdding(false); setEditingRule(null) }}>取消</Button>
            <Button size="xs" onClick={editingRule ? saveRule : addRule}>{editingRule ? '保存' : '添加'}</Button>
          </div>
        </div>
      ) : (
        <Button size="xs" variant="ghost" className="text-accent" onClick={() => setAdding(true)}><Plus className="size-3" />添加规则</Button>
      )}
    </div>
  )

  function brandName(id: string) {
    return brands.find((b) => b.id === id)?.name ?? id
  }
}

/* ---------- 方案基础信息编辑 ---------- */
function SchemeEditor({ scheme, onClose }: { scheme: SelectionScheme; onClose: () => void }) {
  const [name, setName] = useState(scheme.name)
  const [desc, setDesc] = useState(scheme.description ?? '')
  const save = () => {
    if (!name.trim()) { toast('请填写方案名称', 'warn'); return }
    SchemeService.update(scheme.id, { name: name.trim(), description: desc })
    toast('方案已保存')
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`编辑方案：${scheme.name}`}
      width={420}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>取消</Button><Button size="sm" onClick={save}>保存</Button></>}
    >
      <div className="space-y-3">
        <Field label="方案名称" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="说明"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="方案用途说明…" /></Field>
      </div>
    </Modal>
  )
}

const GRADE_LABEL: Record<string, string> = { economic: '经济型', standard: '标准型', premium: '高端型' }