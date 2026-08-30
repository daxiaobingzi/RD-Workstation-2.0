import { beforeEach, describe, expect, it } from 'vitest'
import { repository } from '../db/memory-db'
import { ProjectService } from './project.service'
import { T } from '../types/domain'
import type {
  BillItem,
  BillVersion,
  Budget,
  BudgetItem,
  Building,
  DesignParameter,
  DesignResult,
  DeviceSelection,
  Document,
  Point,
  Project,
  ProjectSystem,
  Revision,
  Schedule,
  Task,
  TelecomRoom,
} from '../types/domain'

const projectId = 'test-project-cascade'
const projectSystemId = 'test-project-system'
const buildingId = 'test-building'
const roomId = 'test-room'
const billVersionId = 'test-bill-version'
const budgetId = 'test-budget'

const project: Project = {
  id: projectId,
  project_code: 'TEST-CASCADE',
  name: '级联删除测试项目',
  status: 'draft',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const projectSystem: ProjectSystem = {
  id: projectSystemId,
  project_id: projectId,
  system_id: 'system-test',
  status: 'draft',
  progress: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const building: Building = {
  id: buildingId,
  project_id: projectId,
  name: '测试建筑',
  enabled: true,
}

const telecomRoom: TelecomRoom = {
  id: roomId,
  building_id: buildingId,
  name: '测试弱电间',
  enabled: true,
}

const designParameter: DesignParameter = {
  id: 'test-parameter',
  project_system_id: projectSystemId,
  parameter_key: 'test',
  parameter_name: '测试参数',
  value_type: 'number',
  value_json: 1,
}

const point: Point = {
  id: 'test-point',
  project_system_id: projectSystemId,
  point_code: 'TEST-001',
  device_id: 'device-test',
  telecom_room_id: roomId,
  quantity: 1,
  status: 'draft',
}

const designResult: DesignResult = {
  id: 'test-result',
  project_system_id: projectSystemId,
  result_type: 'test',
  quantity: 1,
  created_at: '2026-01-01T00:00:00.000Z',
}

const deviceSelection: DeviceSelection = {
  id: 'test-selection',
  project_system_id: projectSystemId,
  model_id: 'model-test',
  quantity: 1,
  unit_price: 100,
  total_price: 100,
}

const task: Task = {
  id: 'test-task',
  title: '测试任务',
  status: 'todo',
  priority: 'medium',
  project_id: projectId,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const schedule: Schedule = {
  id: 'test-schedule',
  title: '测试日程',
  start_at: '2026-01-01T09:00:00.000Z',
  project_id: projectId,
  project_system_id: projectSystemId,
}

const billVersion: BillVersion = {
  id: billVersionId,
  project_id: projectId,
  version_no: 'V1',
  created_at: '2026-01-01T00:00:00.000Z',
}

const billItem: BillItem = {
  id: 'test-bill-item',
  bill_version_id: billVersionId,
  item_name: '测试清单项',
  quantity: 1,
  unit_price: 100,
  amount: 100,
}

const budget: Budget = {
  id: budgetId,
  project_id: projectId,
  total_amount: 100,
}

const budgetItem: BudgetItem = {
  id: 'test-budget-item',
  budget_id: budgetId,
  quantity: 1,
  unit_price: 100,
  amount: 100,
}

const document: Document = {
  id: 'test-document',
  title: '测试文档',
  project_id: projectId,
}

const revision: Revision = {
  id: 'test-revision',
  entity_type: 'point',
  entity_id: point.id,
  snapshot_json: { project_system_id: projectSystemId },
  created_at: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  repository.replace(T.projects, [project])
  repository.replace(T.project_systems, [projectSystem])
  repository.replace(T.buildings, [building])
  repository.replace(T.telecom_rooms, [telecomRoom])
  repository.replace(T.design_parameters, [designParameter])
  repository.replace(T.points, [point])
  repository.replace(T.design_results, [designResult])
  repository.replace(T.device_selections, [deviceSelection])
  repository.replace(T.tasks, [task])
  repository.replace(T.schedules, [schedule])
  repository.replace(T.bill_versions, [billVersion])
  repository.replace(T.bill_items, [billItem])
  repository.replace(T.budgets, [budget])
  repository.replace(T.budget_items, [budgetItem])
  repository.replace(T.documents, [document])
  repository.replace(T.revisions, [revision])
})

describe('ProjectService.remove', () => {
  it('removes the project and all project-owned dependent data in one transaction', () => {
    ProjectService.remove(projectId)

    expect(repository.getById(T.projects, projectId)).toBeUndefined()
    expect(repository.getById(T.project_systems, projectSystemId)).toBeUndefined()
    expect(repository.getById(T.buildings, buildingId)).toBeUndefined()
    expect(repository.getById(T.telecom_rooms, roomId)).toBeUndefined()
    expect(repository.getById(T.design_parameters, designParameter.id)).toBeUndefined()
    expect(repository.getById(T.points, point.id)).toBeUndefined()
    expect(repository.getById(T.design_results, designResult.id)).toBeUndefined()
    expect(repository.getById(T.device_selections, deviceSelection.id)).toBeUndefined()
    expect(repository.getById(T.tasks, task.id)).toBeUndefined()
    expect(repository.getById(T.schedules, schedule.id)).toBeUndefined()
    expect(repository.getById(T.bill_versions, billVersionId)).toBeUndefined()
    expect(repository.getById(T.bill_items, billItem.id)).toBeUndefined()
    expect(repository.getById(T.budgets, budgetId)).toBeUndefined()
    expect(repository.getById(T.budget_items, budgetItem.id)).toBeUndefined()
    expect(repository.getById(T.documents, document.id)).toBeUndefined()
    expect(repository.getById(T.revisions, revision.id)).toBeUndefined()
  })
})
