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
const homeStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()) // the week that starts today
const rangeStart = ref(new Date(homeStart))
const slide = ref('next') // which way the week slides: 'next' or 'prev'

const isCurrentWeek = computed(() => rangeStart.value.getTime() === homeStart.getTime())
function goToToday() {
  // slide the way that matches where we're coming from
  slide.value = rangeStart.value > homeStart ? 'prev' : 'next'
  rangeStart.value = new Date(homeStart)
}

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

    <div class="week-nav">
      <button class="leaf-btn leaf-prev" @click="shiftWeek(-1)" aria-label="Previous week">
        <span class="leaf-arrow">‹</span> Previous
      </button>

      <div class="week-title">
        <strong>{{ days[0].label }} – {{ days[6].label }}</strong>
        <button v-if="!isCurrentWeek" class="today-chip" @click="goToToday">Back to today</button>
      </div>

      <button class="leaf-btn leaf-next" @click="shiftWeek(1)" aria-label="Next week">
        Next <span class="leaf-arrow">›</span>
      </button>
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

/* week navigation */
.week-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.week-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.3rem 1.1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.today-chip {
  border: 0;
  padding: 0.05rem 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #166534;
  background: rgba(34, 197, 94, 0.18);
  cursor: pointer;
}
.today-chip:hover { background: rgba(34, 197, 94, 0.32); }

/* leaf buttons */
.leaf-btn {
  position: relative;
  border: 0;
  padding: 0.55rem 1.4rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #4ade80, #16a34a);
  box-shadow: 0 4px 10px rgba(22, 163, 74, 0.35);
  cursor: pointer;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
}
/* two sharp opposite corners and two big round ones = a leaf. mirrored for the other direction */
.leaf-next { border-radius: 2rem 0.3rem 2rem 0.3rem; }
.leaf-prev { border-radius: 0.3rem 2rem 0.3rem 2rem; }

/* a faint vein line across the leaf */
.leaf-btn::after {
  content: '';
  position: absolute;
  left: 14%;
  right: 14%;
  top: 50%;
  height: 1px;
  background: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}
.leaf-next::after { transform: rotate(-18deg); }
.leaf-prev::after { transform: rotate(18deg); }

.leaf-arrow { font-size: 1.1rem; margin: 0 0.15rem; }

.leaf-next:hover { transform: translateY(-2px) rotate(-4deg); box-shadow: 0 8px 16px rgba(22, 163, 74, 0.4); }
.leaf-prev:hover { transform: translateY(-2px) rotate(4deg);  box-shadow: 0 8px 16px rgba(22, 163, 74, 0.4); }
.leaf-btn:active { transform: scale(0.94); }
.leaf-btn:focus-visible { outline: 3px solid #0d6efd; outline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  .week-next-enter-active, .week-next-leave-active,
  .week-prev-enter-active, .week-prev-leave-active { transition: none; }
  .card-enter-active, .card-leave-active { animation: none; }
  .leaf-btn { transition: none; }
  .leaf-btn:hover, .leaf-btn:active { transform: none; }
}

</style>