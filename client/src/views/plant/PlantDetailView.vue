<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import StatusPill from '@/components/plant/StatusPill.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { usePlantsStore } from '@/stores/plants'
import {
  getWateringStatus,
  startOfDay,
  isWateredToday,
  formatShortDate,
} from '@/utils/wateringStatus'
import { getCareSteps, getDoneSteps, saveDoneSteps } from '@/utils/careSteps'
import { useToast } from '@/composables/useToast'

// PlantDetailView: one plant's page (/plants/:plantId).
// Shows the photo, facts, care checklist and next waterings,
// with Mark watered / Edit / Delete buttons.

const route = useRoute() // the current URL, e.g. route.params.plantId = "5"
const router = useRouter() // used to change page in code (router.push)
const { show: toast } = useToast()

// The plant comes from the Pinia store, so this page, the cards and the edit form
// all show the same data. computed: updates when the store's plant changes.
const plantsStore = usePlantsStore()
const plant = computed(() => plantsStore.findPlant(route.params.plantId))
const loading = ref(true)
const loadError = ref('')
const confirmingDelete = ref(false) // "Delete plant?" pop-up open?
const deleting = ref(false)
const watering = ref(false) // true while Mark watered is saving
// Already watered today: the button is disabled so it can't be pressed twice
const wateredToday = computed(() => plant.value && isWateredToday(plant.value))
const waterLabel = computed(() => {
  if (watering.value) return 'Saving…'
  if (wateredToday.value) return 'Watered today ✓'
  return 'Mark watered'
})

// Store action -> PATCH /plants/:id/water on the server -> lastWateredAt = now.
// The store then updates the plant, so the status pill and schedule refresh by themselves.
async function markWatered() {
  if (watering.value) return // ignore double clicks
  watering.value = true
  try {
    await plantsStore.markWatered(route.params.plantId)
    toast('Watering recorded')
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    watering.value = false
    confirmingEarly.value = false
  }
}

// Not due yet: ask first, in case the button was pressed by mistake
const confirmingEarly = ref(false)
function onWaterClick() {
  if (status.value.key === 'upcoming') {
    confirmingEarly.value = true
  } else {
    markWatered()
  }
}
// true if the photo link is broken, so we show the leaf placeholder instead
const photoFailed = ref(false)

// Get the latest copy of this plant from the server (it may not be in the store yet,
// e.g. when the page is opened directly or refreshed)
async function load() {
  loading.value = true
  loadError.value = ''
  photoFailed.value = false
  try {
    await plantsStore.fetchPlant(route.params.plantId)
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
  loadDoneSteps()
}

// Care checklist: each line of the care notes is one step (see utils/careSteps.js)
const careSteps = computed(() => (plant.value ? getCareSteps(plant.value.wateringInfo.notes) : []))
const doneSteps = ref([]) // the steps ticked today
// Only count ticks for steps that are still in the notes
const doneCount = computed(() => careSteps.value.filter((step) => doneSteps.value.includes(step)).length)
// e.g. 4 of 7 done -> 57
const donePercent = computed(() => {
  if (careSteps.value.length === 0) return 0
  return Math.round((doneCount.value / careSteps.value.length) * 100)
})

// Ticks are kept until the plant is watered again (see utils/careSteps.js)
function loadDoneSteps() {
  doneSteps.value = plant.value ? getDoneSteps(plant.value) : []
}
function onStepChange() {
  saveDoneSteps(plant.value, doneSteps.value)
}
// Mark watered changes lastWateredAt, so the checklist starts fresh
watch(() => plant.value?.lastWateredAt, loadDoneSteps)

// App.vue's <RouterView :key="route.path"> rebuilds this page for each plant,
// so loading once on mount is enough.
onMounted(load)

// Overdue / due / upcoming + label + next date (see utils/wateringStatus.js)
const status = computed(() => plant.value && getWateringStatus(plant.value))

// "Mon, 2 Nov 2026" (toLocaleDateString formats a date for Singapore)
const fullDate = (date) =>
  new Date(date).toLocaleDateString('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

// "250 ml, every 2 days" (older plants may have no amount saved)
const frequency = computed(() => {
  const { frequencyDays: days, amountMl } = plant.value.wateringInfo
  if (!amountMl) return days === 1 ? 'Every day' : `Every ${days} days`
  const often = days === 1 ? 'every day' : `every ${days} days`
  return `${amountMl} ml, ${often}`
})

// "Indoor", "Outdoor · Exposed to rain" or "Outdoor · Sheltered"
// (older plants have no isOutdoor saved, so they count as outdoor)
const placement = computed(() => {
  if (plant.value.isOutdoor === false) return 'Indoor'
  if (plant.value.rainExposed) return 'Outdoor · Exposed to rain'
  return 'Outdoor · Sheltered'
})

// The next four waterings. Anything already due or overdue counts as today.
// e.g. next = Wed, every 3 days -> Wed, Sat, Tue, Fri
const schedule = computed(() => {
  const today = startOfDay(new Date())
  const next = status.value.nextDate
  const start = next && next > today ? next : today
  const freq = plant.value.wateringInfo.frequencyDays
  const dates = []
  for (let i = 0; i < 4; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i * freq)
    dates.push({ date: d, isToday: d.getTime() === today.getTime() })
  }
  return dates
})

// "Delete" in the confirm pop-up: delete on the server, then go back to My Plants
async function onDelete() {
  deleting.value = true
  try {
    const { plantId, plantName } = plant.value
    await plantsStore.deletePlant(plantId)
    toast(`${plantName} deleted`)
    router.push('/plants')
  } catch (err) {
    toast(err.message || 'Could not delete plant', 'error')
    deleting.value = false
  }
}
</script>

<template>
  <main class="detail-page">
    <RouterLink to="/plants" class="back">← My Plants</RouterLink>

    <div v-if="loading" class="layout" aria-busy="true">
      <div class="photo skeleton"></div>
      <div class="info">
        <div class="skeleton line wide"></div>
        <div class="skeleton line"></div>
      </div>
    </div>

    <div v-else-if="loadError" class="state" role="alert">
      <h1>Couldn't load this plant</h1>
      <p>{{ loadError }}</p>
      <RouterLink to="/plants" class="btn">Back to My Plants</RouterLink>
    </div>

    <article v-else-if="plant" class="layout">
      <div class="photo">
        <img
          v-if="plant.photoUrl && !photoFailed"
          :src="plant.photoUrl"
          :alt="`Photo of ${plant.plantName}`"
          @error="photoFailed = true"
        />
        <svg v-else class="placeholder" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 21v-8m0 0c0-4 3-7 8-7 0 4-3 7-8 7Zm0 0C12 9 9 6 4 6c0 4 3 7 8 7Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div class="info">
        <header>
          <StatusPill :status="status" />
          <h1>{{ plant.plantName }}</h1>
        </header>

        <div class="facts">
          <div>
            <p class="label">Where to find it</p>
            <p class="value">{{ plant.plantLocation }}</p>
          </div>
          <div>
            <p class="label">Placement</p>
            <p class="value">{{ placement }}</p>
          </div>
          <div>
            <p class="label">Watering</p>
            <p class="value">{{ frequency }}</p>
          </div>
          <div>
            <p class="label">Last watered</p>
            <p class="value">{{ plant.lastWateredAt ? fullDate(plant.lastWateredAt) : 'Not yet' }}</p>
          </div>
        </div>

        <section class="block">
          <h2>Care checklist</h2>
          <template v-if="careSteps.length">
            <ul class="checklist">
              <li v-for="step in careSteps" :key="step">
                <label>
                  <input v-model="doneSteps" type="checkbox" :value="step" @change="onStepChange" />
                  <span :class="{ done: doneSteps.includes(step) }">{{ step }}</span>
                </label>
              </li>
            </ul>
            <!-- Bootstrap progress bar: the width follows the percentage done -->
            <div
              class="progress care-progress"
              role="progressbar"
              aria-label="Care checklist progress"
              :aria-valuenow="donePercent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div class="progress-bar bg-success" :style="{ width: donePercent + '%' }"></div>
            </div>
            <p class="muted small">
              Done {{ doneCount }} of {{ careSteps.length }} since last watering ·
              <strong>{{ donePercent }}%</strong>
            </p>
          </template>
          <p v-else class="muted">
            No notes yet.
            <RouterLink :to="`/plants/${plant.plantId}/edit`">Add some</RouterLink>
          </p>
        </section>

        <section class="block">
          <h2>Upcoming waterings</h2>
          <ol class="schedule">
            <li v-for="(s, i) in schedule" :key="i" :class="{ first: i === 0, today: s.isToday }">
              <span class="day">{{ s.date.toLocaleDateString('en-SG', { weekday: 'short' }) }}</span>
              <span class="date">{{ s.date.getDate() }}</span>
              <span class="month">
                {{ s.isToday ? 'Today' : s.date.toLocaleDateString('en-SG', { month: 'short' }) }}
              </span>
            </li>
          </ol>
        </section>

        <div class="actions">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="watering || wateredToday"
            @click="onWaterClick"
          >
            {{ waterLabel }}
          </button>
          <RouterLink :to="`/plants/${plant.plantId}/edit`" class="btn">Edit</RouterLink>
          <button type="button" class="btn delete" @click="confirmingDelete = true">Delete</button>
        </div>

        <p class="added">Added {{ fullDate(plant.createdAt) }}</p>
      </div>
    </article>

    <ConfirmDialog
      :open="confirmingDelete"
      :title="`Delete ${plant?.plantName ?? 'plant'}?`"
      message="This removes the plant and its photo. This can't be undone."
      confirm-label="Delete"
      busy-label="Deleting…"
      :busy="deleting"
      @confirm="onDelete"
      @cancel="confirmingDelete = false"
    />

    <!-- Asks before watering a plant that isn't due yet -->
    <ConfirmDialog
      v-if="plant"
      :open="confirmingEarly"
      :title="`Water ${plant.plantName} early?`"
      :message="status.nextDate ? `It's not due until ${formatShortDate(status.nextDate)}. Water anyway?` : ''"
      confirm-label="Water anyway"
      confirm-class="btn-primary"
      busy-label="Saving…"
      :busy="watering"
      @confirm="markWatered"
      @cancel="confirmingEarly = false"
    />
  </main>
</template>

<style scoped>
.detail-page {
  max-width: 1080px;
  margin: 0 auto;
}

.back {
  display: inline-block;
  margin-bottom: 1rem;
  color: var(--muted);
  font-weight: 500;
}

.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 860px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 2.5rem;
    align-items: start;
  }
  .photo {
    position: sticky;
    top: 1.5rem;
  }
}

.photo {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius);
  overflow: hidden;
  background:
    radial-gradient(circle at 30% 20%, var(--accent-soft), transparent 70%),
    var(--color-background-mute);
  color: var(--accent);
  box-shadow: var(--shadow);
}

.photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* contain = show the whole photo inside the same 4:3 frame (no cropping);
     any spare space shows the frame's soft green background */
  object-fit: contain;
}

.placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 72px;
  height: 72px;
  transform: translate(-50%, -50%);
  opacity: 0.6;
}

.info {
  display: grid;
  gap: 1.5rem;
  min-width: 0;
}

header {
  display: grid;
  justify-items: start;
  gap: 0.6rem;
}

h1 {
  font-size: clamp(1.8rem, 5vw, 2.5rem);
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-heading);
  overflow-wrap: anywhere;
}

.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-border);
  overflow: hidden;
}

.facts div {
  padding: 0.75rem 1rem;
  background: var(--surface);
}

.label {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

.value {
  margin: 0;
  font-weight: 600;
  color: var(--color-heading);
}

.block h2 {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.5rem;
}

.muted {
  color: var(--muted);
}

.muted.small {
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
}

/* Care checklist: one row per step */
.checklist {
  margin: 0;
  padding: 0;
  list-style: none;
}

.checklist li + li {
  border-top: 1px solid var(--color-border);
}

.checklist label {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.45rem 0;
  line-height: 1.5;
  cursor: pointer;
}

.checklist input {
  width: 18px;
  height: 18px;
  margin-top: 0.15rem;
  flex-shrink: 0;
  accent-color: var(--accent);
}

.care-progress {
  height: 8px;
  margin-top: 0.6rem;
}

/* Ticked steps are crossed out */
.checklist .done {
  text-decoration: line-through;
  color: var(--muted);
}

.schedule {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0;
  list-style: none;
}

.schedule li {
  display: grid;
  justify-items: center;
  padding: 0.6rem 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--surface);
  line-height: 1.25;
}

.schedule li.first {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.schedule .day,
.schedule .month {
  font-size: 0.75rem;
  color: var(--muted);
}

.schedule .date {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-heading);
}

.schedule li.today .month {
  color: var(--accent);
  font-weight: 700;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Phones: Edit and Delete share the row */
@media (max-width: 520px) {
  .actions > .btn {
    flex: 1;
  }
}

.delete {
  color: var(--danger);
}

.delete:hover {
  background: var(--danger-soft);
}

.added {
  font-size: 0.85rem;
  color: var(--muted);
}

.state {
  display: grid;
  justify-items: start;
  gap: 0.75rem;
}

.state h1 {
  font-size: 1.5rem;
}

.skeleton {
  border-radius: var(--radius);
  background: var(--color-background-mute);
  animation: pulse 1.2s ease-in-out infinite;
}

.skeleton.line {
  height: 1.5rem;
  width: 50%;
}

.skeleton.line.wide {
  height: 2.5rem;
  width: 80%;
}

@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
</style>
