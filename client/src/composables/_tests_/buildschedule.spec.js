import { describe, it, expect } from 'vitest'
import { buildSchedule } from '../schedule/buildSchedule.js'

// A fixed "today". There is no "Z" at the end, so this is local time on any computer,
// and the tests give the same result in any time zone.
const NOW = new Date('2026-10-22T09:00:00')

// Makes a test plant. Anything you pass in replaces the default value.
function plant(overrides) {
  return {
    plantId: 1,
    plantName: 'Test Plant',
    wateringInfo: { frequencyDays: 3 },
    lastWateredAt: null,
    rainExposed: false,
    weatherAdjustmentEnabled: false,
    ...overrides,
  }
}

describe('buildSchedule', () => {
  it('puts a never-watered plant on today only', () => {
    const items = buildSchedule([plant({ lastWateredAt: null })], NOW)

    expect(items).toHaveLength(1)
    expect(items[0].dueAt).toBe('2026-10-22')
    expect(items[0].status).toBe('due')
  })

  it('repeats a plant every frequencyDays', () => {
    // watered 20 Oct, every 3 days -> 23, 26, 29
    const items = buildSchedule([plant({ lastWateredAt: '2026-10-20T10:00:00' })], NOW, 10)

    expect(items.map((item) => item.dueAt)).toEqual(['2026-10-23', '2026-10-26', '2026-10-29'])
    expect(items[0].status).toBe('upcoming')
  })

  it('shows an overdue plant on today and keeps the real date', () => {
    // watered 15 Oct, every 3 days -> was due 18 Oct
    const items = buildSchedule([plant({ lastWateredAt: '2026-10-15T10:00:00' })], NOW)

    expect(items[0].status).toBe('overdue')
    expect(items[0].dueAt).toBe('2026-10-22')
    expect(items[0].originalDueAt).toBe('2026-10-18')
  })

  it('uses the local day, even if watered late at night', () => {
    // 11:30 pm on 20 Oct still counts as 20 Oct, so the next watering is 23 Oct
    const items = buildSchedule([plant({ lastWateredAt: '2026-10-20T23:30:00' })], NOW, 5)

    expect(items[0].dueAt).toBe('2026-10-23')
  })

  it('gives every item a unique id', () => {
    const items = buildSchedule([plant({ lastWateredAt: '2026-10-20T10:00:00' })], NOW)
    const ids = items.map((item) => item.requestItemId)

    expect(new Set(ids).size).toBe(ids.length)
  })
})