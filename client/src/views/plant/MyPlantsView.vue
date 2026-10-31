<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PlantCard from '@/components/plant/PlantCard.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { storeToRefs } from 'pinia'
import { usePlantsStore } from '@/stores/plants'
import { getWateringStatus, compareByWateringStatus } from '@/utils/wateringStatus'
import { useToast } from '@/composables/useToast'

const { show: toast } = useToast()

const plantsStore = usePlantsStore()
const { plants } = storeToRefs(plantsStore)
const loading = ref(true)
const loadError = ref('')

const search = ref('')
const statusFilter = ref('all')

const pendingDelete = ref(null)
const deleting = ref(false)

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due', label: 'Due' },
  { value: 'upcoming', label: 'Upcoming' },
]

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    await plantsStore.fetchPlants()
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Status is recomputed whenever a plant's lastWateredAt changes.
const withStatus = computed(() =>
  plants.value.map((plant) => ({ plant, status: getWateringStatus(plant) })),
)

const counts = computed(() => {
  const c = { all: withStatus.value.length, overdue: 0, due: 0, upcoming: 0 }
  for (const { status } of withStatus.value) c[status.key]++
  return c
})

const visible = computed(() => {
  const term = search.value.trim().toLowerCase()
  return withStatus.value
    .filter(({ plant, status }) => {
      if (term && !plant.plantName.toLowerCase().includes(term)) return false
      if (statusFilter.value !== 'all' && status.key !== statusFilter.value) return false
      return true
    })
    .sort(compareByWateringStatus)
})

// Resets the search box and goes back to the "All" tab
function clearFilters() {
  search.value = ''
  statusFilter.value = 'all'
}

async function confirmDelete() {
  const plant = pendingDelete.value
  deleting.value = true
  try {
    await plantsStore.deletePlant(plant.plantId)
    toast(`${plant.plantName} deleted`)
    pendingDelete.value = null
  } catch (err) {
    toast(err.message || 'Could not delete plant', 'error')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <main class="my-plants">
    <header class="page-head">
      <div>
        <h1>My Plants</h1>
        <p v-if="!loading && !loadError" class="sub">
          <template v-if="counts.overdue || counts.due">
            {{ counts.overdue + counts.due }} need{{ counts.overdue + counts.due === 1 ? 's' : '' }}
            watering today
          </template>
          <template v-else-if="counts.all">All caught up</template>
          <template v-else>Track watering for every plant you own</template>
        </p>
      </div>
      <RouterLink to="/plants/new" class="btn btn-primary">+ Add plant</RouterLink>
    </header>

    <!-- Loading -->
    <ul v-if="loading" class="grid" aria-busy="true" aria-label="Loading plants">
      <li v-for="n in 4" :key="n" class="skeleton"></li>
    </ul>

    <!-- Load error -->
    <section v-else-if="loadError" class="state">
      <h2>Couldn't load your plants</h2>
      <p>{{ loadError }}</p>
      <button type="button" class="btn" @click="load">Try again</button>
    </section>

    <!-- Empty: no plants at all -->
    <section v-else-if="plants.length === 0" class="state">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21v-8m0 0c0-4 3-7 8-7 0 4-3 7-8 7Zm0 0C12 9 9 6 4 6c0 4 3 7 8 7Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <h2>No plants yet</h2>
      <p>Add your first plant to start tracking when it needs water.</p>
      <RouterLink to="/plants/new" class="btn btn-primary">Add your first plant</RouterLink>
    </section>

    <template v-else>
      <section class="toolbar" aria-label="Search and filter plants">
        <div class="search">
          <label for="plant-search" class="visually-hidden">Search plants by name</label>
          <input
            id="plant-search"
            v-model="search"
            type="search"
            placeholder="Search by name…"
            autocomplete="off"
          />
        </div>
        <div class="status-tabs" role="group" aria-label="Filter by watering status">
          <button
            v-for="tab in STATUS_TABS"
            :key="tab.value"
            type="button"
            :class="['tab', tab.value, { active: statusFilter === tab.value }]"
            :aria-pressed="statusFilter === tab.value"
            @click="statusFilter = tab.value"
          >
            {{ tab.label }} <span class="count">{{ counts[tab.value] }}</span>
          </button>
        </div>
      </section>

      <p class="result-count" aria-live="polite">
        Showing {{ visible.length }} of {{ plants.length }} plant{{ plants.length === 1 ? '' : 's' }}
      </p>

      <!-- No results for the current filters -->
      <section v-if="visible.length === 0" class="state">
        <h2>No plants match</h2>
        <p>Try a different name or another tab.</p>
        <button type="button" class="btn" @click="clearFilters">Show all plants</button>
      </section>

      <TransitionGroup v-else tag="ul" name="card" class="grid">
        <li v-for="item in visible" :key="item.plant.plantId">
          <PlantCard
            :plant="item.plant"
            @delete="pendingDelete = $event"
          />
        </li>
      </TransitionGroup>
    </template>

    <ConfirmDialog
      :open="!!pendingDelete"
      :title="`Delete ${pendingDelete?.plantName ?? 'plant'}?`"
      message="This removes the plant and its photo. This can't be undone."
      confirm-label="Delete"
      busy-label="Deleting…"
      :busy="deleting"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </main>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

h1 {
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  font-weight: 700;
  color: var(--color-heading);
  line-height: 1.2;
}

.sub {
  color: var(--muted);
}

/* Toolbar */
.toolbar {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

@media (min-width: 1024px) {
  .toolbar {
    grid-template-columns: minmax(220px, 1fr) auto;
    align-items: center;
  }
}

.search input {
  width: 100%;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-hover);
  border-radius: 8px;
  background: var(--surface);
  color: var(--color-text);
  font: inherit;
}

.search input:focus-visible,
.tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.status-tabs {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 40px;
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--color-border-hover);
  border-radius: 999px;
  background: var(--surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

.tab .count {
  min-width: 1.5em;
  padding: 0 0.4em;
  border-radius: 999px;
  background: var(--color-background-mute);
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
}

.tab.active {
  background: var(--color-heading);
  border-color: var(--color-heading);
  color: var(--color-background);
  font-weight: 600;
}

.tab.active .count {
  background: rgba(255, 255, 255, 0.2);
}

.tab.overdue .count {
  color: var(--danger);
}

.tab.due .count {
  color: var(--warn);
}

.tab.active .count {
  color: inherit;
}

.result-count {
  font-size: 0.875rem;
  color: var(--muted);
  margin-bottom: 0.75rem;
}

/* Grid: 1 col on phones, 2 on tablets, 3 on laptops, 4 on wide screens */
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  padding: 0;
  list-style: none;
}

@media (min-width: 600px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.skeleton {
  height: 340px;
  border-radius: var(--radius);
  background: linear-gradient(
    90deg,
    var(--color-background-mute) 25%,
    var(--color-background-soft) 50%,
    var(--color-background-mute) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite linear;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

/* Empty / no results / error */
.state {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 3rem 1rem;
  text-align: center;
  border: 1px dashed var(--color-border-hover);
  border-radius: var(--radius);
}

.state svg {
  width: 56px;
  height: 56px;
  color: var(--accent);
}

.state h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-heading);
}

.state p {
  color: var(--muted);
  max-width: 40ch;
}


.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Cards animate in, out and to their new spot when the list changes */
.card-move,
.card-enter-active,
.card-leave-active {
  transition:
    transform 0.35s ease,
    opacity 0.25s ease;
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

.card-leave-active {
  position: absolute;
  visibility: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .card-move,
  .card-enter-active,
  .card-leave-active,
  .skeleton {
    transition: none;
    animation: none;
  }
}
</style>
