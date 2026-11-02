<script setup>
import { ref, computed, watch } from 'vue'
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
    const done = dayItems.filter(item => item.status === 'done')
    const pending = dayItems.filter(item => item.status !== 'done')
    return {
      iso,
      label: d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }),
      isToday: iso === toDateInputValue(new Date()),
      items: dayItems,
      pending,
      done,
      doneCount: done.length,
      allDone: dayItems.length > 0 && pending.length === 0,
      changed: dayItems.some(item => item.adjustmentType),
    }
  })
})

// which days the user has expanded, e.g. { '2026-11-02': true }
const open = ref({})

function toggle(iso) {
  open.value[iso] = !open.value[iso]
}

// forget what was expanded when paging to another week
watch(() => days.value[0].iso, () => {
  open.value = {}
})

const MAX_THUMBS = 4 // more than this and the strip shows "+N"

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
          <div 
            class="day-header mb-2"
            :class="{ clickable: day.allDone }"
            :role="day.allDone ? 'button' : null"
            :tabindex="day.allDone ? 0 : null"
            :aria-expanded="day.allDone ? !!open[day.iso] : null"
            @click="day.allDone && toggle(day.iso)"
            @keydown.enter="day.allDone && toggle(day.iso)"
            @keydown.space.prevent="day.allDone && toggle(day.iso)"
          >
            <span class="day-label small fw-bold" :class="{ 'text-success': day.isToday }">
              <span v-if="day.allDone" class="chevron" :class="{ open: open[day.iso] }">▸</span>
              {{ day.label }}
            </span>
            <span v-if="day.items.length" class="count-badge" :class="{ changed: day.changed, finished: day.allDone }">
              <template v-if="day.allDone">✅ All done</template>
              <template v-else-if="day.doneCount">{{ day.doneCount }}/{{ day.items.length }} done</template>
              <template v-else>{{ day.items.length }} 💧</template>
            </span>
          </div>
          <!-- plants still to water: always full cards -->
          <TransitionGroup name="card" tag="div" appear class="card-list d-flex flex-column gap-2">
            <ScheduleDayCard v-for="item in day.pending" :key="item.requestItemId" :item="item" />
          </TransitionGroup>

          <!-- finished plants: a strip of round photos with ticks, click to expand -->
          <button
            v-if="day.done.length"
            class="done-strip"
            :aria-expanded="!!open[day.iso]"
            :aria-label="`${day.done.length} watered. ${open[day.iso] ? 'Hide' : 'Show'} them`"
            @click="toggle(day.iso)"
          >
            <span class="thumbs">
              <span v-for="item in day.done.slice(0, MAX_THUMBS)" :key="item.requestItemId" class="thumb" :title="item.plantName">
                <img v-if="item.photoUrl" :src="item.photoUrl" alt="" />
                <span v-else class="thumb-fallback">🪴</span>
                <span class="tick">✓</span>
              </span>
              <span v-if="day.done.length > MAX_THUMBS" class="more">+{{ day.done.length - MAX_THUMBS }}</span>
            </span>
            <span class="chevron" :class="{ open: open[day.iso] }">▸</span>
          </button>

          <!-- finished plants as full cards, only when expanded -->
          <TransitionGroup name="card" tag="div" class="card-list d-flex flex-column gap-2">
            <ScheduleDayCard v-for="item in (open[day.iso] ? day.done : [])" :key="item.requestItemId" :item="item" />
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
  flex-wrap: wrap;               /* the badge shifted under the date if the column is narrow */
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

/* ---------- collapsible days ---------- */
.day-header.clickable { cursor: pointer; user-select: none; }
.day-header.clickable:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; border-radius: 0.5rem; }

.chevron {
  display: inline-block;
  margin-right: 0.2rem;
  transition: transform 0.2s ease;
}
.chevron.open { transform: rotate(90deg); }

.done-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  width: 100%;
  margin: 0.5rem 0;
  padding: 0.35rem 0.5rem;
  border: 1px dashed rgba(22, 163, 74, 0.5);
  border-radius: var(--radius-md);
  background: rgba(22, 163, 74, 0.1);
  color: #14532d;
  cursor: pointer;
}
.done-strip:hover { background: rgba(22, 163, 74, 0.18); }
.done-strip:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }

.thumbs { display: flex; flex-wrap: wrap; gap: 0.3rem; min-width: 0; }
.thumb {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.thumb img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.thumb-fallback { font-size: 0.9rem; }
.tick {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #16a34a;
  color: #fff;
  font-size: 0.55rem;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  border: 1px solid #fff;
}
.more { align-self: center; font-size: 0.75rem; font-weight: 600; }

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
  .chevron { transition: none; }
}

</style>