<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import RequestMap from '../map/RequestMap.vue'
import plantPlaceholder from '@/assets/plant.png' // shown when a plant has no photo or it fails to load

const auth = useAuthStore()
const { show: toast } = useToast()

const origin = ref(null) // the sitter's home { lat, lng }, sent by the server
const allVisits = ref([]) // every open visit within 1 km, already sorted nearest first
const loading = ref(true)
const loadError = ref('')

const pinSelected = ref(null) // the visit chosen from the list or the map
const radiusKm = ref(1)
const selectedDate = ref('')

const acceptingId = ref(0) // visitId being accepted right now, so the button can't be double-clicked
const acceptedNote = ref('') // shown after a successful accept

const waterSourceLabels = {
  left_out: 'Water left outside',
  tap_available: 'Tap available',
  sitter_brings: 'Sitter brings water',
}

// ---- load from the backend (GET /find-nearby, which the dev proxy sends to the server) ----
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await auth.authorizedRequest('/find-nearby')
    origin.value = data.origin
    allVisits.value = data.visits
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ---- slider and date narrow the list instantly, without asking the server again ----
const filteredRequests = computed(() =>
  allVisits.value.filter(
    (v) => (!selectedDate.value || v.date === selectedDate.value) && v.distanceKm <= radiusKm.value,
  ),
)

// 0.45 km shows as "450 m", 1.2 km as "1.2 km"
function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Singapore',
  })
}

const plantCountLabel = (visit) => `${visit.plants.length} plant${visit.plants.length === 1 ? '' : 's'}`

// ---- accept: uses your teammates' existing route, POST /care-visits/:visitId/accept ----
async function acceptVisit(visit) {
  if (acceptingId.value) return
  acceptingId.value = visit.visitId
  acceptedNote.value = ''
  try {
    await auth.authorizedRequest(`/care-visits/${visit.visitId}/accept`, { method: 'POST' })
    allVisits.value = allVisits.value.filter((v) => v.visitId !== visit.visitId) // it is yours now
    pinSelected.value = null
    acceptedNote.value = `You accepted the visit on ${formatDate(visit.visitDate)}.`
    toast('Visit accepted! It is now in My Sits.', 'success')
  } catch (err) {
    toast(err.message, 'error')
    if (err.status === 409 || err.status === 404) {
      pinSelected.value = null
      await load() // someone else got there first, so refresh the list
    }
  } finally {
    acceptingId.value = 0
  }
}
</script>

<template>
  <h1>Find nearby</h1>
  <p>Good day helper! Make someone's day by clicking on any plant on the map!</p>

  <div class="filterBar">
    <label>
      Distance: {{ radiusKm }} km
      <input type="range" min="0.1" max="1" step="0.1" v-model.number="radiusKm" />
    </label>
    <label>
      Date:
      <input type="date" v-model="selectedDate" />
    </label>
  </div>

  <p v-if="loading" role="status">Finding plants near you…</p>

  <div v-else-if="loadError" class="alert alert-danger" role="alert">
    {{ loadError }}
    <button type="button" class="btn btn-sm btn-outline-danger ms-2" @click="load">Try again</button>
  </div>

  <div v-else class="pageContent">
    <!-- map section, about 70% of the page -->
    <RequestMap
      class="mapArea"
      :center="origin"
      :radius-km="radiusKm"
      :requests="filteredRequests"
      :selected="pinSelected"
      @select="pinSelected = $event"
    />

    <!-- request section -->
    <div class="requests">
      <!-- no pin selected: scrollable list, nearest first -->
      <div v-if="!pinSelected">
        <p v-if="acceptedNote" class="acceptedNote" role="status">
          {{ acceptedNote }}
          <RouterLink :to="{ path: '/requests', query: { tab: 'sits' } }">View in My Sits →</RouterLink>
        </p>

        <p v-if="filteredRequests.length === 0">
          No requests within {{ radiusKm }} km. Try widening the distance or changing the date.
        </p>

        <ul v-else class="requestList">
          <li
            v-for="(v, i) in filteredRequests"
            :key="v.visitId"
            class="requestCard"
            :style="{ animationDelay: `${Math.min(i, 8) * 60}ms` }"
            tabindex="0"
            @click="pinSelected = v"
            @keydown.enter="pinSelected = v"
          >
            <img
              :src="v.photoUrl || plantPlaceholder"
              :alt="v.plants[0]?.plantName || 'Plant'"
              class="plantPhoto"
              @error="$event.target.src = plantPlaceholder"
            />
            <div class="cardText">
              <h3>{{ v.address }}</h3>
              <p>{{ formatDistance(v.distanceKm) }} away · {{ formatDate(v.visitDate) }}</p>
              <p>{{ plantCountLabel(v) }} · {{ v.tokenReward }} tokens</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- pin selected: details and the accept button -->
      <div v-else>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="pinSelected = null">
          ← Back to list
        </button>

        <h2 class="detailTitle">{{ pinSelected.address }}</h2>
        <p class="meta">
          {{ formatDistance(pinSelected.distanceKm) }} away · {{ formatDate(pinSelected.visitDate) }} ·
          {{ pinSelected.tokenReward }} tokens
        </p>
        <p><strong>Owner:</strong> {{ pinSelected.ownerName }}</p>
        <p><strong>Water:</strong> {{ waterSourceLabels[pinSelected.waterSource] || 'Tap available' }}</p>
        <p v-if="pinSelected.note"><strong>Notes:</strong> {{ pinSelected.note }}</p>

        <div class="plantTiles">
          <div v-for="p in pinSelected.plants" :key="p.plantId" class="plantTile">
            <img
              :src="p.photoUrl || plantPlaceholder"
              :alt="p.plantName"
              @error="$event.target.src = plantPlaceholder"
            />
            <div>
              <strong>{{ p.plantName }}</strong>
              <span>{{ p.plantLocation }}</span>
              <span>Water {{ p.amountToWater }} ml</span>
              <span v-if="p.careInstructions">{{ p.careInstructions }}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-primary w-100"
          :disabled="acceptingId === pinSelected.visitId"
          @click="acceptVisit(pinSelected)"
        >
          {{ acceptingId === pinSelected.visitId ? 'Accepting…' : 'Accept request' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filterBar {
  display: flex;
  gap: 1.5rem;
  margin: 1rem 0;
}

.pageContent {
  display: grid;
  grid-template-columns: 70% 30%;
  grid-template-areas: "map requests";
}

.mapArea {
  grid-area: map;
  height: 70vh;
}

.requests {
  grid-area: requests;
  padding: 1rem;
  overflow-y: auto;
  max-height: 70vh;
}

.requestList {
  list-style: none;
  padding: 0.25rem; /* room so the lifted card is not clipped by the scroll area */
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* same lift-on-hover as the cards on the schedule page */
.requestCard {
  display: flex;
  gap: 0.75rem;
  padding: 0.6rem;
  border: 1px solid #ddd;
  border-radius: var(--radius-lg, 1rem);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
  cursor: pointer;
  transition: transform var(--transition-bounce, 500ms cubic-bezier(0.34, 1.56, 0.64, 1)),
    box-shadow var(--transition-base, 250ms ease);
  animation: cardIn 0.5s var(--transition-bounce, cubic-bezier(0.34, 1.56, 0.64, 1)) backwards;
}

.requestCard:hover,
.requestCard:focus-visible {
  transform: translateY(-4px) scale(1.01);
  box-shadow: var(--shadow-lg, 0 10px 25px -3px rgba(0, 0, 0, 0.12));
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .requestCard {
    transition: none;
    animation: none;
  }
  .requestCard:hover,
  .requestCard:focus-visible {
    transform: none;
  }
}

.plantPhoto {
  width: 64px;
  height: 64px;
  object-fit: cover; /* crop to fill the square instead of squashing */
  border-radius: 6px;
  flex-shrink: 0;
}

.cardText h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.cardText p {
  margin: 0;
  font-size: 0.85rem;
}

.acceptedNote {
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  background: #e7f3e9;
  color: #28623a;
  font-size: 0.9rem;
}

.acceptedNote a {
  display: block;
  font-weight: 700;
}

.detailTitle {
  margin: 0.9rem 0 0.2rem;
  font-size: 1.2rem;
}

.meta {
  color: #637466;
}

.plantTiles {
  display: grid;
  gap: 0.5rem;
  margin: 0.8rem 0;
}

.plantTile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem;
  border-radius: 10px;
  background: #f5f8f5;
}

.plantTile img {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 8px;
  object-fit: cover;
}

.plantTile div {
  display: grid;
  min-width: 0;
}

.plantTile span {
  color: #718074;
  font-size: 0.78rem;
}


@media (max-width: 768px) {
  .pageContent {
    grid-template-columns: 1fr;
    grid-template-areas:
      "map"
      "requests";
  }

  .mapArea {
    height: 50vh;
  }
}
</style>