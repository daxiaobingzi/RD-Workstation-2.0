import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { BillItem, BillVersion } from '../types/domain'
import { BillEngine } from '../engines'
import ctx from './ctx'

/* ---------- 清单 Service ---------- */
export const BillService = {
  generate(psId: string, projectId: string) {
    const { version, items } = BillEngine.generate(ctx, psId, projectId)
    repository.insert(T.bill_versions, version)
    repository.insertMany(T.bill_items, items)
    return { version, items }
  },
  /** 项目级生成（预算页「确认生成清单」）：合并所有子系统选型 + 定额材料为同一版本 V{n+1} */
  generateProject(projectId: string) {
    const { version, items } = BillEngine.generateProject(ctx, projectId)
    repository.insert(T.bill_versions, version)
    repository.insertMany(T.bill_items, items)
    return { version, items }
  },
  versions(projectId: string): BillVersion[] {
    return repository
      .where<BillVersion>(T.bill_versions, (r) => r.project_id === projectId)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  },
  items(billVersionId: string): (BillItem & { deviceName?: string; deviceCategory?: string; brandName?: string; spec?: string; detail?: string; deviceCode?: string })[] {
    const db = repository.db
    // 富化：设备名称/类别/品牌/编码 —— bill_item.device_model_id → ProductModel.product_id → Product；型号 → ModelBrand → Brand
    const modelOf = new Map((db[T.product_models] ?? []).map((m) => [(m as { id: string }).id, m]))
    const productOf = new Map(
      (db[T.products] ?? []).map((p) => [(p as { id: string }).id, p as unknown as { name: string; category?: string; device_code?: string; specification?: string; unit?: string }]),
    )
    const brandIdOfModel = new Map((db[T.model_brands] ?? []).map((mb) => [(mb as unknown as { model_id: string }).model_id, (mb as unknown as { brand_id: string }).brand_id]))
    const brandNameOf = new Map((db[T.brands] ?? []).map((b) => [(b as { id: string }).id, (b as unknown as { name: string }).name]))
    /** 定额材料行的五区分组键：线缆/管材 → cable，辅材 → aux，其余 → other */
    const quotaZone = (category?: string): string => {
      const c = category ?? ''
      if (c.includes('线缆') || c.includes('管材')) return 'cable'
      if (c.includes('辅材') || c === 'aux') return 'aux'
      if (c === 'cable' || c === 'conduit' || c === 'aux' || c === 'other') return c === 'conduit' ? 'cable' : c
      return 'other'
    }
    /** 去 HTML 标签 → 压缩空白 → 截断：兼容历史富文本种子与现纯文本录入 */
    const textOf = (html?: string, max = 100) => {
      if (!html) return undefined
      const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (!t) return undefined
      return t.length > max ? `${t.slice(0, max)}…` : t
    }
    return repository
      .where<BillItem>(T.bill_items, (r) => r.bill_version_id === billVersionId)
      .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
      .map((i) => {
        const m = i.device_model_id ? modelOf.get(i.device_model_id) : undefined
        const prod = m ? productOf.get((m as { product_id?: string }).product_id ?? '') : undefined
        const bid = m ? brandIdOfModel.get(m.id) : undefined
        // 设备中心字段口径：通用参数 = 设备类型 Product.specification；详细参数 = 型号 ProductModel.detail_html
        // 选型设备行有对应 Product → 通用参数取 Product.specification（设备无通用参数则显示 —）；
        // 定额材料 / 手工行无 Product → 通用参数回落清单快照 specification（材料品牌/型号/参数）
        const spec = prod ? textOf(prod.specification) : textOf(i.specification)
        const detail = m ? textOf((m as { detail_html?: string }).detail_html, 100) : undefined
        const unit = prod?.unit ?? (m as { unit?: string } | undefined)?.unit ?? i.unit
        // 五区分组键：选型设备行取产品 category（front/back/cable/aux/other）；定额材料行按材料类别映射；手工行按自身 category 兜底
        const deviceCategory = i.source_type === 'quota'
          ? quotaZone(i.category)
          : (prod?.category ?? (i.category === 'cable' || i.category === 'aux' || i.category === 'other' ? i.category : 'other'))
        return {
          ...i,
          deviceName: prod?.name ?? i.item_name,
          deviceCategory,
          deviceCode: prod?.device_code,
          brandName: bid ? brandNameOf.get(bid) : undefined,
          spec,
          detail,
          unit,
        }
      })
  },
  /** 单条清单项（按 id 直取，供预算/清单行回溯设备来源） */
  itemById(id?: string): BillItem | undefined {
    if (!id) return undefined
    return repository.getById<BillItem>(T.bill_items, id)
  },
  /** 手工调整清单项（数量 / 单价 / 备注 / 排序），自动重算金额并打 manual 标记（重新生成时保留） */
  updateItem(id: string, patch: Partial<Pick<BillItem, 'quantity' | 'unit_price' | 'remark' | 'sort_order'>>) {
    const it = repository.getById<BillItem>(T.bill_items, id)
    if (!it) return
    const quantity = patch.quantity ?? it.quantity
    const unitPrice = patch.unit_price ?? it.unit_price
    const tuned = patch.quantity !== undefined || patch.unit_price !== undefined
    repository.update(T.bill_items, id, {
      quantity,
      unit_price: unitPrice,
      amount: quantity * unitPrice,
      manually_tuned: tuned ? true : it.manually_tuned,
      ...(patch.remark !== undefined ? { remark: patch.remark } : {}),
      ...(patch.sort_order != null ? { sort_order: patch.sort_order } : {}),
    })
  },
  /** 新增自定义清单行（手工补充材料/行项目），返回新行 */
  addItem(versionId: string, data: Partial<Pick<BillItem, 'item_name' | 'specification' | 'unit' | 'category'>> & { quantity: number; unit_price: number }): BillItem {
    const items = this.items(versionId)
    const nextSort = items.length ? Math.max(...items.map((i) => i.sort_order ?? 0)) + 1 : 0
    const it: BillItem = {
      id: `bi-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      bill_version_id: versionId,
      item_code: `BI-${String(nextSort + 1).padStart(3, '0')}`,
      item_name: data.item_name || '自定义项',
      specification: data.specification,
      unit: data.unit,
      category: data.category || '其他',
      quantity: data.quantity || 0,
      unit_price: data.unit_price || 0,
      amount: (data.quantity || 0) * (data.unit_price || 0),
      source_type: 'manual',
      sort_order: nextSort,
    }
    repository.insert(T.bill_items, it)
    return it
  },
  /** 删除清单行 */
  removeItem(id: string) {
    repository.remove(T.bill_items, id)
  },
  /** 版本状态流转：draft / confirmed（已确认） */
  setVersionStatus(versionId: string, status: string) {
    repository.update(T.bill_versions, versionId, { status, updated_at: new Date().toISOString() })
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
    repository.remove(T.bill_versions, versionId)
    repository.removeMany(T.bill_items, (r) => (r as BillItem).bill_version_id === versionId)
    // 级联删除基于该版本的预算及其明细（预算清单/概算清单同源；若删除的是当前预算来源版本，预算区将自动为空态）
    const bidSet = new Set(
      repository.getTable<{ id: string; bill_version_id?: string }>(T.budgets)
        .filter((b) => b.bill_version_id === versionId)
        .map((b) => b.id),
    )
    repository.removeMany(T.budgets, (b) => (b as { bill_version_id?: string }).bill_version_id === versionId)
    if (bidSet.size) {
      repository.removeMany(T.budget_items, (it) => bidSet.has((it as { budget_id?: string }).budget_id ?? ''))
    }
  },
  /** 版本对比：added / removed / changed（按稳定溯源键匹配，不依赖 item_code 位置编码） */
  compareVersions(v1Id: string, v2Id: string) {
    const items1 = this.items(v1Id)
    const items2 = this.items(v2Id)
    // 稳定键：selection → device_model_id（缺省按名称兜底）；quota（定额材料）→ source_id；manual（自定义行）→ 名称
    // 跨版本同一设备的归一行即使 item_code 或排序变化也能正确匹配；manual 行跨版本延续时按名称匹配
    const key = (i: BillItem): string => {
      if (i.source_type === 'quota' && i.source_id) return `quota:${i.source_id}`
      if (i.source_type === 'manual') return `manual:${i.item_name}`
      if (i.device_model_id) return `model:${i.device_model_id}`
      if (i.source_type === 'selection' && i.item_name) return `sel-name:${i.item_name}`
      return `raw:${i.id}`
    }
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