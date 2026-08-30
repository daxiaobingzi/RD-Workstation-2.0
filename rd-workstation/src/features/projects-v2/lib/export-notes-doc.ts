import { ProjectService, PointService, SystemService, DesignService, DocumentService } from '../../../services'

interface SystemNote {
  psId: string
  code: string
  name: string
  grade: string
  /** 用户填写的设计说明正文（多行） */
  content: string
  /** 摘要提示（非正文块） */
  pointsQty: number
  resultsCount: number
  paramsCount: number
}

/** 设计说明汇总（v2）：每个子系统一篇文章（多行内容库），正文为用户填写内容 */
export function buildDesignNotes(projectId: string): { projectName: string; systems: SystemNote[] } {
  const project = ProjectService.get(projectId)
  const systems = ProjectService.systems(projectId).map((ps) => {
    const doc = DocumentService.listByPsId(ps.id)[0]
    return {
      psId: ps.id,
      code: ps.systemCode,
      name: ps.systemName,
      grade: gradeName(ps.design_grade),
      content: doc?.content ?? '',
      pointsQty: PointService.list(ps.id).reduce((s, p) => s + (p.quantity || 0), 0),
      resultsCount: DesignService.results(ps.id).length,
      paramsCount: SystemService.params(ps.id).length,
    }
  })
  return { projectName: project?.name ?? '项目', systems }
}

/** 保存某子系统的设计说明（存 documents.type=design_note，内容即正文） */
export function saveDesignNote(projectId: string, psId: string, content: string) {
  const existing = DocumentService.listByPsId(psId)[0]
  const system = ProjectService.systems(projectId).find((s) => s.id === psId)
  if (existing) {
    DocumentService.update(existing.id, { content })
  } else {
    DocumentService.add(projectId, {
      title: `${system?.systemName ?? '系统'}设计说明`,
      type: 'design_note',
      content,
      status: 'draft',
      project_system_id: psId,
    })
  }
}

function gradeName(code?: string) {
  return { economic: '经济型', standard: '标准型', premium: '高端型' }[code ?? ''] ?? code ?? '—'
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 导出汇总设计说明为 Word（.doc，Word/WPS 兼容；分级标题 H1 项目 → H2 系统；正文联动用户填写内容） */
export function exportDesignNotesDoc(projectId: string) {
  const { projectName, systems } = buildDesignNotes(projectId)

  let html = `<h1>${esc(projectName)} · 弱电设计说明</h1>`
  html += `<p>导出时间：${new Date().toLocaleString('zh-CN')} ｜ 系统数：${systems.length}</p>`

  systems.forEach((sys, sysIdx) => {
    html += `<h2>${sysIdx + 1} ${esc(sys.code)} · ${esc(sys.name)}（${esc(sys.grade)}）</h2>`
    const lines = sys.content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length) {
      html += lines.map((l) => `<p>${esc(l)}</p>`).join('')
    } else {
      html += `<p><em>（该子系统尚未填写设计说明，请在设计说明页补充后重新导出）</em></p>`
    }
  })

  const wbXml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(projectName)}-设计说明</title></head><body>${html}</body></html>`

  const blob = new Blob(['\ufeff', wbXml], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName}-设计说明.doc`
  a.click()
  URL.revokeObjectURL(url)
}