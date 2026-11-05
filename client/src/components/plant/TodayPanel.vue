<script setup>
// TodayPanel: top of My Plants.
// - "Needs water": due/overdue plants with checkboxes, watered together with one button.
//   Each row also shows how many care checklist steps are left (links to the plant page).
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

// Care checklist progress for each plant that needs water, by plantId,
// e.g. { 37: { total: 7, left: 3 } }. total 0 = the plant has no care notes.
const careInfo = computed(() => {
  const info = {}
  for (const plant of needsWater.value) {
    const steps = getCareSteps(plant.wateringInfo.notes)
    const done = getDoneSteps(plant) // ticks since the last watering
    const left = steps.filter((step) => !done.includes(step)).length
    info[plant.plantId] = { total: steps.length, left: left }
  }
  return info
})

// "3 care steps left ›", "1 care step left ›" or "Care steps done ✓"
function careLabel(plantId) {
  const left = careInfo.value[plantId].left
  if (left === 0) return 'Care steps done ✓'
  if (left === 1) return '1 care step left ›'
  return `${left} care steps left ›`
}

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
  // Remember each plant's old "last watered" date, so Undo can put it back
  const watered = []
  try {
    // One at a time, using the same store action as the card button
    for (const id of ids) {
      const oldDate = plantsStore.findPlant(id)?.lastWateredAt || null
      await plantsStore.markWatered(id)
      watered.push({ id: id, oldDate: oldDate })
      done++
    }
    // Toast with an Undo button, shown for 6 seconds
    toast(`${done} plant${done === 1 ? '' : 's'} watered`, 'success', 6000, {
      label: 'Undo',
      onClick: () => undoWatering(watered),
    })
  } catch (err) {
    toast(`${done} of ${ids.length} watered. ${err.message}`, 'error')
  } finally {
    saving.value = false
  }
}

// Undo: save each plant's old "last watered" date again (same save as the edit form).
// An empty date means "never watered".
async function undoWatering(watered) {
  saving.value = true
  let undone = 0
  try {
    for (const item of watered) {
      const data = new FormData()
      data.append('lastWateredAt', item.oldDate || '')
      await plantsStore.savePlant(data, item.id)
      undone++
    }
    toast(`Undone: ${undone} plant${undone === 1 ? '' : 's'} back to needing water`, 'info')
  } catch (err) {
    toast(`Could not undo all of them (${undone} undone). ${err.message}`, 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="today" aria-labelledby="today-title">
    <!-- Title on the left, water button on the right -->
    <div class="panel-head">
      <h2 id="today-title">Today</h2>
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

    <!-- Two columns on big screens: Needs water (left) | Watered today (right) -->
    <div class="panel-body">
      <!-- Needs water: one row per plant = tick box + name, status tag, care steps left -->
      <div class="needs">
        <h3>Needs water ({{ needsWater.length }})</h3>
        <template v-if="needsWater.length">
          <label class="select-all">
            <input type="checkbox" :checked="allSelected" :disabled="saving" @change="toggleAll" />
            <span>Select all</span>
          </label>

          <!-- TransitionGroup: a watered row fades and slides out, the rest glide up -->
          <TransitionGroup tag="ul" name="row" class="check-list" tabindex="0" aria-label="Plants needing water">
            <li v-for="plant in needsWater" :key="plant.plantId" class="plant-row">
              <label class="row-check">
                <input
                  v-model="selected"
                  type="checkbox"
                  :value="plant.plantId"
                  :disabled="saving"
                />
                <span class="name">{{ plant.plantName }}</span>
              </label>
              <!-- Same coloured tag as on the plant cards: red = overdue, yellow = due -->
              <StatusPill :status="getWateringStatus(plant)" class="status-pill" />
              <!-- Care steps left; opens the plant page where the checklist is.
               Kept outside the <label> so clicking it doesn't tick the box. -->
              <RouterLink
                v-if="careInfo[plant.plantId]?.total"
                :to="`/plants/${plant.plantId}`"
                class="care-link"
                :class="{ done: careInfo[plant.plantId].left === 0 }"
              >
                {{ careLabel(plant.plantId) }}
              </RouterLink>
            </li>
          </TransitionGroup>
          <p v-if="needsWater.length > 3" class="phone-list-hint">Scroll to see all {{ needsWater.length }} plants</p>
        </template>
        <p v-else class="muted">All caught up 🌱</p>
      </div>

      <!-- Watered today: sidebar on big screens, underneath on small ones -->
      <div class="watered">
        <h3>Watered today ({{ wateredToday.length }})</h3>
        <!-- New chips pop in (always rendered so even the first chip animates) -->
        <TransitionGroup tag="ul" name="chip" class="chips">
          <li v-for="plant in wateredToday" :key="plant.plantId" class="chip">
            ✓ {{ plant.plantName }}
          </li>
        </TransitionGroup>
        <p v-if="!wateredToday.length" class="muted">Nothing watered yet today.</p>
      </div>
    </div>
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

/* "Today" on the left, "Mark N as watered" on the right; wraps on small phones */
.panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.panel-head .btn {
  padding: 0.35rem 0.9rem;
  font-size: 0.85rem;
}

h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-heading);
}

h3 {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.select-all,
.row-check {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
}

.select-all {
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
  color: var(--muted);
}

.select-all input,
.row-check input {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  accent-color: var(--accent);
}

/* One row per plant, in 3 columns that line up:
   [tick + name] [status tag] [care steps left]
   (Not called "row": Bootstrap's .row would stretch the tags to full width.) */
.plant-row {
  display: grid;
  /* name takes the free space; the two tag columns are fixed so they line up */
  grid-template-columns: minmax(0, 1fr) 9.5rem 10.5rem;
  align-items: center;
  gap: 0.4rem 1rem;
  padding: 0.45rem 0;
}

.plant-row + .plant-row {
  border-top: 1px solid var(--color-border);
}

.name {
  font-weight: 600;
  color: var(--color-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* No shadow here (it's only needed over photos); keep the tag its own width */
.plant-row .status-pill {
  justify-self: start;
  box-shadow: none;
}

/* "3 care steps left ›": amber link, no underline; green when all done */
.care-link {
  justify-self: end; /* right edge of the Needs water column */
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  background: #fff4d6;
  color: #7a5200;
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.care-link:hover {
  background: #ffe9ad;
}

.care-link.done {
  background: var(--accent-soft);
  color: var(--accent);
}

/* "Watered today" title and chips on one line */
.watered {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.75rem;
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.watered h3 {
  margin: 0;
}

/* Big screens: Needs water (2/3) and Watered today (1/3) side by side */
@media (min-width: 900px) {
  .panel-body {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 2rem;
  }

  .watered {
    flex-direction: column;
    align-items: flex-start;
    align-self: start;
    margin-top: 0;
    padding: 0 0 0 1.5rem;
    border-top: none;
    border-left: 1px solid var(--color-border);
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.15rem 0.65rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 600;
}

.muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.phone-list-hint { display: none; }
/* Keep the phone summary short while leaving every plant reachable. */
@media (max-width: 600px) {
  .today { padding: 0.75rem; }
  .panel-head .btn { min-height: 44px; padding-inline: 0.65rem; font-size: 0.75rem; }
  .select-all { min-height: 44px; }
  .check-list { max-height: 14rem; overflow-y: auto; overflow-x: hidden; overscroll-behavior-y: contain; scrollbar-width: thin; padding-right: 0.25rem; }
  .check-list:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .plant-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.2rem 0.4rem;
    padding-block: 0.4rem;
  }
  .row-check { grid-column: 1 / -1; min-height: 36px; }
  .name { white-space: normal; overflow: visible; font-size: 0.85rem; line-height: 1.3; overflow-wrap: break-word; }
  .plant-row .status-pill { margin-left: 1.75rem; font-size: 0.65rem; padding: 0.15rem 0.4rem; }
  .care-link {
    grid-column: 2;
    justify-self: end;
    margin-left: 0;
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
  }
  .phone-list-hint { display: block; margin: 0.4rem 0 0; font-size: 0.7rem; color: var(--muted); }
  .watered { margin-top: 0.6rem; padding-top: 0.6rem; font-size: 0.8rem; }
}

/* ---------- List animations (TransitionGroup adds these classes) ---------- */

/* Needed so a leaving row can be taken out of the layout (position: absolute) */
.check-list {
  position: relative;
}

/* Rows: fade + slide right when leaving (and when coming back) */
.row-enter-active,
.row-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

/* The leaving row stops taking up space, so the rows below can glide up */
.row-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}

.row-enter-from,
.row-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

/* The rows that shift up to close the gap */
.row-move {
  transition: transform 0.3s ease;
}

/* Chips: pop in from small */
.chip-enter-active {
  transition:
    opacity 0.3s ease 0.15s,
    transform 0.3s ease 0.15s;
}

.chip-enter-from {
  opacity: 0;
  transform: scale(0.6);
}

/* No sliding or popping if the user turned on "reduce motion" */
@media (prefers-reduced-motion: reduce) {
  .row-enter-active,
  .row-leave-active,
  .row-move,
  .chip-enter-active {
    transition: none;
  }
}
</style>
