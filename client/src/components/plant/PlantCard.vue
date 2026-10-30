<script setup>
// PlantCard: shows one plant in the My Plants grid.
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getWateringStatus } from '@/utils/wateringStatus'
import StatusPill from './StatusPill.vue'

// plant: the plant to show
const props = defineProps({
  plant: { type: Object, required: true },
})
const emit = defineEmits(['delete'])

// true if the photo link is broken, so we show the leaf placeholder instead
const photoFailed = ref(false)
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
      </ul>

      <!-- Care notes, only if there are any -->
      <p v-if="plant.wateringInfo.notes" class="notes">{{ plant.wateringInfo.notes }}</p>

      <!-- Edit / Delete -->
      <div class="actions">
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

.placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 48px;
  height: 48px;
  transform: translate(-50%, -50%);
  opacity: 0.6;
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
.name-link {
  padding: 0;
  color: inherit;
  font-weight: inherit;
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

.notes {
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
    color 0.15s;
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
