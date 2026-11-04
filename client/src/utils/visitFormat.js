// (Carolyn) Fix 5: shared wording for the care request / visit cards, so every card
// shows dates, tokens, water sources and statuses the same way.
// Used by AssignedVisitCard, AvailableVisitCard, VisitHistoryCard and CareRequestCard.

// All visit dates are Singapore calendar days (same as the server)
const TIME_ZONE = 'Asia/Singapore'

// "10/11/2026"
export function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-GB', { timeZone: TIME_ZONE })
}

// "Tue 10" (short, for chips and visit rows)
export function formatShortDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-SG', {
    weekday: 'short',
    day: 'numeric',
    timeZone: TIME_ZONE,
  })
}

// "Tue, 10 Nov 2026" (long, for pop-up summaries)
export function formatLongDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  })
}

// "04/11/2026 – 10/11/2026"
export function formatDateRange(start, end) {
  return `${formatDate(start)} – ${formatDate(end)}`
}

// tokenText(1) -> "1 token", tokenText(5) -> "5 tokens"
export function tokenText(count) {
  return `${count} token${count === 1 ? '' : 's'}`
}

// What each saved waterSource value means
export const WATER_SOURCE_LABELS = {
  left_out: 'Water left outside',
  tap_available: 'Tap available',
  sitter_brings: 'Sitter brings water',
}

// Unknown or missing values fall back to "Tap available" (the server's default)
export function waterSourceLabel(value) {
  return WATER_SOURCE_LABELS[value] || 'Tap available'
}

// "in_progress" -> "in progress" (CSS text-transform makes it "In Progress")
export function statusLabel(status) {
  return String(status || '').replaceAll('_', ' ')
}

// A symbol in front of each status badge, so it's clear at a glance (not only by colour)
const STATUS_ICONS = {
  open: '○',
  accepted: '✓',
  completed: '✓',
  in_progress: '⏳',
  missed: '✕',
  expired: '✕',
  cancelled: '–',
  weather_skipped: '🌧',
}
export function statusIcon(status) {
  return STATUS_ICONS[status] || ''
}
