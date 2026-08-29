import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type {
  ModelGradeBinding, Grade, ProductModel, Product,
  DeviceSelection, StandardSystem, ProjectSystem, Project, BillItem,
} from '../types/domain'
import { SelectionEngine } from '../engines'
import ctx from './ctx'
import { uid } from '../lib/utils'
import { DevicePricing } from './device.pricing'

/* ---------- 档次绑定 / 预警 / 批量操作 ---------- */
/* price / setPrice 定义在 device.pricing；本模块方法经 this 调用，故按引用并入（聚合到 DeviceService 后均成立） */
const gradeDeps = {
  price: DevicePricing.price,
  setPrice: DevicePricing.setPrice,
}

export const DeviceGrade = {
  ...gradeDeps,
  /* ---------- 档次绑定（model_grade_bindings，选型引擎优先读取） ---------- */
  gradeBindings(modelId: string): ModelGradeBinding[] {
    return repository.where<ModelGradeBinding>(T.model_grade_bindings, (r) => r.model_id === modelId)
  },
  /** 型号挂 / 摘某个档次（code → grade_id） */
  setGradeBinding(modelId: string, gradeCode: string, on: boolean) {
    const gradeId = SelectionEngine.gradeIdByCode(ctx, gradeCode)
    if (!gradeId) return
    const existing = repository.getTable<ModelGradeBinding>(T.model_grade_bindings).find((b) => b.model_id === modelId && b.grade_id === gradeId)
    if (on && !existing) {
      repository.insert(T.model_grade_bindings, { id: uid('mgb'), model_id: modelId, grade_id: gradeId, is_default: true } as unknown as ModelGradeBinding)
    } else if (!on && existing) {
      repository.remove(T.model_grade_bindings, existing.id)
    }
  },
  /** 型号主档（表单下拉）写入：覆盖旧绑定，仅保留所选档，并镜像 grade_code —— 保证绑定表与 grade_code 同步 */
  setModelDefaultGrade(modelId: string, gradeCode?: string) {
    repository.getTable<ModelGradeBinding>(T.model_grade_bindings)
      .filter((b) => b.model_id === modelId)
      .forEach((b) => repository.remove(T.model_grade_bindings, b.id))
    repository.update(T.product_models, modelId, { grade_code: gradeCode })
    if (gradeCode) this.setGradeBinding(modelId, gradeCode, true)
  },
  /** 型号档位（展示/筛选口径）：绑定表优先，其次 grade_code —— 与选型引擎一致 */
  gradeCodeOf(modelId: string): string | undefined {
    const gradeId = this.gradeBindings(modelId)[0]?.grade_id
    if (gradeId) return repository.getTable<Grade>(T.grades).find((g) => g.id === gradeId)?.code
    return repository.getById<ProductModel>(T.product_models, modelId)?.grade_code
  },
  /** 某产品族各档可用型号数（含绑定 + grade_code 兜底，供缺档上下文展示） */
  familyGradeCoverage(familyId: string): { grade: string; label: string; count: number }[] {
    const db = repository.db
    const famModels = new Set((db[T.products] ?? []).filter((p) => (p as Product).product_family_id === familyId).map((p) => p.id))
    const models = (db[T.product_models] ?? []).filter((m) => famModels.has((m as ProductModel).product_id) && (m as ProductModel).status !== 'disabled') as ProductModel[]
    const bound = new Set(this.gradeBindingsOfModels(models.map((m) => m.id)))
    return ['economic', 'standard', 'premium'].map((g) => {
      const gradeId = SelectionEngine.gradeIdByCode(ctx, g)
      const count = models.filter((m) => bound.has(m.id) ? this.gradeBindings(m.id).some((b) => b.grade_id === gradeId) : m.grade_code === g).length
      return { grade: g, label: { economic: '经济型', standard: '标准型', premium: '高端型' }[g] ?? g, count }
    })
  },
  gradeBindingsOfModels(modelIds: string[]): Set<string> {
    const boundIds = new Set<string>()
    const all = repository.getTable<ModelGradeBinding>(T.model_grade_bindings)
    modelIds.forEach((mid) => { if (all.some((b) => b.model_id === mid)) boundIds.add(mid) })
    return boundIds
  },

  /** 缺价 / 缺档 / 停用被引用的预警统计（缺档口径：设备类型 × 档位，绑定/grade_code 优先判定） */
  stats(): { missingPrice: number; missingGrade: { deviceTypeId: string; deviceTypeName: string; grade: string; gradeLabel: string }[]; disabledInUse: number } {
    const db = repository.db
    const models = db[T.product_models] as ProductModel[]
    const active = models.filter((m) => m.status !== 'disabled')
    const missingPrice = active.filter((m) => this.price(m.id) <= 0).length
    const products = (db[T.products] ?? []) as Product[]
    const gradeCodes = (db[T.grades] ?? []).map((g) => (g as Grade).code)
    const gradeName = new Map((db[T.grades] ?? []).map((g) => [(g as Grade).code, (g as Grade).name]))
    const missingGrade: { deviceTypeId: string; deviceTypeName: string; grade: string; gradeLabel: string }[] = []
    for (const p of products) {
      const pModels = active.filter((m) => m.product_id === p.id)
      if (!pModels.length) continue // 无型号的设备类型不参与缺档判定
      for (const g of gradeCodes) {
        if (!pModels.some((m) => this.gradeCodeOf(m.id) === g)) {
          missingGrade.push({ deviceTypeId: p.id, deviceTypeName: p.name, grade: g, gradeLabel: gradeName.get(g) ?? g })
        }
      }
    }
    const usedIds = new Set((db[T.device_selections] ?? []).map((s) => (s as DeviceSelection).model_id))
    ;(db[T.bill_items] ?? []).forEach((i) => usedIds.add((i as BillItem).device_model_id ?? ''))
    const disabledInUse = models.filter((m) => m.status === 'disabled' && usedIds.has(m.id)).length
    return { missingPrice, missingGrade, disabledInUse }
  },

  /* ---------- R3：批量操作 ---------- */
  /** 批量停用 / 启用 */
  batchSetStatus(modelIds: string[], status: 'active' | 'disabled') {
    const { update } = repository
    modelIds.forEach((id) => update(T.product_models, id, { status }))
  },
  /** 批量调整参考价：percent 为百分比增幅（-50 ~ 200），按当前参考价计算；无价型号跳过并计数 */
  batchAdjustPrice(modelIds: string[], percent: number): { adjusted: number; skipped: number } {
    let adjusted = 0
    let skipped = 0
    modelIds.forEach((id) => {
      const cur = this.price(id)
      if (cur <= 0) { skipped++; return }
      this.setPrice(id, 'reference', Math.round(cur * (1 + percent / 100)), { source: '批量调价' })
      adjusted++
    })
    return { adjusted, skipped }
  },
  /** 设备库导出 CSV */
  exportModelsCsv(models: { brand: string; model: string; spec?: string; unit?: string; grade?: string; price: number; status?: string }[]): string {
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const head = ['品牌', '型号', '规格', '单位', '档次', '参考价', '状态']
    const body = models.map((m) => [m.brand, m.model, m.spec, m.unit, m.grade, m.price, m.status].map(esc).join(','))
    return '\uFEFF' + [head.join(','), ...body].join('\n')
  },
  /** 价格影响分析：按最新参考价 vs 项目选型快照，汇总各系统差额（不写库） */
  priceImpact(): { psId: string; systemName: string; projectName: string; oldTotal: number; newTotal: number; diff: number }[] {
    const db = repository.db
    const psName = new Map<string, { system: string; project: string }>()
    const sysName = new Map((db[T.systems] ?? []).map((s) => [s.id, (s as StandardSystem).name]))
    const projName = new Map((db[T.projects] ?? []).map((p) => [p.id, (p as Project).name]))
    for (const ps of db[T.project_systems] ?? []) {
      const r = ps as ProjectSystem
      psName.set(r.id, { system: sysName.get(r.system_id) ?? '未知系统', project: projName.get(r.project_id) ?? '未知项目' })
    }
    const byPs = new Map<string, { oldTotal: number; newTotal: number }>()
    for (const s of db[T.device_selections] ?? []) {
      const sel = s as DeviceSelection
      const newPrice = this.price(sel.model_id)
      if (newPrice <= 0) continue // 缺价型号不影响
      const row = byPs.get(sel.project_system_id) ?? { oldTotal: 0, newTotal: 0 }
      row.oldTotal += sel.total_price || 0
      row.newTotal += newPrice * (sel.quantity || 0)
      byPs.set(sel.project_system_id, row)
    }
    return [...byPs.entries()]
      .map(([psId, v]) => {
        const meta = psName.get(psId) ?? { system: '未知系统', project: '未知项目' }
        return { psId, systemName: meta.system, projectName: meta.project, ...v, diff: v.newTotal - v.oldTotal }
      })
      .filter((r) => Math.abs(r.diff) > 0.01)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  },
}