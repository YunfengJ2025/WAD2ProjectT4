<script setup>
// TodayPanel: top of My Plants.
// - "Needs water": due/overdue plants with checkboxes, watered together with one button
// - "Care to-do": due/overdue plants that still have care checklist steps left
// - "Watered today": small chips for plants already watered today
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { usePlantsStore } from '@/stores/plants'
import { useToast } from '@/composables/useToast'
import { getWateringStatus, isWateredToday } from '@/utils/wateringStatus'
import { getCareSteps, getDoneSteps } from '@/utils/careSteps'
import StatusPill from './StatusPill.vue'

// plants: every plant of the user (from MyPlantsView)
const props = defineProps({
  plants: { type: Array, required: true },
})
const plantsStore = usePlantsStore()
const { show: toast } = useToast()

// Due or overdue plants, most overdue first
const needsWater = computed(() => {
  const list = props.plants.filter((plant) => {
    const key = getWateringStatus(plant).key
    return key === 'due' || key === 'overdue'
  })
  return list.sort((a, b) => getWateringStatus(a).daysUntil - getWateringStatus(b).daysUntil)
})

// Plants whose last watered date is today
const wateredToday = computed(() => props.plants.filter((plant) => isWateredToday(plant)))

// Care to-do: due/overdue plants with care checklist steps not ticked yet.
// e.g. [{ plant: Monstera, left: 3 }]
const careTodo = computed(() => {
  const list = []
  for (const plant of needsWater.value) {
    const steps = getCareSteps(plant.wateringInfo.notes)
    const done = getDoneSteps(plant) // ticks since the last watering
    const left = steps.filter((step) => !done.includes(step)).length
    if (left > 0) list.push({ plant: plant, left: left })
  }
  return list
})

// plantIds of the ticked checkboxes (v-model on checkboxes gives an array)
const selected = ref([])
// Tick everything by default, and again whenever the list changes
function selectAll() {
  selected.value = needsWater.value.map((plant) => plant.plantId)
}
selectAll()
watch(needsWater, selectAll)

// "Select all" checkbox: ticked when every plant is ticked
const allSelected = computed(() => selected.value.length === needsWater.value.length)
// Clicking it ticks everything, or unticks everything if all were ticked
function toggleAll() {
  if (allSelected.value) {
    selected.value = []
  } else {
    selectAll()
  }
}

const saving = ref(false)

async function waterSelected() {
  if (saving.value || selected.value.length === 0) return
  saving.value = true
  // Copy the ticked ids first: the list changes as each plant is watered
  const ids = selected.value.slice()
  let done = 0
  try {
    // One at a time, using the same store action as the card button
    for (const id of ids) {
      await plantsStore.markWatered(id)
      done++
    }
    toast(`${done} plant${done === 1 ? '' : 's'} watered`)
  } catch (err) {
    toast(`${done} of ${ids.length} watered. ${err.message}`, 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="today" aria-labelledby="today-title">
    <h2 id="today-title">Today</h2>

    <!-- Needs water -->
    <div class="group-head">
      <h3>Needs water ({{ needsWater.length }})</h3>
      <button
        v-if="needsWater.length"
        type="button"
        class="btn btn-primary"
        :disabled="saving || selected.length === 0"
        @click="waterSelected"
      >
        {{ saving ? 'Saving…' : `Mark ${selected.length} as watered` }}
      </button>
    </div>

    <label v-if="needsWater.length" class="select-all">
      <input type="checkbox" :checked="allSelected" :disabled="saving" @change="toggleAll" />
      <span>Select all</span>
    </label>

    <ul v-if="needsWater.length" class="check-list">
      <li v-for="plant in needsWater" :key="plant.plantId">
        <label>
          <input v-model="selected" type="checkbox" :value="plant.plantId" :disabled="saving" />
          <span class="name">{{ plant.plantName }}</span>
          <!-- Same coloured tag as on the plant cards: red = overdue, yellow = due -->
          <StatusPill :status="getWateringStatus(plant)" class="status-pill" />
        </label>
      </li>
    </ul>
    <p v-else class="muted">All caught up 🌱</p>

    <!-- Care to-do: only shown when a due plant still has checklist steps left -->
    <template v-if="careTodo.length">
      <h3 class="section-title">Care to-do ({{ careTodo.length }})</h3>
      <ul class="todo-list">
        <li v-for="item in careTodo" :key="item.plant.plantId">
          <RouterLink :to="`/plants/${item.plant.plantId}`">{{ item.plant.plantName }}</RouterLink>
          <span class="steps-left">
            {{ item.left === 1 ? '1 step left' : `${item.left} steps left` }}
          </span>
        </li>
      </ul>
    </template>

    <!-- Watered today -->
    <h3 class="watered-title">Watered today ({{ wateredToday.length }})</h3>
    <ul v-if="wateredToday.length" class="chips">
      <li v-for="plant in wateredToday" :key="plant.plantId" class="chip">✓ {{ plant.plantName }}</li>
    </ul>
    <p v-else class="muted">Nothing watered yet today.</p>
  </section>
</template>

<style scoped>
.today {
  margin-bottom: 1.25rem;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-heading);
}

h3 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Title on the left, button on the right; wraps on small phones */
.group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.group-head .btn {
  padding: 0.35rem 0.9rem;
  font-size: 0.85rem;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.check-list li + li {
  border-top: 1px solid var(--color-border);
}

.check-list label,
.select-all {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0;
  cursor: pointer;
}

/* Line under "Select all" so it reads as a header for the list */
.select-all {
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9rem;
  color: var(--muted);
}

.check-list input,
.select-all input {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
}

.name {
  font-weight: 600;
  color: var(--color-heading);
}

/* Status text on the right, red when overdue */
/* Tag on the right of each row; no shadow here (it's only needed over photos) */
.check-list .status-pill {
  margin-left: auto;
  box-shadow: none;
}

.watered-title,
.section-title {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

/* Care to-do rows: plant name on the left, steps left on the right */
.todo-list li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.4rem 0;
}

.todo-list li + li {
  border-top: 1px solid var(--color-border);
}

.todo-list a {
  font-weight: 600;
  color: var(--color-heading);
}

.steps-left {
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: #fff4d6;
  color: #7a5200;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 600;
}

.muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
