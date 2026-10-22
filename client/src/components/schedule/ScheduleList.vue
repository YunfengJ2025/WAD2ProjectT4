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
</script>

<template>
  <div>
    <ScheduleLegend />
    <section v-for="[date, dayItems] in grouped" :key="date" class="mb-3">
      <h6 class="date-heading text-muted">{{ formatDate(date) }}</h6>
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