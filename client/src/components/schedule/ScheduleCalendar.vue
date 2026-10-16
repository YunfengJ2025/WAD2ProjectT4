<script setup>
import { ref, computed } from 'vue'
import ScheduleDayCard from './ScheduleDayCard.vue'

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
  const d = new Date(rangeStart.value)
  d.setDate(d.getDate() + direction * 7)
  rangeStart.value = d
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-2">
      <button class="btn btn-outline-secondary btn-sm" @click="shiftWeek(-1)">‹ Previous</button>
      <strong>{{ days[0].label }} – {{ days[6].label }}</strong>
      <button class="btn btn-outline-secondary btn-sm" @click="shiftWeek(1)">Next ›</button>
    </div>

    <div class="d-grid gap-2" style="grid-template-columns: repeat(7, 1fr)">
      <div
        v-for="day in days"
        :key="day.iso"
        class="border rounded p-2"
        :class="{ 'bg-light': day.isToday }"
        style="min-height: 140px"
      >
        <div class="small fw-bold mb-2" :class="{ 'text-primary': day.isToday }">
          {{ day.label }}
        </div>
        <div class="d-flex flex-column gap-2">
          <ScheduleDayCard v-for="item in day.items" :key="item.requestItemId" :item="item" />
        </div>
      </div>
    </div>
  </div>
</template>