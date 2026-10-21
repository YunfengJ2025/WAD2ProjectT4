// Helpers for working out when each plant needs water.
// Used by PlantCard, MyPlantsView, PlantDetailView and PlantForm.

const DAY_MS = 24 * 60 * 60 * 1000 // one day in milliseconds
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Sort order for the list: lower number = shown first
export const STATUS_ORDER = { overdue: 0, due: 1, upcoming: 2 }

// Same date at 00:00, so we compare calendar days and ignore the time
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
  const pad = (n) => String(n).padStart(2, '0') // 5 -> "05"
  // getMonth() starts at 0 (Jan = 0), so add 1
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Works in whole calendar days, so watering at 11pm and checking at 1am
// the next day counts as one day later.
// Returns { key: 'overdue' | 'due' | 'upcoming', label, daysUntil, nextDate }.
// nextDate is null for a plant that has never been watered.
export function getWateringStatus(plant, now = new Date()) {
  // Never watered: treat it as needing water now
  if (!plant.lastWateredAt) {
    return { key: 'due', label: 'Not watered yet', daysUntil: 0, nextDate: null }
  }

  // Next watering day = last watered day + frequency
  // e.g. watered Mon, every 3 days -> next is Thu
  const next = startOfDay(plant.lastWateredAt)
  next.setDate(next.getDate() + plant.wateringInfo.frequencyDays)
  // Days from today to that day: negative = late, 0 = today, positive = later.
  // Math.round handles the 23/25-hour days when clocks change.
  const daysUntil = Math.round((next - startOfDay(now)) / DAY_MS)

  // Past the next watering day
  if (daysUntil < 0) {
    const late = -daysUntil
    return {
      key: 'overdue',
      label: `${late} day${late === 1 ? '' : 's'} overdue`, // "1 day" vs "3 days"
      daysUntil,
      nextDate: next,
    }
  }
  // Next watering day is today
  if (daysUntil === 0) return { key: 'due', label: 'Due today', daysUntil, nextDate: next }
  // Still in the future
  return { key: 'upcoming', label: `Next: ${formatShortDate(next)}`, daysUntil, nextDate: next }
}

// Overdue first (most overdue at the top), then due, then upcoming soonest first.
// Used with Array.sort(). A negative result puts a first, positive puts b first.
// 1. Compare status groups (overdue < due < upcoming).
// 2. If it's the same group (difference is 0, so || moves on), compare daysUntil:
//    more overdue = more negative = earlier, and upcoming soonest = smallest.
export function compareByWateringStatus(a, b) {
  return (
    STATUS_ORDER[a.status.key] - STATUS_ORDER[b.status.key] ||
    a.status.daysUntil - b.status.daysUntil
  )
}
