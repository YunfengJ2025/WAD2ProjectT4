<script setup>
import { computed } from 'vue'
import ScheduleDayCard from './ScheduleDayCard.vue'

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
  <div class="overflow-auto" style="max-height: 70vh">
    <section v-for="[date, dayItems] in grouped" :key="date" class="mb-3">
      <h6 class="text-muted">{{ formatDate(date) }}</h6>
      <div class="d-flex flex-column gap-2">
        <ScheduleDayCard v-for="item in dayItems" :key="item.requestItemId" :item="item" />
      </div>
    </section>
  </div>

</template>