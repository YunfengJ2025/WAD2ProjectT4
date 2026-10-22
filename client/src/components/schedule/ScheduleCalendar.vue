<script setup>
import { ref, computed } from 'vue'
import ScheduleDayCard from './ScheduleDayCard.vue'
import ScheduleLegend from './ScheduleLegend.vue'

const props = defineProps({ 
    items: { 
        type: Array, 
        default: () => [] 
    }
})

// Build YYYY-MM-DD from LOCAL date parts.
// Don't use toISOString(): it converts to UTC, so in Singapore after midnight it gives yesterday.
function toISO(d) {
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${month}-${day}`
}

const today = new Date()
const rangeStart = ref(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
const slide = ref('next') // which way the week slides: 'next' or 'prev'

// 7 days starting from rangeStart, each with its matching schedule items
const days = computed(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(rangeStart.value)
    d.setDate(d.getDate() + i)
    const iso = toISO(d)
    return {
      iso,
      label: d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }),
      isToday: iso === toISO(new Date()),
      items: props.items.filter(item => item.dueAt === iso),
    }
  })
})

function shiftWeek(direction) {
  slide.value = direction > 0 ? 'next' : 'prev' // set befire the week changes so the right animation plays
  const d = new Date(rangeStart.value)
  d.setDate(d.getDate() + direction * 7)
  rangeStart.value = d
}
</script>

<template>
  <div>
    <ScheduleLegend/>

    <div class="d-flex justify-content-between align-items-center mb-2">
      <button class="btn btn-outline-secondary btn-sm" @click="shiftWeek(-1)">‹ Previous</button>
      <strong>{{ days[0].label }} – {{ days[6].label }}</strong>
      <button class="btn btn-outline-secondary btn-sm" @click="shiftWeek(1)">Next ›</button>
    </div>

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
          <div class="day-label small fw-bold mb-2" :class="{ 'text-success': day.isToday }">
            {{ day.label }}
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
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}
.day-col {
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

/* ---------- week slide (Transition) ---------- */
.week-next-enter-active, .week-next-leave-active,
.week-prev-enter-active, .week-prev-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.week-next-enter-from { transform: translateX(40px);  opacity: 0; }
.week-next-leave-to   { transform: translateX(-40px); opacity: 0; }
.week-prev-enter-from { transform: translateX(-40px); opacity: 0; }
.week-prev-leave-to   { transform: translateX(40px);  opacity: 0; }

/* ---------- cards entering / leaving a day (TransitionGroup) ---------- */
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