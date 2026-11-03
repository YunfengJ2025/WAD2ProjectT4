<script setup>
// PlantCard: shows one plant in the My Plants grid.
// Gets the plant as a prop from MyPlantsView. Mark watered is done here (store action);
// Delete is only *asked* here: the card emits 'delete' and the page shows the confirm pop-up.
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getWateringStatus, isWateredToday, formatShortDate } from '@/utils/wateringStatus'
import { usePlantsStore } from '@/stores/plants'
import { useToast } from '@/composables/useToast'
import { getCareSteps, getDoneSteps } from '@/utils/careSteps'
import StatusPill from './StatusPill.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PlantIcon from './PlantIcon.vue'

// plant: the plant to show
const props = defineProps({
  plant: { type: Object, required: true },
})
const emit = defineEmits(['delete'])

// true if the photo link is broken, so we show the "No photo yet" icon instead
// (the <img @error> event sets it). If the plant gets a new photo, try again.
const photoFailed = ref(false)

// No photo: show a random plant icon (each card picks its own when it loads)
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
watch(
  () => props.plant.photoUrl,
  () => {
    photoFailed.value = false
  },
)

// Overdue / due / upcoming, worked out from last watered date + frequency
const status = computed(() => getWateringStatus(props.plant))
// "250 ml · Every 2 days" (older plants may have no amount saved)
const frequency = computed(() => {
  const { frequencyDays: days, amountMl } = props.plant.wateringInfo
  const often = days === 1 ? 'Daily' : `Every ${days} days`
  return amountMl ? `${amountMl} ml · ${often}` : often
})

// Care checklist tag: only shown when the plant is due or overdue,
// so plants that aren't due don't keep reminding the owner.
const careSteps = computed(() => getCareSteps(props.plant.wateringInfo.notes))
const stepsLeft = computed(() => {
  const done = getDoneSteps(props.plant) // ticks since the last watering
  return careSteps.value.filter((step) => !done.includes(step)).length
})
const showChecklistTag = computed(() => {
  if (careSteps.value.length === 0) return false
  return status.value.key === 'due' || status.value.key === 'overdue'
})
// "7 care steps" (or "1 care step") under the plant details
const careCountLabel = computed(() => {
  if (careSteps.value.length === 1) return '1 care step'
  return `${careSteps.value.length} care steps`
})
const checklistLabel = computed(() => {
  if (stepsLeft.value === 0) return 'Care steps done ✓'
  if (stepsLeft.value === 1) return '1 care step left'
  return `${stepsLeft.value} care steps left`
})

// "Mark watered" button: same as on the plant's detail page.
// The store updates the plant, so the status pill changes straight away.
const plantsStore = usePlantsStore()
const { show: toast } = useToast()
const watering = ref(false) // true while saving (disables the button)
// Already watered today: the button is disabled so it can't be pressed twice
const wateredToday = computed(() => isWateredToday(props.plant))
const waterLabel = computed(() => {
  if (watering.value) return 'Saving…'
  if (wateredToday.value) return 'Watered today ✓'
  return 'Mark watered'
})

async function markWatered() {
  if (watering.value) return
  watering.value = true
  try {
    await plantsStore.markWatered(props.plant.plantId)
    toast(`${props.plant.plantName} watered`)
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
</script>

<template>
  <!-- status.key is added as a class so the card is coloured by watering status -->
  <article class="card" :class="status.key">
    <!-- Plant photo, or a leaf icon if there is none, with the status pill on top -->
    <div class="photo">
      <img
        v-if="plant.photoUrl && !photoFailed"
        :src="plant.photoUrl"
        :alt="`Photo of ${plant.plantName}`"
        loading="lazy"
        @error="photoFailed = true"
      />
      <!-- No photo: picture icon + text. Not called "placeholder" because
           Bootstrap's .placeholder class turns it into a solid block. -->
      <div v-else class="no-photo">
        <PlantIcon :type="randomIcon" :size="96" />
        <span>No photo yet</span>
      </div>
      <StatusPill :status="status" class="pill" />
    </div>

    <div class="body">
      <!-- Name links to the plant's detail page -->
      <h3>
        <RouterLink :to="`/plants/${plant.plantId}`" class="name-link">
          {{ plant.plantName }}
        </RouterLink>
      </h3>

      <!-- Where to find it, and watering amount + frequency -->
      <ul class="meta" aria-label="Plant details">
        <!-- title shows the full text on hover if it gets cut off -->
        <li class="where" :title="plant.plantLocation">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span>{{ plant.plantLocation }}</span>
        </li>
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
          </svg>
          {{ frequency }}
        </li>
        <!-- Indoor plants can't be added to a care request, so show which kind it is -->
        <li>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 11 12 4l8 7M6 10v10h12V10" />
          </svg>
          {{ plant.isOutdoor === false ? 'Indoor' : 'Outdoor' }}
        </li>
        <!-- Care checklist progress, only when the plant is due/overdue -->
        <li v-if="showChecklistTag" class="checklist-tag" :class="{ done: stepsLeft === 0 }">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 4h16v16H4zM8 12l3 3 5-6" />
          </svg>
          {{ checklistLabel }}
        </li>
      </ul>

      <!-- Short summary of the care checklist (the full list is on the plant page).
           Hidden when the plant is due, because the "steps left" tag shows instead. -->
      <p v-if="careSteps.length && !showChecklistTag" class="care-count">{{ careCountLabel }}</p>

      <!-- Mark watered / Edit / Delete -->
      <div class="actions">
        <button
          type="button"
          class="btn btn-primary water-btn"
          :disabled="watering || wateredToday"
          @click="onWaterClick"
        >
          {{ waterLabel }}
        </button>
        <RouterLink
          :to="`/plants/${plant.plantId}/edit`"
          class="icon-btn"
          :aria-label="`Edit ${plant.plantName}`"
          title="Edit"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4" />
          </svg>
        </RouterLink>
        <button
          type="button"
          class="icon-btn danger"
          :aria-label="`Delete ${plant.plantName}`"
          title="Delete"
          @click="emit('delete', plant)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13" />
          </svg>
        </button>
      </div>
    </div>
    <!-- Asks before watering a plant that isn't due yet -->
    <ConfirmDialog
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
  </article>
</template>

<style scoped>
.card {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
  overflow: hidden;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-hover);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* Fixed 4:3 frame: the image is absolutely positioned so tall photos
   can't stretch the card. */
.photo {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background:
    radial-gradient(circle at 30% 20%, var(--accent-soft), transparent 70%),
    var(--color-background-mute);
  color: var(--accent);
}

.photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.card:hover .photo img {
  transform: scale(1.03);
}

/* Picture icon + "No photo yet" in the middle of the photo area */
.no-photo {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: #f3f7f4;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.pill {
  position: absolute;
  top: 0.65rem;
  left: 0.65rem;
}

.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.85rem 1rem 1rem;
}

h3 {
  font-size: 1.08rem;
  font-weight: 700;
  color: var(--color-heading);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

/* The name link stretches over the whole card so any click opens the plant.
   The buttons sit above it (z-index) so they still work on their own. */
/* No underline, even on hover (Bootstrap underlines all links) */
.name-link {
  padding: 0;
  color: inherit;
  font-weight: inherit;
  text-decoration: none;
  transition: none;
}

.name-link::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}

.name-link:hover {
  background: none;
  text-decoration: none;
}

.name-link:focus-visible {
  outline: none;
}

.card:has(.name-link:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.card:hover h3 {
  color: var(--accent);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.85rem;
  padding: 0;
  list-style: none;
  font-size: 0.85rem;
  color: var(--muted);
}

.meta li {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.meta li.where {
  flex-basis: 100%;
  min-width: 0;
}

.meta li.where span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Checklist tag: amber while steps are left, green when all done */
.meta li.checklist-tag {
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: #fff4d6;
  color: #7a5200;
  font-weight: 600;
}

.meta li.checklist-tag.done {
  background: var(--accent-soft);
  color: var(--accent);
}

.meta svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.care-count {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
}

.actions {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  margin-top: auto;
  padding-top: 0.6rem;
}

/* margin-right: auto pushes Edit and Delete to the right-hand side */
/* Small press effect: shrink a little while held down */
.water-btn:active:not(:disabled),
.icon-btn:active {
  transform: scale(0.94);
}

.water-btn {
  margin-right: auto;
  padding: 0.35rem 0.8rem;
  font-size: 0.85rem;
}

.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s,
    transform 0.1s ease;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.icon-btn:hover {
  background: var(--color-background-mute);
  color: var(--color-heading);
}

.icon-btn.danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

.icon-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .photo img {
    transition: none;
  }
  .card:hover,
  .card:hover .photo img {
    transform: none;
  }
}
</style>
