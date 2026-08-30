import * as XLSX from 'xlsx'
import { PointService, ProjectService } from '../../../services'

/** 项目级点位导出 Excel：每系统 1 Sheet（列=建筑/弱电间/设备名称/数量）+ 全量汇总 Sheet */
export function exportPointsXlsx(projectId: string) {
  const all = PointService.allByProject(projectId)
  const systems = ProjectService.systems(projectId)
  const wb = XLSX.utils.book_new()

  const head = ['系统', '点编号', '建筑', '弱电间', '设备名称', '数量', '单位']
  const row = (p: (typeof all)[number]) => [p.systemName, p.point_code, p.buildingName ?? '', p.telecomRoomName ?? '', p.deviceName ?? '', p.quantity, p.unit ?? '']

  // 汇总 Sheet（全量）
  const summary = [head, ...all.map(row)]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), '全量汇总')

  // 每系统 1 Sheet
  for (const ps of systems) {
    const rows = all.filter((p) => p.project_system_id === ps.id)
    if (!rows.length) continue
    const sheet = [head, ...rows.map(row)]
    const name = (ps.systemName || '系统').slice(0, 28)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet), name)
  }

  const project = ProjectService.get(projectId)
  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([bin], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project?.project_code ?? projectId}-项目点位.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}