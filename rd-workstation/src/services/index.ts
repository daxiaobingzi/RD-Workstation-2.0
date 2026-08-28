/**
 * RD Workstation 2.0 · Domain Services（业务编排层）
 * React 禁止直改库，所有变更经 Service → Repository(useDB)；派生计算经 Engine。
 */
import { useDB } from '../db/memory-db'
import { T } from '../types/domain'
import type {
  BillItem, BillVersion, Brand, Budget, BudgetItem, DeviceCategory, DeviceSelection,
  DesignParameter, DesignResult, Grade, ModelBrand, ModelGradeBinding, Point, PointCategory, Price, Product,
  ProductFamily, ProductModel, Project, ProjectSystem, Schedule, StandardSystem, Supplier, Task, KnowledgeItem,
} from '../types/domain'
import { DesignEngine, BillEngine, BudgetEngine, SelectionEngine, ValidationEngine, type EngineCtx } from '../engines'
import { uid, todayISO } from '../lib/utils'

const ctx: EngineCtx = {
  get: <X>(t: string) => useDB.getState().getTable<X>(t),
}

function nowIso() {
  return new Date().toISOString()
}

/* ---------- 项目 Service ---------- */
export const ProjectService = {
  list(): Project[] {
    return useDB.getState().getTable<Project>(T.projects).filter((p) => !p.archived_at)
  },
  get(id: string): Project | undefined {
    return useDB.getState().getById<Project>(T.projects, id)
  },
  create(data: Partial<Project>): Project {
    const p: Project = {
      id: uid('proj'),
      project_code: data.project_code || `PJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
      name: data.name || '未命名项目',
      project_type: data.project_type,
      building_type: data.building_type,
      client_name: data.client_name,
      location: data.location,
      building_area: data.building_area,
      floor_count: data.floor_count,
      design_stage: data.design_stage || '方案',
      status: data.status || 'draft',
      default_grade_code: data.default_grade_code || 'standard',
      start_date: data.start_date,
      planned_end_date: data.planned_end_date,
      description: data.description,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    useDB.getState().insert(T.projects, p)
    return p
  },
  update(id: string, patch: Partial<Project>) {
    useDB.getState().update(T.projects, id, { ...patch, updated_at: nowIso() })
  },
  remove(id: string) {
    useDB.getState().remove(T.projects, id)
    useDB.getState().removeMany(T.project_systems, (r) => (r as ProjectSystem).project_id === id)
  },

  /** 项目系统（含标准系统名） */
  systems(projectId: string): (ProjectSystem & { systemName: string; systemCode: string })[] {
    const all = useDB.getState().getTable<ProjectSystem>(T.project_systems)
    const sysMap = new Map(useDB.getState().getTable<StandardSystem>(T.systems).map((s) => [s.id, s]))
    return all
      .filter((ps) => ps.project_id === projectId)
      .map((ps) => ({
        ...ps,
        systemName: sysMap.get(ps.system_id)?.name ?? '未知系统',
        systemCode: sysMap.get(ps.system_id)?.code ?? '',
      }))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  },

  addSystem(projectId: string, systemId: string, grade?: string): ProjectSystem {
    const existing = useDB.getState().where<ProjectSystem>(
      T.project_systems,
      (r) => r.project_id === projectId && r.system_id === systemId,
    )
    if (existing.length) return existing[0]
    const ps: ProjectSystem = {
      id: uid('ps'),
      project_id: projectId,
      system_id: systemId,
      status: 'draft',
      progress: 0,
      design_grade: grade,
      sort_order: useDB.getState().getTable<ProjectSystem>(T.project_systems).filter((s) => s.project_id === projectId).length + 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    useDB.getState().insert(T.project_systems, ps)
    return ps
  },

  removeSystem(psId: string) {
    useDB.getState().remove(T.project_systems, psId)
  },
}

/* ---------- 系统 / 设计参数 ---------- */
export const SystemService = {
  listStandard(): StandardSystem[] {
    return useDB.getState().getTable<StandardSystem>(T.systems).filter((s) => s.enabled !== false)
  },
  params(psId: string): DesignParameter[] {
    return useDB.getState().where<DesignParameter>(T.design_parameters, (r) => r.project_system_id === psId)
  },
  setParam(psId: string, key: string, name: string, value: number | string | boolean, unit?: string) {
    const existing = useDB.getState().where<DesignParameter>(T.design_parameters, (r) => r.project_system_id === psId && r.parameter_key === key)
    const valueType = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string'
    if (existing.length) {
      useDB.getState().update(T.design_parameters, existing[0].id, { value_json: value, value_type: valueType, unit })
    } else {
      useDB.getState().insert(T.design_parameters, {
        id: uid('dp'), project_system_id: psId, parameter_key: key, parameter_name: name,
        value_type: valueType, value_json: value, unit, required: true,
      } as unknown as DesignParameter)
    }
  },
}

/* ---------- 点位 Service ---------- */
export interface ImportPointRow {
  point_code?: string
  point_name: string
  category_id?: string
  category_name?: string
  floor?: string
  space?: string
  quantity: number
  remark?: string
}

/** 批量导入解析：支持 CSV / TSV / Excel 矩阵（首行可含表头） */
export function parsePointRows(rows: (string | number)[][], categories: PointCategory[]): { rows: ImportPointRow[]; errors: { line: number; message: string }[] } {
  const headerMap: Record<string, keyof ImportPointRow> = {
    named: 'point_name', name: 'point_name', point_name: 'point_name', 点位名称: 'point_name', 点名称: 'point_name', 名称: 'point_name', 点位数: 'point_name',
    category: 'category_name', category_name: 'category_name', 点类型: 'category_name', 点位类别: 'category_name', 类别: 'category_name', 分类: 'category_name', 摄像机类别: 'category_name',
    floor: 'floor', 楼层: 'floor',
    space: 'space', location: 'space', 位置: 'space', 区域: 'space', 区域位置: 'space',
    quantity: 'quantity', qty: 'quantity', count: 'quantity', 数量: 'quantity', 台数: 'quantity',
    remark: 'remark', note: 'remark', 备注: 'remark',
  }
  const nameAlias: Record<string, string> = { point_code: 'point_code', 编号: 'point_code', 点位编号: 'point_code', code: 'point_code' }

  // 类别匹配：名称 / 编码 / id
  const catByName = new Map(categories.map((c) => [c.name, c]))
  const catByCode = new Map(categories.map((c) => [c.code, c]))
  const catById = new Map(categories.map((c) => [c.id, c]))
  const matchCat = (raw: string) => catByName.get(raw) ?? catByCode.get(raw) ?? catById.get(raw) ?? catByName.get(raw.trim())

  const rowsOut: ImportPointRow[] = []
  const errors: { line: number; message: string }[] = []
  if (!rows.length) return { rows: rowsOut, errors }

  const first = rows[0]
  const headerKeys = first.map((c) => String(c).trim())
  const known = headerKeys.some((k) => Object.keys(headerMap).includes(k.toLowerCase()))
  const offset = known ? 1 : 0

  rows.slice(offset).forEach((raw, idx) => {
    const line = idx + offset + 1
    const cell = (i: number) => String(raw[i] ?? '').trim()
    let pointName = ''
    let categoryName = ''
    let floor = ''
    let space = ''
    let quantity = 1
    let remark = ''
    let pointCode: string | undefined

    if (known) {
      headerKeys.forEach((h, i) => {
        const key = headerMap[h.toLowerCase()]
        const v = cell(i)
        if (key === 'point_name') pointName = v
        else if (key === 'category_name') categoryName = v
        else if (key === 'floor') floor = v
        else if (key === 'space') space = v
        else if (key === 'quantity') quantity = Number(v) || 0
        else if (key === 'remark') remark = v
      })
      headerKeys.forEach((h, i) => {
        if (nameAlias[h.toLowerCase()]) pointCode = cell(i) || undefined
      })
    } else {
      pointName = cell(0)
      categoryName = cell(1)
      floor = cell(2)
      space = cell(3)
      quantity = Number(cell(4)) || 0
      remark = cell(5)
      pointCode = undefined
    }

    if (!pointName) {
      errors.push({ line, message: '缺少点位名称，已跳过' })
      return
    }
    if (quantity <= 0) {
      errors.push({ line, message: `「${pointName}」数量无效（${cell(4) || quantity}），已按 1 处理` })
      quantity = 1
    }
    const cat = categoryName ? matchCat(categoryName) : undefined
    rowsOut.push({
      point_code: pointCode,
      point_name: pointName,
      category_id: cat?.id,
      category_name: categoryName || cat?.name,
      floor,
      space,
      quantity,
      remark,
    })
  })
  return { rows: rowsOut, errors }
}

export const PointService = {
  list(psId: string): Point[] {
    return useDB.getState().getTable<Point>(T.points).filter((p) => p.project_system_id === psId)
  },
  categories(systemId: string): PointCategory[] {
    return useDB.getState().where<PointCategory>(T.point_categories, (r) => r.system_id === systemId && r.enabled !== false)
  },
  add(psId: string, data: Partial<Point>): Point {
    const pts = useDB.getState().getTable<Point>(T.points).filter((p) => p.project_system_id === psId)
    const p: Point = {
      id: uid('pt'),
      project_system_id: psId,
      point_code: data.point_code || `VSS-C-${String(pts.length + 1).padStart(3, '0')}`,
      point_name: data.point_name || '新点位',
      category_id: data.category_id,
      building: data.building,
      floor: data.floor,
      space: data.space,
      location: data.location ?? data.space,
      quantity: data.quantity ?? 1,
      unit: data.unit ?? '台',
      design_requirement: data.design_requirement,
      remark: data.remark,
      status: data.status ?? 'designed',
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    useDB.getState().insert(T.points, p)
    return p
  },
  update(id: string, patch: Partial<Point>) {
    useDB.getState().update(T.points, id, { ...patch, updated_at: nowIso() })
  },
  remove(id: string) {
    useDB.getState().remove(T.points, id)
  },
  removeMany(ids: string[]) {
    useDB.getState().removeMany(T.points, (r) => ids.includes(r.id))
  },
  /** 批量导入点位（CSV/Excel 解析后的行） */
  addMany(psId: string, rows: ImportPointRow[]): Point[] {
    const pts = useDB.getState().getTable<Point>(T.points).filter((p) => p.project_system_id === psId)
    const created = rows.map((r, i) => {
      const p: Point = {
        id: uid('pt'),
        project_system_id: psId,
        point_code: r.point_code || (r.point_name.includes('VSS-C-')
          ? r.point_name
          : `VSS-C-${String(pts.length + i + 1).padStart(3, '0')}`),
        point_name: r.point_name,
        category_id: r.category_id,
        floor: r.floor,
        space: r.space,
        location: r.space,
        quantity: r.quantity || 1,
        unit: '台',
        remark: r.remark,
        status: 'designed',
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      return p
    })
    useDB.getState().insertMany(T.points, created)
    return created
  },

  /** 批量导入模板（含示例行） */
  importTemplate(): string {
    return ['点位名称,类别,楼层,位置,数量,备注', '大厅高清枪机,室内摄像机,1F,大堂,12,标准档', '走廊半球,室内摄像机,2F,走廊,8,'].join('\n')
  },
  updateMany(updates: { id: string; patch: Partial<Point> }[]) {
    const { update } = useDB.getState()
    updates.forEach(({ id, patch }) => update(T.points, id, { ...patch, updated_at: nowIso() }))
  },
}

/* ---------- 设计链 Service：推导 → 选型 → 结果 ---------- */
export const DesignService = {
  /** 跑 DesignEngine，写 design_results + 生成 device_selections（按项目系统档次） */
  derive(psId: string) {
    const db = useDB.getState().db
    const ps = db[T.project_systems].find((r) => (r as ProjectSystem).id === psId) as ProjectSystem | undefined
    const grade = ps?.design_grade ?? 'standard'
    const { results } = DesignEngine.run(ctx, psId)
    const oldResults = db[T.design_results] ?? []
    useDB.getState().replace(
      T.design_results,
      oldResults.filter((r) => (r as DesignResult).project_system_id !== psId).concat(results),
    )
    const selections = SelectionEngine.deriveSelections(ctx, psId, grade, results)
    const oldSelections = db[T.device_selections] ?? []
    useDB.getState().replace(
      T.device_selections,
      oldSelections.filter((r) => (r as DeviceSelection).project_system_id !== psId).concat(selections),
    )
    return { results, selections }
  },

  results(psId: string): DesignResult[] {
    return useDB.getState().where<DesignResult>(T.design_results, (r) => r.project_system_id === psId)
  },

  selections(psId: string): (DeviceSelection & { modelName?: string; spec?: string; brand?: string })[] {
    const all = useDB.getState().getTable<DeviceSelection>(T.device_selections)
    const modelMap = new Map(useDB.getState().getTable<ProductModel>(T.product_models).map((m) => [m.id, m]))
    const brandMap = new Map(
      useDB
        .getState()
        .getTable<{ model_id: string; brand_id: string }>(T.model_brands)
        .map((mb) => [mb.model_id, mb.brand_id]),
    )
    const brandName = new Map(useDB.getState().getTable<Brand>(T.brands).map((b) => [b.id, b.name]))
    return all
      .filter((s) => s.project_system_id === psId)
      .map((s) => {
        const m = modelMap.get(s.model_id)
        const bid = brandMap.get(s.model_id)
        return { ...s, modelName: m?.model, spec: m?.specification, brand: bid ? brandName.get(bid) : undefined }
      })
  },

  check(psId: string) {
    return ValidationEngine.check(ctx, psId)
  },

  /** 项目系统进度估算：从点位/推导/清单三环节加权 */
  progress(psId: string): number {
    const pts = PointService.list(psId).length
    const results = this.results(psId).length
    const selections = this.selections(psId).length
    const score = (pts > 0 ? 0.4 : 0) + (results > 0 ? 0.3 : 0) + (selections > 0 ? 0.3 : 0)
    return Math.round(score * 100)
  },
}

/* ---------- 清单 / 预算 Service ---------- */
export const BillService = {
  generate(psId: string, projectId: string) {
    const { version, items } = BillEngine.generate(ctx, psId, projectId)
    useDB.getState().insert(T.bill_versions, version)
    useDB.getState().insertMany(T.bill_items, items)
    return { version, items }
  },
  versions(projectId: string): BillVersion[] {
    return useDB
      .getState()
      .where<BillVersion>(T.bill_versions, (r) => r.project_id === projectId)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  },
  items(billVersionId: string): BillItem[] {
    return useDB.getState().where<BillItem>(T.bill_items, (r) => r.bill_version_id === billVersionId)
  },
  /** 手工调整清单项（数量 / 单价等），自动重算金额 */
  updateItem(id: string, patch: Pick<BillItem, 'quantity' | 'unit_price'>) {
    const it = useDB.getState().getById<BillItem>(T.bill_items, id)
    if (!it) return
    const quantity = patch.quantity ?? it.quantity
    const unitPrice = patch.unit_price ?? it.unit_price
    useDB.getState().update(T.bill_items, id, { quantity, unit_price: unitPrice, amount: quantity * unitPrice })
  },
  /** 按类别汇总（供分类小计） */
  summary(billVersionId: string): { category: string; count: number; quantity: number; amount: number }[] {
    const agg = new Map<string, { count: number; quantity: number; amount: number }>()
    for (const i of this.items(billVersionId)) {
      const key = i.category || '未分类'
      const cur = agg.get(key) ?? { count: 0, quantity: 0, amount: 0 }
      cur.count += 1
      cur.quantity += i.quantity || 0
      cur.amount += i.amount || 0
      agg.set(key, cur)
    }
    return [...agg.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount)
  },
  /** 导出 CSV（含 BOM，Excel 直接打开不乱码） */
  exportCSV(billVersionId: string): string {
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const head = ['编码', '名称', '规格', '类别', '单位', '数量', '单价', '金额']
    const lines = this.items(billVersionId).map((i) =>
      [i.item_code, i.item_name, i.specification, i.category, i.unit, i.quantity, i.unit_price, i.amount].map(esc).join(','),
    )
    return '\uFEFF' + [head.join(','), ...lines].join('\n')
  },
  remove(versionId: string) {
    useDB.getState().remove(T.bill_versions, versionId)
    useDB.getState().removeMany(T.bill_items, (r) => (r as BillItem).bill_version_id === versionId)
  },
  /** 版本对比：added / removed / changed（按 item_code 匹配） */
  compareVersions(v1Id: string, v2Id: string) {
    const items1 = this.items(v1Id)
    const items2 = this.items(v2Id)
    const key = (i: BillItem) => i.item_code ?? i.id
    const map1 = new Map(items1.map((i) => [key(i), i]))
    const map2 = new Map(items2.map((i) => [key(i), i]))
    const added = items2.filter((i) => !map1.has(key(i)))
    const removed = items1.filter((i) => !map2.has(key(i)))
    const changed = items2.filter((i) => {
      const a = map1.get(key(i))
      return !!a && (a.quantity !== i.quantity || a.unit_price !== i.unit_price)
    })
    return { added, removed, changed }
  },
}

export const BudgetService = {
  generate(psId: string, projectId: string, billVersionId: string) {
    const { budget, items } = BudgetEngine.generate(ctx, psId, projectId, billVersionId)
    useDB.getState().insert(T.budgets, budget)
    useDB.getState().insertMany(T.budget_items, items)
    return { budget, items }
  },
  /** 设定目标预算，用于超支预警 */
  setTargetAmount(budgetId: string, amount: number) {
    useDB.getState().update(T.budgets, budgetId, { target_amount: amount })
  },
  byProject(projectId: string): Budget[] {
    return useDB.getState().where<Budget>(T.budgets, (r) => r.project_id === projectId)
  },
  items(budgetId: string): BudgetItem[] {
    return useDB.getState().where<BudgetItem>(T.budget_items, (r) => r.budget_id === budgetId)
  },
  /** 预算构成：按产品族聚合金额（供堆叠条形图） */
  byFamily(budgetId: string): { name: string; amount: number }[] {
    const items = this.items(budgetId)
    const db = useDB.getState().db
    const familyOfModel = new Map<string, string>()
    for (const m of db[T.product_models]) {
      const prod = db[T.products].find((p) => p.id === (m as ProductModel).product_id) as Product | undefined
      if (prod) familyOfModel.set(m.id, prod.product_family_id)
    }
    const famName = new Map(db[T.product_families].map((f) => [f.id, (f as ProductFamily).name]))
    const agg = new Map<string, number>()
    for (const it of items) {
      const billItem = db[T.bill_items].find((x) => x.id === it.bill_item_id) as BillItem | undefined
      const famId = billItem?.device_model_id ? familyOfModel.get(billItem.device_model_id) : undefined
      const name = famId ? (famName.get(famId) ?? '其他') : '其他'
      agg.set(name, (agg.get(name) ?? 0) + it.amount)
    }
    return [...agg.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  },
  /** 档次估算：用同一推导结果为三档分别计算预算总额（不落库） */
  estimateByGrade(psId: string): { grade: string; label: string; total: number }[] {
    const results = DesignService.results(psId)
    const grades = [
      { code: 'economic', label: '经济型' },
      { code: 'standard', label: '标准型' },
      { code: 'premium', label: '高端型' },
    ]
    return grades.map((g) => {
      const sels = SelectionEngine.deriveSelections(ctx, psId, g.code, results)
      return { grade: g.code, label: g.label, total: sels.reduce((s, x) => s + x.total_price, 0) }
    })
  },
}

/* ---------- 任务 / 日程 Service ---------- */
export const TaskService = {
  list(filter?: { projectId?: string; today?: boolean }): Task[] {
    let rows = useDB.getState().getTable<Task>(T.tasks)
    if (filter?.projectId) rows = rows.filter((t) => t.project_id === filter.projectId)
    if (filter?.today) {
      const d = todayISO()
      rows = rows.filter((t) => (t.due_at ?? '').slice(0, 10) === d || (t.created_at ?? '').slice(0, 10) === d)
    }
    return rows.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
  },
  toggle(id: string) {
    const t = useDB.getState().getById<Task>(T.tasks, id)
    if (!t) return
    const done = t.status === 'done'
    useDB.getState().update(T.tasks, id, {
      status: done ? 'todo' : 'done',
      completed_at: done ? null : nowIso(),
      updated_at: nowIso(),
    })
  },
  add(data: Partial<Task>): Task {
    const t: Task = {
      id: uid('task'), title: data.title || '新任务', description: data.description,
      status: data.status ?? 'todo', priority: data.priority ?? 'medium',
      source_type: data.source_type, source_id: data.source_id,
      project_id: data.project_id, project_system_id: data.project_system_id, goal_id: data.goal_id,
      estimated_minutes: data.estimated_minutes, due_at: data.due_at,
      created_at: nowIso(), updated_at: nowIso(),
    }
    useDB.getState().insert(T.tasks, t)
    return t
  },
}

export const ScheduleService = {
  list(date?: string): Schedule[] {
    return useDB.getState().getTable<Schedule>(T.schedules).filter((s) => !date || s.start_at.slice(0, 10) === date)
  },
}

/* ---------- 设备 / 知识 ---------- */
export const DeviceService = {
  categories(): DeviceCategory[] {
    return useDB.getState().getTable<DeviceCategory>(T.device_categories)
  },
  addCategory(data: Partial<DeviceCategory>): DeviceCategory {
    const c: DeviceCategory = { id: uid('dc'), code: data.code || '', name: data.name || '新类别', system_id: data.system_id, category_type: data.category_type, sort_order: 1, enabled: true, ...data }
    useDB.getState().insert(T.device_categories, c)
    return c
  },
  updateCategory(id: string, patch: Partial<DeviceCategory>) {
    useDB.getState().update(T.device_categories, id, patch)
  },
  removeCategory(id: string): { ok: boolean; reason?: string } {
    const inUse = useDB.getState().getTable<ProductFamily>(T.product_families).some((f) => f.device_category_id === id)
    if (inUse) return { ok: false, reason: '该类别下仍有产品族，请先清空' }
    useDB.getState().remove(T.device_categories, id)
    return { ok: true }
  },

  families(categoryId?: string): ProductFamily[] {
    return useDB.getState().getTable<ProductFamily>(T.product_families).filter((f) => !categoryId || f.device_category_id === categoryId)
  },
  addFamily(data: Partial<ProductFamily>): ProductFamily {
    const f: ProductFamily = { id: uid('pf'), device_category_id: data.device_category_id || '', code: data.code || '', name: data.name || '新产品族', sort_order: 1, enabled: true, ...data }
    useDB.getState().insert(T.product_families, f)
    return f
  },
  updateFamily(id: string, patch: Partial<ProductFamily>) {
    useDB.getState().update(T.product_families, id, patch)
  },
  removeFamily(id: string): { ok: boolean; reason?: string } {
    const inUse = useDB.getState().getTable<Product>(T.products).some((p) => p.product_family_id === id)
    if (inUse) return { ok: false, reason: '该产品族下仍有产品/型号，请先清空' }
    useDB.getState().remove(T.product_families, id)
    return { ok: true }
  },

  products(familyId?: string): Product[] {
    return useDB.getState().getTable<Product>(T.products).filter((p) => !familyId || p.product_family_id === familyId)
  },
  addProduct(data: Partial<Product>): Product {
    const p: Product = { id: uid('prod'), product_family_id: data.product_family_id || '', name: data.name || '新产品', manufacturer: data.manufacturer, ...data }
    useDB.getState().insert(T.products, p)
    return p
  },
  updateProduct(id: string, patch: Partial<Product>) {
    useDB.getState().update(T.products, id, patch)
  },

  models(familyId?: string): (ProductModel & { familyId?: string })[] {
    const models = useDB.getState().getTable<ProductModel>(T.product_models)
    const famMap = new Map(useDB.getState().getTable<Product>(T.products).map((p) => [p.id, p.product_family_id]))
    return models
      .map((m) => ({ ...m, familyId: famMap.get(m.product_id) }))
      .filter((m) => !familyId || m.familyId === familyId)
  },
  addModel(data: { product_family_id: string; model: string; specification?: string; unit?: string; grade_code?: string; status?: 'active' | 'disabled'; parameter_json?: Record<string, unknown>; brand_id?: string }): ProductModel | undefined {
    const family = useDB.getState().getById<ProductFamily>(T.product_families, data.product_family_id)
    if (!family) return undefined
    const productId = uid('prod')
    useDB.getState().insert(T.products, { id: productId, product_family_id: family.id, name: data.model, manufacturer: '' } as unknown as Product)
    const model: ProductModel = {
      id: uid('m'), product_id: productId, model: data.model,
      specification: data.specification, unit: data.unit ?? '台',
      grade_code: data.grade_code, status: data.status ?? 'active',
      parameter_json: data.parameter_json ?? {}, created_at: nowIso(),
    }
    useDB.getState().insert(T.product_models, model)
    // 表单主档同步写入绑定表，保证 engine（绑定优先）与 grade_code 口径一致
    this.setModelDefaultGrade(model.id, data.grade_code)
    if (data.brand_id) this.setModelBrand(model.id, data.brand_id)
    return model
  },
  updateModel(id: string, patch: Partial<ProductModel>) {
    useDB.getState().update(T.product_models, id, { ...patch, updated_at: nowIso() })
  },
  setModelStatus(id: string, status: 'active' | 'disabled') {
    useDB.getState().update(T.product_models, id, { status })
  },
  /** 删除保护：被项目选型 / 清单引用的型号禁止物理删除，应转为停用 */
  removeModel(id: string): { ok: boolean; reason?: string } {
    const used = this.modelInUse(id)
    if (used) return { ok: false, reason: '该型号已被项目选型/清单引用，请改为「停用」而非删除' }
    const m = useDB.getState().getById<ProductModel>(T.product_models, id)
    if (m) useDB.getState().remove(T.products, m.product_id)
    useDB.getState().remove(T.product_models, id)
    useDB.getState().removeMany(T.prices, (r) => (r as Price).model_id === id)
    useDB.getState().removeMany(T.model_brands, (r) => (r as ModelBrand).model_id === id)
    useDB.getState().removeMany(T.model_grade_bindings, (r) => (r as ModelGradeBinding).model_id === id)
    return { ok: true }
  },
  modelInUse(modelId: string): boolean {
    const db = useDB.getState().db
    const sel = (db[T.device_selections] ?? []).some((s) => (s as DeviceSelection).model_id === modelId)
    const bill = (db[T.bill_items] ?? []).some((i) => (i as BillItem).device_model_id === modelId)
    return sel || bill
  },
  /** 型号项目使用情况（真·聚合）：项目名单 / 选型量 / 金额 */
  modelUsage(modelId: string): { projectNames: string[]; systemCount: number; totalQty: number; totalAmount: number; selectionCount: number } {
    const db = useDB.getState().db
    const psOf = new Map((db[T.project_systems] ?? []).map((s) => [s.id, s as ProjectSystem]))
    const projName = new Map((db[T.projects] ?? []).map((p) => [p.id, (p as Project).name]))
    const sels = (db[T.device_selections] ?? []).filter((s) => (s as DeviceSelection).model_id === modelId) as DeviceSelection[]
    const systems = new Set(sels.map((s) => s.project_system_id))
    const projectNames = new Set<string>()
    systems.forEach((psId) => { const p = psOf.get(psId); if (p) { const n = projName.get(p.project_id); if (n) projectNames.add(n) } })
    return {
      projectNames: [...projectNames],
      systemCount: systems.size,
      totalQty: sels.reduce((s, x) => s + (x.quantity || 0), 0),
      totalAmount: sels.reduce((s, x) => s + (x.total_price || 0), 0),
      selectionCount: sels.length,
    }
  },

  setModelBrand(modelId: string, brandId: string | undefined) {
    const existing = useDB.getState().getTable<ModelBrand>(T.model_brands).find((mb) => mb.model_id === modelId)
    if (existing) {
      useDB.getState().update(T.model_brands, existing.id, { brand_id: brandId, is_default: true })
    } else if (brandId) {
      useDB.getState().insert(T.model_brands, { id: uid('mb'), model_id: modelId, brand_id: brandId, is_default: true } as unknown as ModelBrand)
    }
  },
  brandOf(modelId: string): { id?: string; name?: string } {
    const db = useDB.getState().db
    const mb = (db[T.model_brands] ?? []).find((r) => (r as ModelBrand).model_id === modelId && (r as ModelBrand).is_default !== false) as ModelBrand | undefined
    const b = mb ? (db[T.brands] ?? []).find((x) => x.id === mb.brand_id) as Brand | undefined : undefined
    return { id: mb?.brand_id, name: b?.name }
  },

  prices(modelId: string): Price[] {
    return useDB.getState().where<Price>(T.prices, (r) => r.model_id === modelId).sort((a, b) => (a.effective_date ?? '').localeCompare(b.effective_date ?? ''))
  },
  price(modelId: string): number {
    const prices = this.prices(modelId)
    const ref = prices.find((p) => p.price_type === 'reference')
    return ref?.price ?? prices[0]?.price ?? 0
  },
  /** 写价格：同类型已有记录则更新，否则新增（reference 为当前生效参考价） */
  setPrice(modelId: string, priceType: Price['price_type'], price: number, extra?: { effective_date?: string; source?: string; supplier_id?: string; remark?: string }) {
    const existing = useDB.getState().getTable<Price>(T.prices).find((p) => p.model_id === modelId && p.price_type === priceType)
    const patch = { price, currency: 'CNY', effective_date: extra?.effective_date, source: extra?.source, supplier_id: extra?.supplier_id, remark: extra?.remark, updated_at: nowIso() }
    if (existing) {
      useDB.getState().update(T.prices, existing.id, patch)
      return existing.id
    }
    const id = uid('price')
    useDB.getState().insert(T.prices, { id, model_id: modelId, price_type: priceType, ...patch, created_at: nowIso() } as unknown as Price)
    return id
  },
  removePrice(id: string) {
    useDB.getState().remove(T.prices, id)
  },

  brands(): Brand[] {
    return useDB.getState().getTable<Brand>(T.brands)
  },
  addBrand(data: Partial<Brand>): Brand {
    const b: Brand = { id: uid('b'), name: data.name || '新品牌', manufacturer_type: data.manufacturer_type, website: data.website, remark: data.remark }
    useDB.getState().insert(T.brands, b)
    return b
  },
  updateBrand(id: string, patch: Partial<Brand>) {
    useDB.getState().update(T.brands, id, patch)
  },
  removeBrand(id: string): { ok: boolean; reason?: string } {
    const inUse = useDB.getState().getTable<ModelBrand>(T.model_brands).some((mb) => mb.brand_id === id)
    if (inUse) return { ok: false, reason: '该品牌已被型号引用，请先解除关联' }
    useDB.getState().remove(T.brands, id)
    return { ok: true }
  },

  grades(): Grade[] {
    return useDB.getState().getTable<Grade>(T.grades)
  },

  /* ---------- 供应商（预留域：询价 / 供应体系） ---------- */
  suppliers(): Supplier[] {
    return useDB.getState().getTable<Supplier>(T.suppliers)
  },
  addSupplier(data: Partial<Supplier>): Supplier {
    const s: Supplier = { id: uid('sup'), name: data.name || '新供应商', contact: data.contact, phone: data.phone, region: data.region, remark: data.remark }
    useDB.getState().insert(T.suppliers, s)
    return s
  },
  updateSupplier(id: string, patch: Partial<Supplier>) {
    useDB.getState().update(T.suppliers, id, patch)
  },
  removeSupplier(id: string): { ok: boolean; reason?: string } {
    const inUse = useDB.getState().getTable<Price>(T.prices).some((p) => p.supplier_id === id)
    if (inUse) return { ok: false, reason: '该供应商已被询价记录引用，请先解除关联' }
    useDB.getState().remove(T.suppliers, id)
    return { ok: true }
  },

  /* ---------- 档次绑定（model_grade_bindings，选型引擎优先读取） ---------- */
  gradeBindings(modelId: string): ModelGradeBinding[] {
    return useDB.getState().where<ModelGradeBinding>(T.model_grade_bindings, (r) => r.model_id === modelId)
  },
  /** 型号挂 / 摘某个档次（code → grade_id） */
  setGradeBinding(modelId: string, gradeCode: string, on: boolean) {
    const gradeId = SelectionEngine.gradeIdByCode(ctx, gradeCode)
    if (!gradeId) return
    const existing = useDB.getState().getTable<ModelGradeBinding>(T.model_grade_bindings).find((b) => b.model_id === modelId && b.grade_id === gradeId)
    if (on && !existing) {
      useDB.getState().insert(T.model_grade_bindings, { id: uid('mgb'), model_id: modelId, grade_id: gradeId, is_default: true } as unknown as ModelGradeBinding)
    } else if (!on && existing) {
      useDB.getState().remove(T.model_grade_bindings, existing.id)
    }
  },
  /** 型号主档（表单下拉）写入：覆盖旧绑定，仅保留所选档，并镜像 grade_code —— 保证绑定表与 grade_code 同步 */
  setModelDefaultGrade(modelId: string, gradeCode?: string) {
    useDB.getState().getTable<ModelGradeBinding>(T.model_grade_bindings)
      .filter((b) => b.model_id === modelId)
      .forEach((b) => useDB.getState().remove(T.model_grade_bindings, b.id))
    useDB.getState().update(T.product_models, modelId, { grade_code: gradeCode })
    if (gradeCode) this.setGradeBinding(modelId, gradeCode, true)
  },
  /** 型号档位（展示/筛选口径）：绑定表优先，其次 grade_code —— 与选型引擎一致 */
  gradeCodeOf(modelId: string): string | undefined {
    const gradeId = this.gradeBindings(modelId)[0]?.grade_id
    if (gradeId) return useDB.getState().getTable<Grade>(T.grades).find((g) => g.id === gradeId)?.code
    return useDB.getState().getById<ProductModel>(T.product_models, modelId)?.grade_code
  },
  /** 某产品族各档可用型号数（含绑定 + grade_code 兜底，供缺档上下文展示） */
  familyGradeCoverage(familyId: string): { grade: string; label: string; count: number }[] {
    const db = useDB.getState().db
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
    const all = useDB.getState().getTable<ModelGradeBinding>(T.model_grade_bindings)
    modelIds.forEach((mid) => { if (all.some((b) => b.model_id === mid)) boundIds.add(mid) })
    return boundIds
  },

  /** 缺价 / 缺档 / 停用被引用的预警统计（缺档口径与选型引擎一致：绑定优先、其次 grade_code、族内无型号不计） */
  stats(): { missingPrice: number; missingGrade: { familyId: string; familyName: string; grade: string; gradeLabel: string }[]; disabledInUse: number } {
    const db = useDB.getState().db
    const models = db[T.product_models] as ProductModel[]
    const active = models.filter((m) => m.status !== 'disabled')
    const missingPrice = active.filter((m) => this.price(m.id) <= 0).length
    const famName = new Map((db[T.product_families] ?? []).map((f) => [f.id, (f as ProductFamily).name]))
    const missingGrade: { familyId: string; familyName: string; grade: string; gradeLabel: string }[] = []
    for (const fam of db[T.product_families] ?? []) {
      const farmId = (fam as ProductFamily).id
      const coverage = this.familyGradeCoverage(farmId)
      if (!coverage.some((c) => c.count > 0)) continue // 族内无型号不参与缺档判定
      for (const c of coverage) {
        if (c.count === 0) missingGrade.push({ familyId: farmId, familyName: famName.get(farmId) ?? '', grade: c.grade, gradeLabel: c.label })
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
    const { update } = useDB.getState()
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
    const db = useDB.getState().db
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

export const KnowledgeService = {
  list(): KnowledgeItem[] {
    return useDB.getState().getTable<KnowledgeItem>(T.knowledge_items)
  },
}
