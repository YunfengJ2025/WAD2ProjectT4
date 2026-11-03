import { describe, it, expect } from 'vitest'
import { buildSitterSchedule } from '../schedule/buildSitterSchedule'

const now = new Date(2026, 10, 2, 17, 0) // Mon 2 Nov
const at = (day, hour = 12) => new Date(2026, 10, day, hour).toISOString()
const plant = (id) => ({ plantId: id, plantName: `p${id}`, photoUrl: '', plantLocation: '' })
const item = (id, status, planned, dueAt = planned) =>
  ({ requestItemId: id, plantId: id, status, originalDueAt: planned, dueAt, adjustmentType: 'none', plant: plant(id) })
const visit = (items, status = 'accepted') => ({ visitId: 1, status, owner: { userName: 'Bob' }, items })

describe('buildSitterSchedule', () => {
  it('marks planned items due or upcoming, and leaves out days that have already passed', () => {
    const out = buildSitterSchedule([visit([item(1, 'accepted', at(1)), item(2, 'accepted', at(2)), item(3, 'accepted', at(5))])], now)
    expect(out.map((i) => [i.status, i.dueAt])).toEqual([
      ['due', '2026-11-02'], ['upcoming', '2026-11-05'],
    ])
  })

  it('leaves out missed and expired visits and missed items', () => {
    const out = buildSitterSchedule([
      visit([item(1, 'missed', at(2))], 'missed'),
      visit([item(2, 'cancelled', at(3))], 'expired'),
      visit([item(3, 'missed', at(3))]),
    ], now)
    expect(out).toEqual([])
  }) 

  it('shows plants finished today as done and ignores earlier ones', () => {
    const out = buildSitterSchedule([visit([item(1, 'completed', at(2), at(2, 15)), item(2, 'completed', at(1), at(1, 15))], 'completed')], now)
    expect(out.map((i) => i.status)).toEqual(['done'])
  })

  it('skips cancelled visits and turns "none" into null', () => {
    expect(buildSitterSchedule([visit([item(1, 'cancelled', at(3))], 'cancelled')], now)).toEqual([])
    expect(buildSitterSchedule([visit([item(1, 'accepted', at(3))])], now)[0].adjustmentType).toBeNull()
  })
  it('shows rain-flagged items as skipped, unless already done', () => {
    const rain = (id, status) => ({ ...item(id, status, at(2)), adjustmentType: 'skipped-rain', adjustmentReason: 'Rain' })
    const out = buildSitterSchedule([visit([rain(1, 'accepted'), rain(2, 'completed')])], now)
    expect(out.map((i) => i.status)).toEqual(['skipped', 'done'])
  })
})