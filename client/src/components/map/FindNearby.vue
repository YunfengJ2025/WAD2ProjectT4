<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import RequestMap from '../map/RequestMap.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
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

// the server sends plain Singapore dates like "2026-11-01"
function formatDay(ymd) {
  if (!ymd) return ''
  return new Date(`${ymd}T00:00:00+08:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Singapore',
  })
}

function formatPeriod(visit) {
  if (!visit.startDate || !visit.endDate) return ''
  return visit.startDate === visit.endDate
    ? formatDay(visit.startDate)
    : `${formatDay(visit.startDate)} – ${formatDay(visit.endDate)}`
}

// owners often leave the amount at 0, so fall back to the plant's own usual amount
function waterText(plant) {
  if (plant.amountToWater > 0) return `Water ${plant.amountToWater} ml`
  if (plant.usualAmountMl > 0) return `Usual ${plant.usualAmountMl} ml`
  return ''
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
      <div v-else class="detail">
        <button type="button" class="btn btn-sm btn-outline-secondary backBtn" @click="pinSelected = null">
          ← Back to list
        </button>

        <header class="detailHead">
          <h2>{{ pinSelected.address }}</h2>
          <div class="chips">
            <span class="chip">{{ formatDistance(pinSelected.distanceKm) }} away</span>
            <span v-if="pinSelected.totalDays > 1" class="chip">
              Day {{ pinSelected.dayNumber }} of {{ pinSelected.totalDays }}
            </span>
            <span class="chip chipReward">{{ pinSelected.tokenReward }} tokens</span>
          </div>
        </header>

        <!-- the owner, as a button that opens their public profile -->
        <RouterLink
          class="ownerBtn"
          :to="{ name: 'public-profile', params: { userId: pinSelected.ownerId } }"
          :aria-label="`View ${pinSelected.ownerName}'s profile`"
        >
          <UserAvatar :user="{ userName: pinSelected.ownerName, photoUrl: pinSelected.ownerPhotoUrl }" :size="46" />
          <span class="ownerText">
            <small>Posted by</small>
            <strong>{{ pinSelected.ownerName }}</strong>
          </span>
          <span class="ownerGo">View profile ›</span>
        </RouterLink>

        <dl class="facts">
          <div>
            <dt>Visit date</dt>
            <dd>{{ formatDate(pinSelected.visitDate) }}</dd>
          </div>
          <div>
            <dt>Request period</dt>
            <dd>{{ formatPeriod(pinSelected) || '—' }}</dd>
          </div>
          <div>
            <dt>Water</dt>
            <dd>{{ waterSourceLabels[pinSelected.waterSource] || 'Tap available' }}</dd>
          </div>
          <div>
            <dt>Still open</dt>
            <dd>{{ pinSelected.daysStillOpen }} of {{ pinSelected.totalDays }} day{{ pinSelected.totalDays === 1 ? '' : 's' }}</dd>
          </div>
        </dl>

        <section v-if="pinSelected.note" class="noteBox">
          <h3>Note from {{ pinSelected.ownerName }}</h3>
          <p>{{ pinSelected.note }}</p>
        </section>

        <section>
          <h3 class="sectionTitle">Plants to care for · {{ pinSelected.plants.length }}</h3>
          <div class="plantTiles">
            <article v-for="p in pinSelected.plants" :key="p.plantId" class="plantTile">
              <img
                :src="p.photoUrl || plantPlaceholder"
                :alt="p.plantName"
                @error="$event.target.src = plantPlaceholder"
              />
              <div class="plantBody">
                <strong>{{ p.plantName }}</strong>
                <span v-if="p.plantLocation" class="plantWhere">{{ p.plantLocation }}</span>
                <div class="tags">
                  <span v-if="waterText(p)" class="tag tagWater">{{ waterText(p) }}</span>
                  <span v-if="p.rainExposed" class="tag tagRain">Rain-exposed</span>
                </div>
                <p v-if="p.careInstructions" class="instructions">{{ p.careInstructions }}</p>
                <p v-if="p.weatherNote" class="weatherNote">{{ p.weatherNote }}</p>
              </div>
            </article>
          </div>
        </section>

        <!-- stays visible at the bottom while the panel scrolls -->
        <div class="acceptBar">
          <p>Accepting covers {{ formatDate(pinSelected.visitDate) }} only.</p>
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

/* ---------- detail card ---------- */
.detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.backBtn {
  align-self: flex-start;
}

.detailHead h2 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  line-height: 1.25;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid #d5ded8;
  color: #46584c;
  font-size: 0.8rem;
  font-weight: 600;
}

.chipReward {
  background: var(--accent, #2f7d4f);
  border-color: var(--accent, #2f7d4f);
  color: #fff;
}

/* owner button */
.ownerBtn {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid #d5ded8;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.85);
  color: inherit;
  text-decoration: none;
  transition: transform var(--transition-bounce, 500ms cubic-bezier(0.34, 1.56, 0.64, 1)),
    box-shadow var(--transition-base, 250ms ease), border-color 0.2s;
}

.ownerBtn:hover,
.ownerBtn:focus-visible {
  transform: translateY(-2px);
  border-color: var(--accent, #2f7d4f);
  box-shadow: var(--shadow-md, 0 4px 10px rgba(0, 0, 0, 0.1));
}

.ownerText {
  display: grid;
  min-width: 0;
  flex: 1;
  line-height: 1.2;
}

.ownerText small {
  color: #718074;
  font-size: 0.72rem;
}

.ownerText strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ownerGo {
  color: var(--accent, #2f7d4f);
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}

/* key facts */
.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin: 0;
}

.facts > div {
  padding: 0.55rem 0.7rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
}

.facts dt {
  color: #718074;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.facts dd {
  margin: 0.1rem 0 0;
  font-size: 0.9rem;
  font-weight: 600;
}

/* owner's note */
.noteBox {
  padding: 0.7rem 0.9rem;
  border-left: 4px solid var(--accent, #2f7d4f);
  border-radius: 0 12px 12px 0;
  background: rgba(255, 255, 255, 0.7);
}

.noteBox h3,
.sectionTitle {
  margin: 0 0 0.3rem;
  color: #718074;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.noteBox p {
  margin: 0;
  font-size: 0.92rem;
  white-space: pre-line;
}

/* plants */
.plantTiles {
  display: grid;
  gap: 0.5rem;
}

.plantTile {
  display: flex;
  gap: 0.65rem;
  padding: 0.55rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
}

.plantTile img {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 10px;
  object-fit: cover;
}

.plantBody {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.plantWhere {
  color: #718074;
  font-size: 0.8rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.tag {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.tagWater {
  background: #e3f0fb;
  color: #1d5f94;
}

.tagRain {
  background: #eee9fb;
  color: #5a43a6;
}

.instructions,
.weatherNote {
  margin: 0;
  font-size: 0.82rem;
}

.weatherNote {
  color: #9a5a00;
}

/* accept button stays in view while the panel scrolls */
.acceptBar {
  position: sticky;
  bottom: -1rem; /* the scroll panel has 1rem padding, so this puts the bar flush at its bottom edge */
  margin: 0 -1rem -1rem;
  padding: 0.7rem 1rem 1rem;
  background: rgba(255, 255, 255, 0.88);
  border-top: 1px solid #d5ded8;
  backdrop-filter: blur(6px);
}

.acceptBar p {
  margin: 0 0 0.4rem;
  color: #637466;
  font-size: 0.8rem;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .ownerBtn {
    transition: none;
  }
  .ownerBtn:hover,
  .ownerBtn:focus-visible {
    transform: none;
  }
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