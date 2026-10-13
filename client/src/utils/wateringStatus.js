const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const STATUS_ORDER = { overdue: 0, due: 1, upcoming: 2 }

export const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// "Thu 15 Oct"
export const formatShortDate = (date) =>
  `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`

// Local calendar date as "YYYY-MM-DD", the format <input type="date"> uses.
export const toDateInputValue = (date) => {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Works in whole calendar days, so watering at 11pm and checking at 1am
// the next day counts as one day later.
// Returns { key: 'overdue' | 'due' | 'upcoming', label, daysUntil, nextDate }.
// nextDate is null for a plant that has never been watered.
export function getWateringStatus(plant, now = new Date()) {
  if (!plant.lastWateredAt) {
    return { key: 'due', label: 'Not watered yet', daysUntil: 0, nextDate: null }
  }

  const next = startOfDay(plant.lastWateredAt)
  next.setDate(next.getDate() + plant.wateringInfo.frequencyDays)
  const daysUntil = Math.round((next - startOfDay(now)) / DAY_MS)

  if (daysUntil < 0) {
    const late = -daysUntil
    return {
      key: 'overdue',
      label: `${late} day${late === 1 ? '' : 's'} overdue`,
      daysUntil,
      nextDate: next,
    }
  }
  if (daysUntil === 0) return { key: 'due', label: 'Due today', daysUntil, nextDate: next }
  return { key: 'upcoming', label: `Next: ${formatShortDate(next)}`, daysUntil, nextDate: next }
}

// Overdue first (most overdue at the top), then due, then upcoming soonest first.
export function compareByWateringStatus(a, b) {
  return (
    STATUS_ORDER[a.status.key] - STATUS_ORDER[b.status.key] ||
    a.status.daysUntil - b.status.daysUntil
  )
}
