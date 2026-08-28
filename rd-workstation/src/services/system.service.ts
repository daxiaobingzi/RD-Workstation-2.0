import { repository } from '../db/memory-db'
import { T } from '../types/domain'
import type { DesignParameter, StandardSystem } from '../types/domain'
import { uid } from '../lib/utils'

/* ---------- 系统 / 设计参数 ---------- */
export const SystemService = {
  listStandard(): StandardSystem[] {
    return repository.getTable<StandardSystem>(T.systems).filter((s) => s.enabled !== false)
  },
  params(psId: string): DesignParameter[] {
    return repository.where<DesignParameter>(T.design_parameters, (r) => r.project_system_id === psId)
  },
  setParam(psId: string, key: string, name: string, value: number | string | boolean, unit?: string) {
    const existing = repository.where<DesignParameter>(T.design_parameters, (r) => r.project_system_id === psId && r.parameter_key === key)
    const valueType = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string'
    if (existing.length) {
      repository.update(T.design_parameters, existing[0].id, { value_json: value, value_type: valueType, unit })
    } else {
      repository.insert(T.design_parameters, {
        id: uid('dp'), project_system_id: psId, parameter_key: key, parameter_name: name,
        value_type: valueType, value_json: value, unit, required: true,
      } as unknown as DesignParameter)
    }
  },
}