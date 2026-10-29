<script setup>
import { computed } from 'vue'
import ScheduleDayCard from './ScheduleDayCard.vue'
import ScheduleLegend from './ScheduleLegend.vue'

const props = defineProps({ 
    items: { 
        type: Array, 
        default: () => [] 
    }
})

// sorted [date, item] pairs e.g. {'2026-10-17': [items], ...}
const grouped = computed(() => {
    const byDate = {} // sorted pairs
    for (const item of props.items) {
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
    <section 
      v-for="[date, dayItems] in grouped" 
      :key="date" 
      class="mb-3" 
      :style="{ '--i': Math.min(index, 6) }"
    > 
      <h6 class="date-heading text-muted d-flex align-items-center justify-content-between">
        <span>{{ formatDate(date) }}</span>
        <span
          class="count-badge"
          :class="{ changed: hasChange(dayItems), finished: doneCount(dayItems) === dayItems.length }"
        >
          <template v-if="doneCount(dayItems) === dayItems.length">✅ All done</template>
          <template v-else-if="doneCount(dayItems)">{{ doneCount(dayItems) }}/{{ dayItems.length }} done</template>
          <template v-else>{{ dayItems.length }} 💧</template>
        </span>
      </h6>
      <TransitionGroup name="card" tag="div" appear class="card-list d-flex flex-column gap-2">
        <ScheduleDayCard v-for="item in dayItems" :key="item.requestItemId" :item="item" />
      </TransitionGroup>
    </section>

    <p v-if="!grouped.length" class="text-center text-muted my-4">🌿 Nothing to water yet.</p>
  </div>
</template>

<style scoped>
.date-heading {
  position: sticky;
  top: 0;
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
  .card-enter-active, .card-leave-active { animation: none; }
}
</style>