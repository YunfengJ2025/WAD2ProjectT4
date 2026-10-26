<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import StatusPill from '@/components/plant/StatusPill.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { photoSrc } from '@/api/plants'
import { usePlantsStore } from '@/stores/plants'
import { getWateringStatus, startOfDay } from '@/utils/wateringStatus'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const { show: toast } = useToast()


const plantsStore = usePlantsStore()
const plant = computed(() => plantsStore.findPlant(route.params.plantId))
const loading = ref(true)
const loadError = ref('')
const confirmingDelete = ref(false)
const deleting = ref(false)
const watering = ref(false)

async function markWatered() {
  if (watering.value) return
  watering.value = true
  try {
    await plantsStore.markWatered(route.params.plantId)
    toast('Watering recorded')
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    watering.value = false
  }
}
// true if the photo link is broken, so we show the leaf placeholder instead
const photoFailed = ref(false)

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
}
watch(() => route.params.plantId, load, { immediate: true })

const status = computed(() => plant.value && getWateringStatus(plant.value))

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
  const often = days === 1 ? 'every day' : `every ${days} days`
  return amountMl ? `${amountMl} ml, ${often}` : often[0].toUpperCase() + often.slice(1)
})

// The next four waterings. Anything already due or overdue counts as today.
const schedule = computed(() => {
  const today = startOfDay(new Date())
  const next = status.value.nextDate
  const start = next && next > today ? next : today
  const freq = plant.value.wateringInfo.frequencyDays
  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i * freq)
    return { date: d, isToday: d.getTime() === today.getTime() }
  })
})

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
          :src="photoSrc(plant.photoUrl)"
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

        <dl class="facts">
          <div>
            <dt>Where to find it</dt>
            <dd>{{ plant.plantLocation }}</dd>
          </div>
          <div>
            <dt>Rain</dt>
            <dd>{{ plant.rainExposed ? 'Exposed to rain' : 'Sheltered' }}</dd>
          </div>
          <div>
            <dt>Watering</dt>
            <dd>{{ frequency }}</dd>
          </div>
          <div>
            <dt>Last watered</dt>
            <dd>{{ plant.lastWateredAt ? fullDate(plant.lastWateredAt) : 'Not yet' }}</dd>
          </div>
        </dl>

        <section class="block">
          <h2>Care notes</h2>
          <p v-if="plant.wateringInfo.notes" class="notes">{{ plant.wateringInfo.notes }}</p>
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
          <button type="button" class="btn btn-primary" :disabled="watering" @click="markWatered">
            {{ watering ? 'Saving…' : 'Mark watered' }}
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
  object-fit: cover;
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

dt {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

dd {
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

.notes {
  white-space: pre-line;
  line-height: 1.65;
  color: var(--color-text);
}

.muted {
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
