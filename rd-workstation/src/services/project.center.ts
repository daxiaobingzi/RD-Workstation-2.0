import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { Dictionary, SystemTemplate, StandardSystem } from '../types/domain'
import { uid } from '../lib/utils'
import { ProjectService } from './project.service'

/* =====================================================================================
 * 项目中心 v2 专属 Service：业态字典 + 项目模版（按业态配置与套用）
 * - 业态：项目「类型」→「业态」，随社会发展持续自定义新增
 * - 模版：按业态分组，套用 → 新建项目自动带该业态 + 生成系统集（与默认设计参数）
 * ===================================================================================== */

/** 业态字典分组码（复用 dictionaries 表，不改 Schema）：业态全部由用户自定义，无内置 */
const FORMAT_GROUP = 'project_format'

function dictRows(): Dictionary[] {
  return repository.getTable<Dictionary>(T.dictionaries).filter((d) => d.group_code === FORMAT_GROUP)
}

export const FormatService = {
  /** 幂等补齐默认业态（无内置）：字典为空时播种常用业态，之后全部由用户管理（新增/重命名/移除） */
  ensureDefaults(): number {
    const rows = dictRows()
    if (rows.length) return 0
    const defaults = ['政府 · 公共安全', '办公 · 智能楼宇', '办公 · 金融', '医疗']
    defaults.forEach((n, i) => {
      repository.insert(T.dictionaries, {
        id: uid('dict'), group_code: FORMAT_GROUP, item_code: `fmt_d_${i + 1}`,
        item_name: n, sort_order: i + 1, enabled: true,
      } as Dictionary)
    })
    return defaults.length
  },

  /** 全部业态 = 字典中的全部条目（无内置；新增/重命名/移除均作用于字典） */
  list(): string[] {
    return dictRows()
      .filter((d) => d.enabled !== false)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
      .map((d) => d.item_name)
  },
  /** 新增业态（写字典，全局生效） */
  add(name: string): { ok: boolean; message?: string } {
    const n = name.trim()
    if (!n) return { ok: false, message: '请输入业态名称' }
    if (dictRows().some((d) => d.item_name === n)) return { ok: false, message: '业态已存在' }
    const maxSort = dictRows().reduce((m, d) => Math.max(m, d.sort_order ?? 0), 0)
    repository.insert(T.dictionaries, {
      id: uid('dict'), group_code: FORMAT_GROUP, item_code: `fmt_${Date.now().toString(36)}`,
      item_name: n, sort_order: maxSort + 1, enabled: true,
    } as Dictionary)
    return { ok: true }
  },
  /** 按名称查字典行（供移除管理） */
  find(name: string): Dictionary[] {
    return dictRows().filter((d) => d.item_name === name)
  },
  /** 移除业态字典项（内置兜底不在字典中则无项可移） */
  removeItem(id: string) {
    repository.remove(T.dictionaries, id)
  },
  /** 重命名业态：同步该业态全部项目（业态均为自定义，可直接重命名/移除） */
  rename(name: string, nextName: string): { ok: boolean; message?: string } {
    const n = nextName.trim()
    if (!n) return { ok: false, message: '请输入新名称' }
    if (n === name) return { ok: false, message: '名称未变化' }
    const rows = dictRows().filter((d) => d.item_name === name)
    if (!rows.length) return { ok: false, message: `业态「${name}」不存在` }
    const dup = dictRows().some((d) => d.item_name === n && d.id !== rows[0].id)
    if (dup) return { ok: false, message: `业态「${n}」已存在` }
    for (const r of rows) repository.update(T.dictionaries, r.id, { item_name: n })
    // 同步项目业态与按业态归档的模版
    for (const p of repository.getTable<{ id: string; project_type?: string }>(T.projects)) {
      if (p.project_type === name) repository.update(T.projects, p.id, { project_type: n })
    }
    for (const t of repository.getTable<{ id: string; system_id?: string }>(T.system_templates)) {
      if (t.system_id === `format:${name}`) repository.update(T.system_templates, t.id, { system_id: `format:${n}` })
    }
    return { ok: true, message: `业态「${name}」已重命名为「${n}」` }
  },
}

/* ---------- 项目模版（按业态） ---------- */
interface TplContent {
  version: number
  systems: { systemId: string; grade?: string }[]
}

function stdSystemById(id: string): StandardSystem | undefined {
  return repository.getById<StandardSystem>(T.systems, id)
}

export const ProjectTemplateService = {
  /** 某业态下的模版列表（内置系统集兜底生成 + 用户自定义 system_templates） */
  listByFormat(format: string): { id: string; name: string; description: string; builtin: boolean; systems: { systemId: string; name: string; code: string }[] }[] {
    const out: { id: string; name: string; description: string; builtin: boolean; systems: { systemId: string; name: string; code: string }[] }[] = []
    // 用户自定义模版（system_templates.system_id 承载业态标识，不新增领域表）
    const custom = repository
      .getTable<SystemTemplate>(T.system_templates)
      .filter((t) => t.system_id === `format:${format}` && t.enabled !== false)
    for (const t of custom) {
      const content = t.content_json as TplContent | undefined
      const systems = (content?.systems ?? []).flatMap((s) => {
        const sys = stdSystemById(s.systemId)
        return sys ? [{ systemId: sys.id, name: sys.name, code: sys.code }] : []
      })
      out.push({ id: t.id, name: t.name.replace(new RegExp(`^${format}-`), ''), description: t.description ?? '', builtin: false, systems })
    }
    return out
  },

  /** 从当前项目生成模版（连同业态、系统集、档次） */
  generateFromProject(projectId: string, name: string): { ok: boolean; message?: string } {
    const proj = ProjectService.get(projectId)
    if (!proj || !proj.project_type) return { ok: false, message: '项目不存在或未设置业态' }
    const pss = ProjectService.systems(projectId)
    const content: TplContent = {
      version: 1,
      systems: pss.map((ps) => ({ systemId: ps.system_id, grade: ps.design_grade })),
    }
    repository.insert(T.system_templates, {
      id: uid('tpl'),
      system_id: `format:${proj.project_type}`,
      name: `${proj.project_type}-${name || proj.name}`,
      version: '1.0',
      description: `来自项目 ${proj.name}，${pss.length} 系统`,
      content_json: content,
      enabled: true,
    } as unknown as SystemTemplate)
    return { ok: true, message: `已生成「${proj.project_type}」业态模版（${pss.length} 系统）` }
  },

  /** 删除自定义模版（内置模版不可删） */
  removeTemplate(id: string) {
    const t = repository.getById<SystemTemplate>(T.system_templates, id)
    if (!t || String(id).startsWith('builtin:')) return
    repository.remove(T.system_templates, id)
  },

  /** 根据项目集（系统）生成可叠加的模版系统集 */
  systemsForTemplate(sysIds: string[]): { systemId: string; name: string; code: string }[] {
    return sysIds.flatMap((id) => {
      const sys = stdSystemById(id)
      return sys ? [{ systemId: sys.id, name: sys.name, code: sys.code }] : []
    })
  },

  /** 新建项目：生成模板系统集；返回新项目 */
  applyTemplate(format: string, name: string, clientName?: string): { ok: boolean; message?: string; project?: ReturnType<typeof ProjectService.create> } {
    const tpl = this.listByFormat(format)[0]
    if (!tpl) return { ok: false, message: '该业态暂无可用模版' }
    const project = ProjectService.create({ name, project_type: format, client_name: clientName })
    let n = 0
    for (const sys of tpl.systems) {
      ProjectService.addSystem(project.id, sys.systemId, 'standard')
      n += 1
    }
    return { ok: true, message: `已套用「${tpl.name}」创建项目（${n} 系统）`, project }
  },
}