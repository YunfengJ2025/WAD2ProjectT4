import { ref, computed } from 'vue'
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

  return { rangeStart, slide, isCurrentWeek, startISO, endISO, shiftWeek, goToToday }
}