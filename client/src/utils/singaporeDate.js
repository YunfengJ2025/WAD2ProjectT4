// Calendar-day helpers for care requests and map filters. Local watering schedules
// keep their own local-time helpers in wateringStatus.js.
export function singaporeDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${date.year}-${date.month}-${date.day}`
}

export function addCalendarDays(day, days) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10)
}

// A make-up visit must be after today and after the original request period.
export function makeupVisitDate(requestEndDate, now = new Date()) {
  const tomorrow = addCalendarDays(singaporeDate(now), 1)
  const afterRequest = requestEndDate
    ? addCalendarDays(singaporeDate(requestEndDate), 1)
    : tomorrow
  return afterRequest > tomorrow ? afterRequest : tomorrow
}
