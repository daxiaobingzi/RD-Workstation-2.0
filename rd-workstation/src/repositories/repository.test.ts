import { describe, expect, it } from 'vitest'
import { createMemoryRepository } from './repository'
import type { DB } from '../types/table-map'
import type { Project } from '../types/domain'

const project = (id: string, name: string): Project => ({
  id,
  project_code: `P-${id}`,
  name,
  status: 'draft',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
})

describe('createMemoryRepository', () => {
  it('supports typed CRUD operations and commits changes', () => {
    let db: DB = { projects: [] }
    const commits: DB[] = []
    const repository = createMemoryRepository(() => db, (next) => {
      db = next
      commits.push(next)
    })

    repository.insert('projects', project('p1', '项目一'))
    repository.insertMany('projects', [project('p2', '项目二'), project('p3', '项目三')])
    repository.update('projects', 'p2', { name: '项目二（更新）' })

    expect(repository.getById('projects', 'p2')?.name).toBe('项目二（更新）')
    expect(repository.where('projects', (row) => row.status === 'draft')).toHaveLength(3)
    expect(commits).toHaveLength(3)
  })

  it('commits a transaction only once', () => {
    let db: DB = { projects: [project('p1', '项目一')] }
    const commits: DB[] = []
    const repository = createMemoryRepository(() => db, (next) => {
      db = next
      commits.push(next)
    })

    repository.transaction((tx) => {
      tx.insert('projects', project('p2', '项目二'))
      tx.update('projects', 'p1', { name: '项目一（更新）' })
      tx.remove('projects', 'p2')
    })

    expect(commits).toHaveLength(1)
    expect(db.projects).toEqual([project('p1', '项目一（更新）')])
  })

  it('does not commit when a transaction callback throws', () => {
    let db: DB = { projects: [project('p1', '项目一')] }
    const commits: DB[] = []
    const repository = createMemoryRepository(() => db, (next) => {
      db = next
      commits.push(next)
    })

    expect(() => repository.transaction((tx) => {
      tx.remove('projects', 'p1')
      throw new Error('模拟事务失败')
    })).toThrow('模拟事务失败')

    expect(commits).toHaveLength(0)
    expect(db.projects).toEqual([project('p1', '项目一')])
  })
})
