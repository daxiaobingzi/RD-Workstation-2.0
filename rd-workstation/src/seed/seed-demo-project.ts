import type { Row } from '../types/domain'
import { now } from './lib'

const pts: { name: string; cat: string; floor: string; space: string; qty: number; type: string }[] = [
  { name: '大厅高清枪机', cat: 'pc_in', floor: '1F', space: '大堂', qty: 12, type: 'm_bullet_s' },
  { name: '标准层走廊半球', cat: 'pc_in', floor: '2-26F', space: '走廊', qty: 150, type: 'm_dome_s' },
  { name: '电梯轿厢半球', cat: 'pc_ele', floor: 'B1-26F', space: '电梯轿厢', qty: 27, type: 'm_dome_s' },
  { name: '主出入口枪机', cat: 'pc_ent', floor: '1F', space: '主出入口', qty: 8, type: 'm_bullet_s' },
  { name: '周界枪机', cat: 'pc_out', floor: '室外', space: '周界', qty: 18, type: 'm_bullet_s' },
  { name: '地下车库半球', cat: 'pc_in', floor: 'B1-B2', space: '车库', qty: 60, type: 'm_dome_s' },
  { name: '广场球机', cat: 'pc_out', floor: '室外', space: '广场', qty: 6, type: 'm_ptz_s' },
  { name: '消防通道半球', cat: 'pc_in', floor: '各层', space: '消防通道', qty: 40, type: 'm_dome_s' },
  { name: '制高点球机', cat: 'pc_out', floor: '屋顶', space: '制高点', qty: 4, type: 'm_ptz_s' },
  { name: '库房半球', cat: 'pc_in', floor: 'B1', space: '库房', qty: 16, type: 'm_dome_s' },
  { name: '财务室半球', cat: 'pc_in', floor: '1F', space: '财务室', qty: 5, type: 'm_dome_s' },
  { name: '消控值班室半球', cat: 'pc_in', floor: '1F', space: '消控室', qty: 5, type: 'm_dome_s' },
  { name: '车道枪机', cat: 'pc_ent', floor: '室外', space: '车道出入口', qty: 35, type: 'm_bullet_s' },
]

// 点位行：id / point_code 递增编号由 map 索引生成
const points = pts.map((p, i) => {
  return {
    id: `pt_vss_${String(i + 1).padStart(3, '0')}`,
    project_system_id: 'ps_vss_001',
    point_code: `VSS-C-${String(i + 1).padStart(3, '0')}`,
    point_name: p.name,
    category_id: p.cat,
    floor: p.floor,
    space: p.space,
    location: p.space,
    quantity: p.qty,
    unit: '台',
    status: 'designed',
    remark: p.type,
    created_at: now, updated_at: now,
  }
})

const projects = [
  {
    id: 'proj_001', project_code: 'PJ-2026-001', name: '苏州XX公安项目', project_type: '政府 · 公共安全',
    building_type: '行政办公', client_name: '苏州公安局', location: '苏州工业园区', building_area: 128000,
    floor_count: 26, design_stage: '施工图', status: 'designing', default_grade_code: 'standard',
    start_date: '2026-03-01', planned_end_date: '2026-12-31', description: '公安业务用房智能化系统设计',
    created_at: now, updated_at: now,
  },
  {
    id: 'proj_002', project_code: 'PJ-2026-002', name: '园区银行大厦弱电', project_type: '办公 · 金融',
    building_type: '写字楼', client_name: 'XX银行', location: '苏州高新区', building_area: 86000,
    floor_count: 32, design_stage: '初设', status: 'designing', default_grade_code: 'premium',
    start_date: '2026-04-15', planned_end_date: '2026-11-30',
    created_at: now, updated_at: now,
  },
  {
    id: 'proj_003', project_code: 'PJ-2025-019', name: '医院综合楼智能化', project_type: '医疗',
    building_type: '综合医院', client_name: 'XX医院', location: '苏州吴中区', building_area: 210000,
    floor_count: 18, design_stage: '已交付', status: 'completed', default_grade_code: 'standard',
    start_date: '2025-02-01', planned_end_date: '2025-12-30', actual_end_date: '2025-12-20',
    created_at: now, updated_at: now,
  },
]

const project_systems = [
  { id: 'ps_vss_001', project_id: 'proj_001', system_id: 'sys_vss', status: 'designing', progress: 78, design_grade: 'standard', sort_order: 1, created_at: now, updated_at: now },
  { id: 'ps_acs_001', project_id: 'proj_001', system_id: 'sys_acs', status: 'designing', progress: 63, design_grade: 'standard', sort_order: 2, created_at: now, updated_at: now },
  { id: 'ps_cab_001', project_id: 'proj_001', system_id: 'sys_cab', status: 'designing', progress: 52, design_grade: 'economic', sort_order: 3, created_at: now, updated_at: now },
  { id: 'ps_vss_002', project_id: 'proj_002', system_id: 'sys_vss', status: 'designing', progress: 45, design_grade: 'premium', sort_order: 1, created_at: now, updated_at: now },
  { id: 'ps_lan_002', project_id: 'proj_002', system_id: 'sys_lan', status: 'designing', progress: 38, design_grade: 'premium', sort_order: 2, created_at: now, updated_at: now },
  { id: 'ps_vss_003', project_id: 'proj_003', system_id: 'sys_vss', status: 'completed', progress: 100, design_grade: 'standard', sort_order: 1, created_at: now, updated_at: now },
]

const tasks = [
  { id: 'task_1', title: '完成视频监控设计初稿', description: '点位/设备/清单/预算全链落库', status: 'doing', priority: 'high', project_id: 'proj_001', project_system_id: 'ps_vss_001', source_type: 'system', source_id: 'ps_vss_001', due_at: '2026-08-27T17:00:00', estimated_minutes: 480, actual_minutes: 120, created_at: now, updated_at: now },
  { id: 'task_2', title: '校对 NVR 存储容量', description: '按码流 4Mbps / 30 天复核', status: 'todo', priority: 'high', project_id: 'proj_001', project_system_id: 'ps_vss_001', due_at: '2026-08-27T12:00:00', estimated_minutes: 60, created_at: now, updated_at: now },
  { id: 'task_3', title: '补充 5 项缺价设备', status: 'todo', priority: 'medium', project_id: 'proj_001', due_at: '2026-08-27T16:00:00', estimated_minutes: 45, created_at: now, updated_at: now },
  { id: 'task_4', title: '导出楼控系统工程量', status: 'done', priority: 'medium', project_id: 'proj_001', completed_at: '2026-08-26T17:30:00', estimated_minutes: 30, actual_minutes: 25, created_at: now, updated_at: now },
  { id: 'task_5', title: '周目标复盘', status: 'todo', priority: 'low', goal_id: 'goal_q3', due_at: '2026-08-28T18:00:00', estimated_minutes: 30, created_at: now, updated_at: now },
]

const schedules = [
  { id: 'sch_1', task_id: 'task_1', title: '视频监控初稿评审', start_at: '2026-08-27T09:00:00', end_at: '2026-08-27T10:00:00', schedule_type: 'meeting', location: '会议室', project_id: 'proj_001', status: 'confirmed' },
  { id: 'sch_2', task_id: 'task_1', title: '录入摄像机点位', start_at: '2026-08-27T10:30:00', end_at: '2026-08-27T12:00:00', schedule_type: 'work', project_id: 'proj_001', status: 'confirmed' },
  { id: 'sch_3', task_id: 'task_1', title: '设备选型 · 标准档', start_at: '2026-08-27T14:00:00', end_at: '2026-08-27T15:00:00', schedule_type: 'work', project_id: 'proj_001', status: 'confirmed' },
  { id: 'sch_4', task_id: 'task_1', title: '清单预算生成', start_at: '2026-08-27T16:30:00', end_at: '2026-08-27T17:30:00', schedule_type: 'work', project_id: 'proj_001', status: 'confirmed' },
]

const goals = [
  { id: 'goal_q3', name: 'Q3 完成 15 个项目设计', period_type: 'quarter', start_date: '2026-07-01', end_date: '2026-09-30', target_value: 15, current_value: 12, status: 'active' },
  { id: 'goal_q3_subs', parent_goal_id: 'goal_q3', name: '视频监控系统模板沉淀', period_type: 'quarter', target_value: 3, current_value: 2, status: 'active' },
]

const habits = [
  { id: 'habit_1', name: '晨间规划', frequency_type: 'daily', target_value: 1, unit: '次', is_active: true },
  { id: 'habit_2', name: '工作复盘', frequency_type: 'daily', target_value: 1, unit: '次', is_active: true },
  { id: 'habit_3', name: '阅读 30 分钟', frequency_type: 'daily', target_value: 30, unit: '分钟', is_active: true },
]

const habit_records = [
  { id: 'hr_1', habit_id: 'habit_1', date: '2026-08-27', completed: true },
  { id: 'hr_2', habit_id: 'habit_2', date: '2026-08-27', completed: true },
  { id: 'hr_3', habit_id: 'habit_1', date: '2026-08-26', completed: true },
  { id: 'hr_4', habit_id: 'habit_2', date: '2026-08-26', completed: true },
  { id: 'hr_5', habit_id: 'habit_3', date: '2026-08-25', completed: true },
]

const knowledge_items = [
  { id: 'kn_1', type: 'standard', title: 'GB 50395 视频安防监控系统工程设计规范', content: '视频监控系统设计遵循的国家标准。', tags_json: ['规范', '视频监控'] },
  { id: 'kn_2', type: 'case', title: '公安项目视频监控设计案例', content: '128,000㎡ 办公建筑，386 点位，4MP/H.265/30天存储。', tags_json: ['案例', '视频监控'] },
  { id: 'kn_3', type: 'experience', title: '存储容量计算公式', content: '容量(TB) = 点位×码流(Mbps)×天数×86400 ÷ 8 ÷ 1024³', tags_json: ['经验', '存储'] },
]

const documents = [
  { id: 'doc_1', project_id: 'proj_001', type: 'design_note', title: '视频监控设计说明 V0.9', version: '0.9', status: 'draft' },
  { id: 'doc_2', project_id: 'proj_001', type: 'device_list', title: '设备表（初稿）', version: '0.9', status: 'draft' },
]

/** 演示项目 / 个人工作数据 */
export const demoProjectTables: Record<string, Row[]> = {
  projects,
  project_systems,
  points,
  tasks,
  schedules,
  goals,
  habits,
  habit_records,
  knowledge_items,
  documents,
}