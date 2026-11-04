<script setup>
import Loading from '@/components/Loading.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PlantIcon from '@/components/plant/PlantIcon.vue'
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
const inActiveRequest = ref(false) // true = in a care request still going, so no Delete
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
// true if the photo link is broken, so we show the "No photo yet" icon instead
const photoFailed = ref(false)

// No photo: show a random plant icon (picked once when the page opens)
const ICON_TYPES = [
  'leafy',
  'cactus',
  'flower',
  'herb',
  'tree',
  'snake',
  'monstera',
  'vine',
  'succulent',
]
const randomIcon = ICON_TYPES[Math.floor(Math.random() * ICON_TYPES.length)]

// Get the latest copy of this plant from the server (it may not be in the store yet,
// e.g. when the page is opened directly or refreshed)
async function load() {
  loading.value = true
  loadError.value = ''
  photoFailed.value = false
  try {
    const result = await plantsStore.fetchPlant(route.params.plantId)
    inActiveRequest.value = result.inActiveRequest
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
const doneCount = computed(
  () => careSteps.value.filter((step) => doneSteps.value.includes(step)).length,
)
// e.g. 1 of 2 done -> 50
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

// "Inside my home", or "Outside my door" + rain
// (older plants have no isOutdoor saved, so they count as outdoor)
const placement = computed(() => {
  if (plant.value.isOutdoor === false) return 'Inside my home'
  if (plant.value.rainExposed) return 'Outside my door · Exposed to rain'
  return 'Outside my door · Sheltered'
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

// Banner under the title: one message for the plant's status
const banner = computed(() => {
  const amount = plant.value.wateringInfo.amountMl
  const water = amount ? `Water ${amount} ml` : 'Water it'
  if (wateredToday.value) {
    return {
      tone: 'ok',
      icon: '✓',
      text: `Watered today · Next: ${formatShortDate(status.value.nextDate)}`,
    }
  }
  if (status.value.key === 'overdue') {
    return { tone: 'overdue', icon: '⚠', text: `${status.value.label} · ${water} today` }
  }
  if (status.value.key === 'due') {
    return { tone: 'due', icon: '💧', text: `${status.value.label} · ${water} today` }
  }
  return {
    tone: 'ok',
    icon: '✓',
    text: `All good · Next watering ${formatShortDate(status.value.nextDate)}`,
  }
})

// Small text under each date: "Now" (overdue), "Today", or the month
function dayLabel(s, i) {
  if (i === 0 && status.value.key === 'overdue') return 'Now'
  if (s.isToday) return 'Today'
  return s.date.toLocaleDateString('en-SG', { month: 'short' })
}

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

    <!-- Keep plant detail loading consistent with the rest of the app. -->
    <Loading v-if="loading" label="Loading plant details…" />

    <div v-else-if="loadError" class="state" role="alert">
      <h1>Couldn't load this plant</h1>
      <p>{{ loadError }}</p>
      <RouterLink to="/plants" class="btn btn-outline">Back to My Plants</RouterLink>
    </div>

    <article v-else-if="plant">
      <!-- Header: name, Edit and Delete -->
      <header class="page-head">
        <div>
          <h1>{{ plant.plantName }}</h1>
          <p class="added">Added {{ fullDate(plant.createdAt) }}</p>
        </div>
        <div class="head-actions">
          <RouterLink :to="`/plants/${plant.plantId}/edit`" class="btn edit-btn">Edit</RouterLink>
          <!-- Disabled while the plant is in an active care request -->
          <button
            type="button"
            class="btn delete-btn"
            :disabled="inActiveRequest"
            :aria-describedby="inActiveRequest ? 'delete-locked' : undefined"
            @click="confirmingDelete = true"
          >
            Delete
          </button>
        </div>
      </header>
      <p v-if="inActiveRequest" id="delete-locked" class="delete-locked">
        🔒 This plant is in an active care request, so it can't be deleted. Cancel or finish the
        request first.
      </p>

      <!-- One status banner with the main action -->
      <div class="banner" :class="banner.tone" role="status">
        <p class="banner-text">
          <span aria-hidden="true">{{ banner.icon }}</span> {{ banner.text }}
        </p>
        <button
          v-if="!wateredToday"
          type="button"
          class="btn btn-primary water-btn"
          :disabled="watering"
          @click="onWaterClick"
        >
          {{ waterLabel }}
        </button>
      </div>

      <!-- Left: photo + upcoming. Right: details + checklist -->
      <div class="grid">
        <div class="col">
          <div class="card photo-card">
            <img
              v-if="plant.photoUrl && !photoFailed"
              :src="plant.photoUrl"
              :alt="`Photo of ${plant.plantName}`"
              class="plant-photo"
              @error="photoFailed = true"
            />
            <!-- Not called "placeholder": Bootstrap's .placeholder makes a solid block -->
            <div v-else class="no-photo">
              <PlantIcon :type="randomIcon" :size="120" />
              <span>No photo yet</span>
            </div>
          </div>

          <section class="card">
            <h2>Upcoming waterings</h2>
            <ol class="schedule">
              <li
                v-for="(s, i) in schedule"
                :key="i"
                :class="{
                  first: i === 0,
                  today: s.isToday,
                  late: i === 0 && status.key === 'overdue',
                }"
              >
                <span class="day">{{
                  s.date.toLocaleDateString('en-SG', { weekday: 'short' })
                }}</span>
                <span class="date">{{ s.date.getDate() }}</span>
                <span class="month">{{ dayLabel(s, i) }}</span>
              </li>
            </ol>
          </section>
        </div>

        <div class="col">
          <section class="card">
            <h2>Details</h2>
            <div class="facts">
              <div class="fact wide">
                <p class="label"><span aria-hidden="true">📍</span> Where to find it</p>
                <p class="value">{{ plant.plantLocation }}</p>
              </div>
              <div class="fact">
                <p class="label"><span aria-hidden="true">☀️</span> Placement</p>
                <p class="value">{{ placement }}</p>
              </div>
              <div class="fact">
                <p class="label"><span aria-hidden="true">💧</span> Watering</p>
                <p class="value">{{ frequency }}</p>
              </div>
              <div class="fact wide">
                <p class="label"><span aria-hidden="true">🗓️</span> Last watered</p>
                <p class="value">
                  {{ plant.lastWateredAt ? fullDate(plant.lastWateredAt) : 'Not yet' }}
                </p>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <h2>Care checklist</h2>
              <span v-if="careSteps.length" class="count"
                >{{ doneCount }} of {{ careSteps.length }} done</span
              >
            </div>
            <!-- Bootstrap progress bar: the width follows the percentage done -->
            <div
              v-if="careSteps.length"
              class="progress care-progress"
              role="progressbar"
              aria-label="Care checklist progress"
              :aria-valuenow="donePercent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div class="progress-bar bg-success" :style="{ width: donePercent + '%' }"></div>
            </div>
            <ul v-if="careSteps.length" class="checklist">
              <li v-for="step in careSteps" :key="step">
                <label>
                  <input v-model="doneSteps" type="checkbox" :value="step" @change="onStepChange" />
                  <span :class="{ done: doneSteps.includes(step) }">{{ step }}</span>
                </label>
              </li>
            </ul>
            <p v-else class="muted">
              No care steps yet.
              <RouterLink :to="`/plants/${plant.plantId}/edit`">Add some</RouterLink>
            </p>
          </section>
        </div>
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
      :message="
        status.nextDate
          ? `It's not due until ${formatShortDate(status.nextDate)}. Water anyway?`
          : ''
      "
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
/* Sizes: text 32 / 18 / 15 / 13px, spacing in steps of 8px */
.detail-page {
  --text-dark: #1f3a2b;
  --text-soft: #4d5b52; /* darker grey so small text is readable */
  --line: #e1e8e3;
  font-size: 15px;
  color: var(--text-dark);
}

/* Header */
.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-heading);
  overflow-wrap: anywhere;
}

.head-actions {
  display: flex;
  gap: 8px;
}

/* Buttons: same height, no glow */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 15px;
  box-shadow: none;
}

.btn-outline {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text-dark);
}

.btn-outline:hover {
  border-color: var(--accent);
  background: #fff;
  color: var(--accent);
}

/* Edit: green outline, fills green on hover */
.edit-btn {
  border: 1.5px solid var(--accent);
  background: #fff;
  color: var(--accent);
  font-weight: 600;
}

.edit-btn:hover {
  background: var(--accent);
  color: #fff;
}

/* Delete: red outline, fills red on hover */
.delete-btn {
  border: 1.5px solid var(--danger);
  background: #fff;
  color: var(--danger);
  font-weight: 600;
}

.delete-btn:hover:not(:disabled) {
  background: var(--danger);
  color: #fff;
}

/* Greyed out when the plant is in an active request */
.delete-btn:disabled {
  border-color: var(--line);
  color: var(--text-soft);
  cursor: not-allowed;
}

.delete-locked {
  margin: -8px 0 16px;
  color: var(--text-soft);
  font-size: 13px;
  text-align: right;
}

.water-btn,
.water-btn:hover {
  box-shadow: none;
}

.btn:active:not(:disabled) {
  transform: scale(0.96);
}

/* Status banner */
.banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px 24px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #fff;
}

.banner-text {
  margin: 0;
  font-weight: 600;
}

.banner.overdue {
  border-color: #f3c4bf;
  background: var(--danger-soft);
  color: var(--danger);
}

.banner.due {
  border-color: #f2dc9b;
  background: #fff8e1;
  color: #7a5200;
}

.banner.ok {
  color: var(--accent);
}

/* Layout */
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.col {
  display: grid;
  gap: 24px;
  align-content: start;
  min-width: 0;
}

/* Same card style for every section */
.card {
  margin: 0;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #fff;
}

.card h2 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-heading);
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.card-head .count {
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 600;
}

.care-progress {
  height: 8px;
  margin-bottom: 16px;
}

/* Photo: one crop that fills the frame */
.card.photo-card {
  padding: 0;
  overflow: hidden;
}

.plant-photo {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.no-photo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  aspect-ratio: 4 / 3;
  background: #f3f7f4;
  color: var(--text-soft);
  font-weight: 600;
}

/* Details: each fact is a soft tile, 2 per row */
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.fact {
  padding: 16px;
  border-radius: 12px;
  background: #f3f7f4;
}

/* Long facts take the whole row */
.fact.wide {
  grid-column: 1 / -1;
}

.label {
  margin: 0 0 8px;
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 600;
}

.value {
  margin: 0;
  font-weight: 600;
  color: var(--text-dark);
  overflow-wrap: anywhere;
}

/* Care checklist */
.checklist {
  margin: 0;
  padding: 0;
  list-style: none;
}

.checklist li + li {
  border-top: 1px solid var(--line);
}

.checklist label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  cursor: pointer;
}

.checklist input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  flex-shrink: 0;
  accent-color: var(--accent);
}

.checklist .done {
  text-decoration: line-through;
  color: var(--text-soft);
}

.muted {
  margin: 0;
  color: var(--text-soft);
}

/* Upcoming waterings */
.schedule {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.schedule li {
  display: grid;
  justify-items: center;
  padding: 8px 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  line-height: 1.3;
}

.schedule li.first {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.schedule .day,
.schedule .month {
  color: var(--text-soft);
  font-size: 13px;
}

.schedule .date {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-heading);
}

.schedule li.today .month {
  color: var(--accent);
  font-weight: 700;
}

/* Overdue: first box says "Now" in red */
.schedule li.late {
  border-color: var(--danger);
  background: var(--danger-soft);
}

.schedule li.late .month {
  color: var(--danger);
  font-weight: 700;
}

.added {
  margin: 8px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}

/* Error state */
.state {
  display: grid;
  justify-items: start;
  gap: 16px;
}

.state h1 {
  font-size: 24px;
}

/* Loading placeholders */
.skeleton {
  border-radius: 16px;
  background: var(--color-background-mute);
  animation: pulse 1.2s ease-in-out infinite;
}

.skeleton.line.wide {
  width: 50%;
  height: 40px;
  margin-bottom: 24px;
}

.banner-skeleton {
  height: 64px;
  margin-bottom: 24px;
}

.card-skeleton {
  height: 320px;
}

@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}

/* Big screens: two columns */
@media (min-width: 860px) {
  .grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }
}

/* Phones */
@media (max-width: 520px) {
  .facts {
    grid-template-columns: 1fr;
  }

  .banner,
  .card {
    padding: 16px;
  }

  .banner .water-btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
</style>
