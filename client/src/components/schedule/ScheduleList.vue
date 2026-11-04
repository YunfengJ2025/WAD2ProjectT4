<script setup>
import { computed } from 'vue'
import ScheduleGroup from './ScheduleGroup.vue'
import ScheduleLegend from './ScheduleLegend.vue'
import { useWeekRange } from '../../composables/schedule/useWeekRange'
import WeekNav from './WeekNav.vue'
import { groupByStatus } from '../../utils/wateringStatus'

const props = defineProps({ 
    items: { 
        type: Array, 
        default: () => [] 
    }
})

const { slide, isCurrentWeek, startISO, endISO, shiftWeek, goToToday, isOpen, toggle } = useWeekRange()

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

function isAllDone(dayItems) {
    return dayItems.length > 0 && doneCount(dayItems) === dayItems.length
}

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
          <h6 class="date-heading text-muted d-flex align-items-center justify-content-between">
            <span>{{ formatDate(date) }}</span>
            <span class="count-badge" :class="{ changed: hasChange(dayItems), finished: isAllDone(dayItems) }">
              <template v-if="isAllDone(dayItems)">✅ All done</template>
              <template v-else-if="doneCount(dayItems)">{{ doneCount(dayItems) }}/{{ dayItems.length }} done</template>
              <template v-else>{{ dayItems.length }} 💧</template>
            </span>
          </h6>

          <ScheduleGroup
            v-for="group in groupByStatus(dayItems)"
            :key="group.status"
            :status="group.status"
            :items="group.items"
            :open="isOpen(date, group.status)"
            layout="row"
            @toggle="toggle(date, group.status)"
          />
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

@media (prefers-reduced-motion: reduce) {
  .week-next-enter-active, .week-next-leave-active,
  .week-prev-enter-active, .week-prev-leave-active { animation: none; transition: none; }
}
</style>