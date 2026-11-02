<script setup>
import { computed } from 'vue'
import ScheduleDayCard from './ScheduleDayCard.vue'
import ScheduleLegend from './ScheduleLegend.vue'
import WeekNav from './WeekNav.vue'
import { useWeekRange } from '../../composables/schedule/useWeekRange'
import { toDateInputValue } from '../../utils/wateringStatus'

const props = defineProps({ 
    items: { 
        type: Array, 
        default: () => [] 
    }
})

const { rangeStart, slide, isCurrentWeek, endISO, shiftWeek, goToToday } = useWeekRange()

// is there anything after this week? if not, Next is disabled
const hasLater = computed(() => props.items.some((item) => item.dueAt > endISO.value))

// 7 days starting from rangeStart with its matching schedule items
const days = computed(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(rangeStart.value)
    d.setDate(d.getDate() + i)
    const iso = toDateInputValue(d)
    const dayItems = props.items.filter(item => item.dueAt === iso)
    const doneCount = dayItems.filter(item => item.status === 'done').length
    return {
      iso,
      label: d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }),
      isToday: iso === toDateInputValue(new Date()),
      items: dayItems,
      doneCount,
      changed: dayItems.some(item => item.adjustmentType),
    }
  })
})

</script>

<template>
  <div>
    <ScheduleLegend/>

    <WeekNav
      :title="`${days[0].label} – ${days[6].label}`"
      :is-current-week="isCurrentWeek"
      :has-later="hasLater"
      @shift="shiftWeek"
      @today="goToToday"
    />

    <!-- :key changes with the week, so Vue treats it as a new element and plays the slide -->
    <Transition :name="`week-${slide}`" mode="out-in">
      <div class="week" :key="days[0].iso">
        <div
          v-for="(day, index) in days"
          :key="day.iso"
          class="day-col"
          :class="{ today: day.isToday }"
          :style="{ '--i': index }"
        >
          <div class="day-header mb-2">
            <span class="day-label small fw-bold" :class="{ 'text-success': day.isToday }">
              {{ day.label }}
            </span>
            <span v-if="day.items.length" class="count-badge" :class="{ changed: day.changed, finished: day.doneCount === day.items.length }">
              <template v-if="day.doneCount === day.items.length">✅ All done</template>
              <template v-else-if="day.doneCount">{{ day.doneCount }}/{{ day.items.length }} done</template>
              <template v-else>{{ day.items.length }} 💧</template>
            </span>
          </div>

          <TransitionGroup name="card" tag="div" appear class="card-list d-flex flex-column gap-2">
            <ScheduleDayCard v-for="item in day.items" :key="item.requestItemId" :item="item" />
          </TransitionGroup>

          <div v-if="!day.items.length" class="empty-day text-muted small">
            <div class="empty-icon">🌿</div>
            Nothing to water
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
}
.day-col {
  min-width: 0; /* lets a column shrink below its content */
  min-height: 140px;
  padding: 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.45);
}
/* today gets a stronger tint and outline so it stands out at a glance */
.day-col.today {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.55);
}
.empty-day {
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  text-align: center;
}
.empty-icon { font-size: 1.4rem; }

/* day header with count */
.day-header {
  display: flex;
  flex-wrap: wrap;               /* the badge shiftd under the date if the column is narrow */
  justify-content: space-between;
  align-items: center;
  gap: 0.25rem 0.5rem;
}
.count-badge {
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.5;
  color: #166534;
  background: rgba(34, 197, 94, 0.18);
}

/* amber when the weather changed something that day, same colour as the adjusted cards */
.count-badge.changed {
  color: #92400e;
  background: rgba(251, 191, 36, 0.32);
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.35);
}

/* every watering that day is done */
.count-badge.finished {
  color: #14532d;
  background: rgba(22, 163, 74, 0.25);
  box-shadow: none;
}

/* week slide (Transition) */
.week-next-enter-active, .week-next-leave-active,
.week-prev-enter-active, .week-prev-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.week-next-enter-from { transform: translateX(40px);  opacity: 0; }
.week-next-leave-to   { transform: translateX(-40px); opacity: 0; }
.week-prev-enter-from { transform: translateX(-40px); opacity: 0; }
.week-prev-leave-to   { transform: translateX(40px);  opacity: 0; }

/* cards entering / leaving a day (TransitionGroup) */
.card-list { position: relative; } /* so a leaving card can be taken out of the flow */

.card-enter-active {
  /* --i is the column number, so columns ripple in left to right */
  animation: cardIn 0.5s var(--transition-bounce) backwards;
  animation-delay: calc(var(--i) * 70ms);
}
.card-leave-active {
  position: absolute;     /* lets the remaining cards close the gap smoothly */
  width: 100%;
  animation: cardOut 0.25s ease forwards;
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(-14px) scale(0.95); }
  to   { opacity: 1; transform: none; }
}
@keyframes cardOut {
  to { opacity: 0; transform: translateY(10px) scale(0.95); }
}

@media (prefers-reduced-motion: reduce) {
  .week-next-enter-active, .week-next-leave-active,
  .week-prev-enter-active, .week-prev-leave-active { transition: none; }
  .card-enter-active, .card-leave-active { animation: none; }
}

</style>