import { describe, expect, it } from 'vitest'
import { singaporeDate, addCalendarDays, makeupVisitDate } from './singaporeDate'

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

describe('make-up visit date', () => {
  it('uses tomorrow in Singapore when the request has already ended', () => {
    expect(makeupVisitDate('2026-11-04', '2026-11-05T16:30:00Z')).toBe('2026-11-07')
  })

  it('waits until after the request ends when that is later than tomorrow', () => {
    expect(makeupVisitDate('2026-11-30', '2026-11-06T04:00:00Z')).toBe('2026-12-01')
  })

  it('uses tomorrow when the original period is unavailable', () => {
    expect(makeupVisitDate(null, '2026-12-31T04:00:00Z')).toBe('2027-01-01')
  })
})
