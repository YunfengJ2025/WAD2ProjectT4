import { ref, computed, watch } from 'vue'
import { startOfDay, toDateInputValue } from '../../utils/wateringStatus.js'
import { addDays } from './buildSchedule.js' // uses similar logic to calander view

// Which 7 days are showing. Starts on the week that begins today.
export function useWeekRange() {
  const homeStart = startOfDay(new Date())
  const rangeStart = ref(new Date(homeStart))
  const slide = ref('next') // which way the week slides: 'next' or 'prev'

  const isCurrentWeek = computed(() => rangeStart.value.getTime() === homeStart.getTime())
  const startISO = computed(() => toDateInputValue(rangeStart.value))                 // first day, "YYYY-MM-DD"
  const endISO = computed(() => toDateInputValue(addDays(rangeStart.value, 6)))       // last day (7 days in total)

  function shiftWeek(direction) {
    slide.value = direction > 0 ? 'next' : 'prev'   // set before the week changes so the right animation plays
    rangeStart.value = addDays(rangeStart.value, direction * 7)
  }

  function goToToday() {
    slide.value = rangeStart.value > homeStart ? 'prev' : 'next'
    rangeStart.value = new Date(homeStart)
  }

  // which status groups the user has opened or folded, e.g. { '2026-11-03|due': false }
  const clicked = ref({})
  const groupKey = (date, status) => `${date}|${status}`

  // until the user clicks, today's groups start open (finished ones stay folded) and every other day is folded
  function isOpen(date, status) {
    const key = groupKey(date, status)
    if (key in clicked.value) return clicked.value[key]
    return date === toDateInputValue(new Date()) && status !== 'done'
  }

  function toggle(date, status) {
    clicked.value[groupKey(date, status)] = !isOpen(date, status)
  }

  // forget the choices when paging to another week
  watch(startISO, () => {
    clicked.value = {}
  })

  return { rangeStart, slide, isCurrentWeek, startISO, endISO, shiftWeek, goToToday, isOpen, toggle }
}