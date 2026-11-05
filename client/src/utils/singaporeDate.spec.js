import { describe, expect, it } from 'vitest'
import { singaporeDate, addCalendarDays } from './singaporeDate'

describe('Singapore calendar dates', () => {
  it('uses the Singapore day on either side of midnight', () => {
    expect(singaporeDate('2026-11-05T15:59:59Z')).toBe('2026-11-05')
    expect(singaporeDate('2026-11-05T16:00:00Z')).toBe('2026-11-06')
  })

  it('keeps a date-only value on its calendar day', () => {
    expect(singaporeDate('2026-11-05')).toBe('2026-11-05')
  })

  it('adds days across month and year boundaries', () => {
    expect(addCalendarDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles leap days and subtracting a day', () => {
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addCalendarDays('2028-03-01', -1)).toBe('2028-02-29')
  })
})
