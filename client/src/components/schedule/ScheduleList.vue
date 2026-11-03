<script setup>
import { computed, ref, watch } from 'vue'
import ScheduleDayCard from './ScheduleDayCard.vue'
import ScheduleLegend from './ScheduleLegend.vue'
import { useWeekRange } from '../../composables/schedule/useWeekRange'
import WeekNav from './WeekNav.vue'

const props = defineProps({ 
    items: { 
        type: Array, 
        default: () => [] 
    }
})

const { slide, isCurrentWeek, startISO, endISO, shiftWeek, goToToday } = useWeekRange()

// only the items that fall inside the 7 days being shown (ISO dates compare correctly as text)
const weekItems = computed(() =>
    props.items.filter((item) => item.dueAt >= startISO.value && item.dueAt <= endISO.value)
)

// is there anything after this week? if not, Next is disabled so you never page into empty weeks
const hasLater = computed(() => props.items.some((item) => item.dueAt > endISO.value))

// sorted [date, item] pairs e.g. {'2026-10-17': [items], ...} for the days that have something to water
const grouped = computed(() => {
    const byDate = {} // sorted pairs
    for (const item of weekItems.value) {
        // initialize the array if it doesn't exist yet
        if (!byDate[item.dueAt]) {
            byDate[item.dueAt] = [];
        }

        byDate[item.dueAt].push(item) // push the item into the array
    }

    const entries = Object.entries(byDate) // convert the object into an array of [key, value] pairs
    // sorts the pairs alphabetically by their keys (the dates)
    entries.sort((entryA, entryB) => {
        const dateA = entryA[0]; 
        const dateB = entryB[0];
        return dateA.localeCompare(dateB);
    });

    return entries // sorted 

})

// which days the user has expanded, e.g. { '2026-11-02': true }
const open = ref({})

function toggle(date) {
    open.value[date] = !open.value[date]
}

// forget what was expanded when paging to another week
watch(startISO, () => {
    open.value = {}
})

function isAllDone(dayItems) {
    return dayItems.length > 0 && doneCount(dayItems) === dayItems.length
}

const pendingItems = (dayItems) => dayItems.filter((item) => item.status !== 'done')
const doneItems = (dayItems) => dayItems.filter((item) => item.status === 'done')

function formatDate(iso) {
    // standardising T00:00:00 keep it in local time so the day does not shift
    return new Date(iso + "T00:00:00").toLocaleDateString('en-SG', {
        weekday: 'short', 
        day: 'numeric',
        month: 'short',
    })
}

// how many of this day's items are already watered
function doneCount(dayItems) {
    return dayItems.filter((item) => item.status === 'done').length
}

// true if any item on this day was moved or added by the weather
function hasChange(dayItems) {
    return dayItems.some((item) => item.adjustmentType)
}
</script>

<template>
  <div>
    <ScheduleLegend />

    <WeekNav
      :title="`${formatDate(startISO)} – ${formatDate(endISO)}`"
      :is-current-week="isCurrentWeek"
      :has-later="hasLater"
      @shift="shiftWeek"
      @today="goToToday"
    />

    <!-- :key changes with the week, so Vue treats it as a new element and plays the slide -->
    <Transition :name="`week-${slide}`" mode="out-in">
      <div :key="startISO">
        <section
          v-for="([date, dayItems], index) in grouped"
          :key="date"
          class="mb-3"
          :style="{ '--i': Math.min(index, 6) }"
        >
          <h6
            class="date-heading text-muted d-flex align-items-center justify-content-between"
            :class="{ clickable: isAllDone(dayItems) }"
            :role="isAllDone(dayItems) ? 'button' : null"
            :tabindex="isAllDone(dayItems) ? 0 : null"
            :aria-expanded="isAllDone(dayItems) ? !!open[date] : null"
            @click="isAllDone(dayItems) && toggle(date)"
            @keydown.enter="isAllDone(dayItems) && toggle(date)"
            @keydown.space.prevent="isAllDone(dayItems) && toggle(date)"
          >
            <span>
              <span v-if="isAllDone(dayItems)" class="chevron" :class="{ open: open[date] }">▸</span>
              {{ formatDate(date) }}
            </span>
            <span
              class="count-badge"
              :class="{ changed: hasChange(dayItems), finished: isAllDone(dayItems) }"
            >
              <template v-if="isAllDone(dayItems)">✅ All done</template>
              <template v-else-if="doneCount(dayItems)">{{ doneCount(dayItems) }}/{{ dayItems.length }} done</template>
              <template v-else>{{ dayItems.length }} 💧</template>
            </span>
          </h6>

          <!-- plants still to water: always visible -->
          <TransitionGroup name="card" tag="div" appear class="card-list d-flex flex-column gap-2">
            <ScheduleDayCard
              v-for="item in pendingItems(dayItems)"
              :key="item.requestItemId"
              :item="item"
              layout="row"
            />
          </TransitionGroup>

          <!-- partly done day: one slim row that folds the finished plants -->
          <button
            v-if="doneCount(dayItems) && !isAllDone(dayItems)"
            class="done-fold"
            :aria-expanded="!!open[date]"
            @click="toggle(date)"
          >
            <span class="chevron" :class="{ open: open[date] }">▸</span>
            ✅ {{ doneCount(dayItems) }} done
          </button>

          <!-- finished plants: only shown when expanded -->
          <TransitionGroup name="card" tag="div" class="card-list d-flex flex-column gap-2">
            <ScheduleDayCard
              v-for="item in (open[date] ? doneItems(dayItems) : [])"
              :key="item.requestItemId"
              :item="item"
              layout="row"
            />
          </TransitionGroup>
        </section>

        <p v-if="!grouped.length" class="text-center text-muted my-4">
          🌿 Nothing to water {{ isCurrentWeek ? 'in the next 7 days' : 'this week' }}.
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ---------- the week slides in and out ---------- */
.week-next-enter-active, .week-next-leave-active,
.week-prev-enter-active, .week-prev-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.week-next-enter-from { opacity: 0; transform: translateX(30px); }
.week-next-leave-to   { opacity: 0; transform: translateX(-30px); }
.week-prev-enter-from { opacity: 0; transform: translateX(-30px); }
.week-prev-leave-to   { opacity: 0; transform: translateX(30px); }

.date-heading {
  position: sticky;
  top: 56px;
  z-index: 2;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
}

/* ---------- collapsible days ---------- */
.date-heading.clickable { cursor: pointer; user-select: none; }
.date-heading.clickable:hover { background: rgba(255, 255, 255, 0.98); }
.date-heading.clickable:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }

.chevron {
  display: inline-block;
  margin-right: 0.35rem;
  transition: transform 0.2s ease;
}
.chevron.open { transform: rotate(90deg); }

.done-fold {
  display: block;
  width: 100%;
  margin: 0.5rem 0;
  padding: 0.35rem 0.75rem;
  border: 1px dashed rgba(22, 163, 74, 0.5);
  border-radius: var(--radius-md);
  background: rgba(22, 163, 74, 0.1);
  color: #14532d;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: left;
}
.done-fold:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }

/* ---------- count badge (same look as the calendar) ---------- */
.count-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  color: #0c4a6e;
  background: rgba(14, 165, 233, 0.15);
}
.count-badge.changed {
  color: #92400e;
  background: rgba(245, 158, 11, 0.25);
}
.count-badge.finished {      /* must come after .changed so green wins */
  color: #14532d;
  background: rgba(22, 163, 74, 0.25);
}

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
  .card-enter-active, .card-leave-active,
  .week-next-enter-active, .week-next-leave-active,
  .week-prev-enter-active, .week-prev-leave-active { animation: none; transition: none; }
  .chevron { transition: none; }
}
</style>