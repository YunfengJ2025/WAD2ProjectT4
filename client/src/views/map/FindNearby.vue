<script setup>
import Loading from '@/components/Loading.vue'
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import RequestMap from '@/components/map/RequestMap.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import plantPlaceholder from '@/assets/plant.png' // shown when a plant has no photo or it fails to load
// Care checklist (Carolyn): splits the instructions into steps (one per line)
import { getCareSteps } from '@/utils/careSteps'
import { waterSourceLabel } from '@/utils/visitFormat'
import { singaporeDate } from '@/utils/singaporeDate'


const auth = useAuthStore()
const { show: toast } = useToast()

const searchCenter = ref(null)
const origin = ref(null) // the sitter's home { lat, lng }, sent by the server
const allVisits = ref([]) // every open visit within 1 km, already sorted nearest first
const requestScroller = ref(null)
const requestContent = ref(null)
const requestsOverflow = ref(false)

// Contain gestures only when results really overflow. Short lists leave page
// scrolling available; long lists never hand their edge gestures to the page.
watch([requestScroller, requestContent], ([scroller, content], previous, onCleanup) => {
  if (!scroller || !content) {
    requestsOverflow.value = false
    return
  }
  const updateOverflow = () => {
    requestsOverflow.value = scroller.scrollHeight > scroller.clientHeight + 1
  }
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflow)
  observer?.observe(scroller)
  observer?.observe(content)
  updateOverflow()
  onCleanup(() => observer?.disconnect())
}, { flush: 'post' })
const loading = ref(true)
const loadError = ref('')

const pinSelected = ref(null) // the visit chosen from the list or the map
const radiusKm = ref(1)
const todayYmd = singaporeDate(new Date()) // "2026-11-03"
const selectedDate = ref(todayYmd)

// "See all requests" mode: requests grouped by owner for their whole request period
// Keep the view independent of the optional date filter.
const showAll = ref(false)
const activeGroupKey = ref('') // the grouped request opened from the list ('' = show the list)


const acceptingId = ref(0) // visitId being accepted right now, so the button can't be double-clicked
const acceptedNote = ref('') // shown after a successful accept

const isSignInError = ref(false)

// ---- "See all requests" shows every open request in the country, not just the ones within 1 km ----
// the server must skip its 1 km limit when it receives ?all=1 (if it ignores this, you just get the 1 km list)
const ALL_ENDPOINT = '/find-nearby?all=1'
const nationwideVisits = ref([]) // every open visit in the country, nearest first
const loadingAll = ref(false)
const loadAllError = ref('')

// ---- load from the backend (GET /find-nearby, which the dev proxy sends to the server) ----
async function load() {
  loading.value = true
  loadError.value = ''
  isSignInError.value = false
  try {
    const data = await auth.authorizedRequest('/find-nearby')
    origin.value = data.origin
    allVisits.value = data.visits
  } catch (err) {
    loadError.value = err.message
    if (loadError.value == "Please sign in first."){
      isSignInError.value = true
    }
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ---- slider and date narrow the list instantly, without asking the server again ----
// Distances are measured from the dropped pin when one is present.
const filteredRequests = computed(() => {
  const source = showAll.value || searchCenter.value ? nationwideVisits.value : allVisits.value
  const matchingGroups = showAll.value && selectedDate.value
    ? new Set(source.filter((v) => v.date === selectedDate.value).map(groupKey)) : null
  return source.map((visit) => {
    if (!searchCenter.value) return visit
    const rad = (n) => n * Math.PI / 180
    const { lat, lng } = searchCenter.value
    const a = Math.sin(rad(visit.lat - lat) / 2) ** 2
      + Math.cos(rad(lat)) * Math.cos(rad(visit.lat)) * Math.sin(rad(visit.lng - lng) / 2) ** 2
    return { ...visit, distanceKm: 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) }
  }).filter((v) => (showAll.value
    ? !matchingGroups || matchingGroups.has(groupKey(v))
    : !selectedDate.value || v.date === selectedDate.value)
    && ((showAll.value && !searchCenter.value) || v.distanceKm <= radiusKm.value))
    .sort((a, b) => a.distanceKm - b.distanceKm)
})

// "See all" starts with no date, so every request shows. The date picked on
// Find nearby is remembered and put back when the user returns (not reset to today).
let nearbyDate = todayYmd
function toggleView() {
  if (!showAll.value) {
    nearbyDate = selectedDate.value
    selectedDate.value = ''
  } else {
    selectedDate.value = nearbyDate
  }
  showAll.value = !showAll.value
  pinSelected.value = null
  activeGroupKey.value = ''
  acceptedNote.value = ''
  searchCenter.value = null
}

function resetOverview() {
  pinSelected.value = null
  activeGroupKey.value = ''
  acceptedNote.value = ''
  searchCenter.value = null
  radiusKm.value = 1
  selectedDate.value = ''
  if (!showAll.value) {
    showAll.value = true
  } else {
    loadAll()
  }
}

async function onDropPin(point) {
  searchCenter.value = point
  radiusKm.value = 1
  pinSelected.value = null
  activeGroupKey.value = ''
  await loadAll()
}

// ---- "See all requests": group the visits by owner and request period (no date picked, so every date is in) ----
const requestGroups = computed(() => {
  const groups = new Map()
  for (const v of filteredRequests.value) {
    const key = groupKey(v)
    if (!groups.has(key)) groups.set(key, { ...v, key, visits: [] }) // the first visit supplies the owner, address and period
    groups.get(key).visits.push(v)
  }
  for (const g of groups.values()) g.visits.sort((a, b) => a.date.localeCompare(b.date))
  return [...groups.values()] // still nearest first
})

const activeGroup = computed(() => requestGroups.value.find((g) => g.key === activeGroupKey.value))

// same owner + same request period = same grouped request
function groupKey(v) {
  return `${v.ownerId}|${v.startDate}|${v.endDate}`
}

// the postal code is the last 6 digits of the address (e.g. "Blk 333, Singapore 520301")
function postalKey(v) {
  return v.postalCode || v.address?.match(/\b\d{6}\b/)?.[0] || `${v.lat},${v.lng}`
}

// the pins on the map: normally every visit, but in "See all" only the first (nearest) visit per postal code
const mapRequests = computed(() => {
  if (!showAll.value) return filteredRequests.value
  const seen = new Set()
  const pins = []
  for (const v of filteredRequests.value) {
    const k = postalKey(v)
    if (!seen.has(k)) {
      seen.add(k)
      pins.push(v)
    }
  }
  return pins
})

// clicking a pin: in "See all" it opens that location's grouped request, otherwise the single visit
function onMapSelect(v) {
  if (showAll.value) {
    activeGroupKey.value = groupKey(v)
    pinSelected.value = null
  } else {
    pinSelected.value = v
  }
}

async function loadAll() {
  loadingAll.value = true
  loadAllError.value = ''
  try {
    const data = await auth.authorizedRequest(ALL_ENDPOINT)
    nationwideVisits.value = data.visits
  } catch (err) {
    loadAllError.value = err.message
  } finally {
    loadingAll.value = false
  }
}

// Changing filters clears details without changing the current view or search pin.
watch(selectedDate, () => {
  pinSelected.value = null
  activeGroupKey.value = ''
})
watch(showAll, (on) => {
  if (on) loadAll()
})

// up to 3 plant photos for the strip at the top of a grouped request
function groupPhotos(g) {
  const photos = g.visits.flatMap((v) => v.plants.map((p) => p.photoUrl)).filter(Boolean)
  return photos.length ? photos.slice(0, 3) : [plantPlaceholder]
}

// 0.45 km shows as "450 m", 1.2 km as "1.2 km"
// rounding to whole metres first avoids float noise like 0.30000000000000004 or 0.9999 showing as "1000 m"
function formatDistance(km) {
  const m = Math.round(km * 1000)
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}

// ---- distance slider: the bubble shows while the thumb is being dragged (or focused with the keyboard) ----
const sliding = ref(false)
const sliderMin = 0.1
const sliderMax = 1
// 0 to 100, used to size the green fill and place the bubble over the thumb
const sliderPercent = computed(() => ((radiusKm.value - sliderMin) / (sliderMax - sliderMin)) * 100)
const stopSliding = () => (sliding.value = false)
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
    nationwideVisits.value = nationwideVisits.value.filter((v) => v.visitId !== visit.visitId)
    pinSelected.value = null
    acceptedNote.value = `You accepted the visit on ${formatDate(visit.visitDate)}.`
    toast('Visit accepted! It is now in My Sits.', 'success')
  } catch (err) {
    toast(err.message, 'error')
    if (err.status === 409 || err.status === 404) {
      // Stop offering this visit even if the follow-up refresh fails.
      allVisits.value = allVisits.value.filter((v) => v.visitId !== visit.visitId)
      nationwideVisits.value = nationwideVisits.value.filter((v) => v.visitId !== visit.visitId)
      pinSelected.value = null
      activeGroupKey.value = ''
      // Nationwide and dropped-pin searches both read nationwideVisits.
      if (showAll.value || searchCenter.value) await loadAll()
      else await load()
    }
  } finally {
    acceptingId.value = 0
  }
}
</script>

<template>
  <h1>{{ showAll ? 'Find requests' : 'Find nearby' }}</h1>
  <p>Good day helper! Make someone's day by clicking on any plant on the map!</p>
  <!--
    filter bar section (Bootstrap):
    d-flex                -> flex container
    flex-column flex-md-row -> stacked one per line on phones, one row from 768px up (laptop = same row as before)
    flex-wrap             -> if a tablet is too narrow for one row, items drop to the next line
    gap-4 / my-3          -> 1.5rem gap and 1rem top/bottom margin, exactly the old values
  -->
  <div class="d-flex flex-column flex-md-row flex-wrap gap-4 my-3">
    <!-- text and slider stay side by side at every screen size; the slider shrinks when space runs out -->
    <!-- Always shown, so switching views doesn't make the map jump up and down.
         In "See all" with no pin there's no distance to set yet, so the slider is disabled. -->
    <label class="distanceLabel" :class="{ isDisabled: showAll && !searchCenter }">
      <span class="distanceText">Distance: {{ formatDistance(radiusKm) }}</span>
      <span
        class="sliderWrap"
        :class="{ isSliding: sliding }"
        :style="{ '--pct': sliderPercent }"
      >
        <output class="bubble" aria-hidden="true">{{ formatDistance(radiusKm) }}</output>
        <input
          type="range"
          class="plantSlider"
          :min="sliderMin"
          :max="sliderMax"
          step="0.1"
          v-model.number="radiusKm"
          :disabled="showAll && !searchCenter"
          :title="showAll && !searchCenter ? 'Tap the map to drop a pin first' : ''"
          @pointerdown="sliding = true"
          @pointercancel="stopSliding"
        />
      </span>
    </label>
    <label class="dateField">
      <span class="distanceText dateText">Date:</span>
      <input
        type="date"
        class="styledDate"
        v-model="selectedDate"
        aria-label="Filter requests by date"
      />
    </label>
    <!-- align-self-stretch: full width on phones; align-self-md-end: bottom of the row from 768px up (as before) -->
    <button
      type="button"
      class="allRequests align-self-stretch align-self-md-end"
      :class="{ isActive: showAll }"
      :aria-pressed="showAll"
      @click="toggleView"
    >
      {{ showAll ? 'Back to Find nearby' : 'See all requests' }}
    </button>
  </div>

  <!-- Shown in both views (tapping the map works in both), so the layout never shifts -->
  <p class="mapHint">Tap the map to search around a different spot in Singapore.</p>
  <!-- Use the same indicator for nearby and island-wide request searches. -->
  <Loading v-if="loading" label="Finding plants near you…" />

  <div v-else-if="loadError" class="alert alert-danger" role="alert">
    {{ loadError }}
    <button v-if="isSignInError==false && loadError" type="button" class="btn btn-sm btn-outline-danger ms-2" @click="load">Try again</button>
  </div>

  <!-- map on top and list underneath on phones/tablets; side by side (70% / 30%) from 992px up -->
  <div v-else class="mapResults d-flex flex-column flex-lg-row">
    <!-- map section, about 70% of the page -->
    <RequestMap
      class="mapArea"
      :center="searchCenter || origin"
      :home="origin"
      :overview="showAll && !searchCenter"
      :search-pin="searchCenter"
      @drop-pin="onDropPin"
      @select-home="onDropPin(origin)"
      @reset-overview="resetOverview"
      :radius-km="radiusKm"
      :requests="mapRequests"
      :selected="pinSelected || activeGroup || null"
      @select="onMapSelect"
    />

    <!-- The outer frame keeps its spacing while the inner results scroll. -->
    <div class="requestPanel">
    <div ref="requestScroller" class="requests" :class="{ 'is-scrollable': requestsOverflow }" tabindex="0" role="region" aria-label="Plant care requests">
    <div ref="requestContent">
      <!-- no pin selected: scrollable list, nearest first -->
      <div v-if="!pinSelected">
        <p v-if="acceptedNote" class="acceptedNote" role="status">
          {{ acceptedNote }}
          <RouterLink to="/my-sits">View in My Sits →</RouterLink>
        </p>

        <!-- ===== See all requests: grouped by owner, whole request period ===== -->
        <template v-if="showAll">
          <Loading v-if="loadingAll" label="Loading requests from across Singapore…" />
          <p v-else-if="loadAllError" class="text-danger" role="alert">
            {{ loadAllError }}
            <button type="button" class="btn btn-sm btn-outline-danger ms-2" @click="loadAll">Try again</button>
          </p>
          <template v-else>
          <!-- one grouped request opened: its owner, period and one card per open day -->
          <div v-if="activeGroup" class="detail">
            <button type="button" class="btn btn-sm btn-outline-secondary backBtn" @click="activeGroupKey = ''">
              ← Back to all requests
            </button>

            <div class="photoStrip">
              <img
                v-for="(src, i) in groupPhotos(activeGroup)"
                :key="i"
                :src="src"
                :alt="`${activeGroup.ownerName}'s plants`"
                @error="$event.target.src = plantPlaceholder"
              />
            </div>

            <header class="detailHead">
              <h2>{{ activeGroup.address }}</h2>
              <div class="chips">
                <span class="chip">{{ formatDistance(activeGroup.distanceKm) }} away</span>
                <span v-if="formatPeriod(activeGroup)" class="chip">{{ formatPeriod(activeGroup) }}</span>
                <span class="chip chipReward">
                  {{ activeGroup.visits.length }} day{{ activeGroup.visits.length === 1 ? '' : 's' }} open
                </span>
              </div>
            </header>

            <RouterLink
              class="ownerBtn"
              :to="{ name: 'public-profile', params: { userId: activeGroup.ownerId } }"
              :aria-label="`View ${activeGroup.ownerName}'s profile`"
            >
              <UserAvatar :user="{ userName: activeGroup.ownerName, photoUrl: activeGroup.ownerPhotoUrl }" :size="46" />
              <span class="ownerText">
                <small>Posted by</small>
                <strong>{{ activeGroup.ownerName }}</strong>
              </span>
              <span class="ownerGo">View profile ›</span>
            </RouterLink>

            <section>
              <h3 class="sectionTitle">Choose a visit</h3>
              <p class="groupNote">Each day is a separate visit. You only commit to the day you pick.</p>
              <ul class="requestList">
                <li
                  v-for="v in activeGroup.visits"
                  :key="v.visitId"
                  class="requestCard"
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
                    <h3>{{ formatDate(v.visitDate) }}</h3>
                    <p>{{ v.plants.map((p) => p.plantName).join(', ') }}</p>
                    <div class="chips cardChips">
                      <span class="chip">{{ plantCountLabel(v) }}</span>
                      <span class="chip chipReward">{{ v.tokenReward }} tokens</span>
                    </div>
                  </div>
                </li>
              </ul>
            </section>
          </div>

          <!-- the list of grouped requests, nearest first -->
          <template v-else>
            <p v-if="requestGroups.length === 0">
              No requests within {{ formatDistance(radiusKm) }}. Try widening the distance or changing the date.
            </p>

            <ul v-else class="requestList">
              <li
                v-for="(g, i) in requestGroups"
                :key="g.key"
                class="requestCard"
                :style="{ animationDelay: `${Math.min(i, 8) * 60}ms` }"
                tabindex="0"
                @click="activeGroupKey = g.key"
                @keydown.enter="activeGroupKey = g.key"
              >
                <img
                  :src="g.photoUrl || plantPlaceholder"
                  :alt="`${g.ownerName}'s plants`"
                  class="plantPhoto"
                  @error="$event.target.src = plantPlaceholder"
                />
                <div class="cardText">
                  <h3>{{ g.address }}</h3>
                  <p>{{ g.ownerName }}</p>
                  <div class="chips cardChips">
                    <span class="chip">{{ formatDistance(g.distanceKm) }} away</span>
                    <span v-if="formatPeriod(g)" class="chip">{{ formatPeriod(g) }}</span>
                    <span class="chip chipReward">{{ g.visits.length }} day{{ g.visits.length === 1 ? '' : 's' }} open</span>
                  </div>
                </div>
              </li>
            </ul>
          </template>
          </template>
        </template>

        <!-- ===== Normal view: the chosen day only ===== -->
        <template v-else>
          <p v-if="filteredRequests.length === 0">
            No requests within {{formatDistance(radiusKm)}}. Try widening the distance or changing the date.
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
                <p>{{ v.ownerName }} · {{ plantCountLabel(v) }}</p>
                <div class="chips cardChips">
                  <span class="chip">{{ formatDistance(v.distanceKm) }} away</span>
                  <span class="chip">{{ formatDate(v.visitDate) }}</span>
                  <span class="chip chipReward">{{ v.tokenReward }} tokens</span>
                </div>
              </div>
            </li>
          </ul>
        </template>
      </div>

      <!-- pin selected: details and the accept button -->
      <div v-else class="detail">
        <button type="button" class="btn btn-sm btn-outline-secondary backBtn" @click="pinSelected = null">
          {{ showAll ? '← Back' : '← Back to list' }}
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
            <dd>{{ waterSourceLabel(pinSelected.waterSource) }}</dd>
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
                <!-- Care checklist (Carolyn): steps as a list (tick boxes come after accepting) -->
                <div v-if="getCareSteps(p.careInstructions).length" class="instructions">
                  <p class="stepsTitle">Care steps ({{ getCareSteps(p.careInstructions).length }})</p>
                  <ul class="stepsList">
                    <li v-for="step in getCareSteps(p.careInstructions)" :key="step">{{ step }}</li>
                  </ul>
                </div>
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
    </div>
  </div>
</template>

<style scoped>
h1 {
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  font-weight: 700;
  color: var(--color-heading);
  line-height: 1.2;
}

/* ---------- see all requests button ---------- */
.allRequests {
  padding: 0.4rem 0.9rem;
  border: 1px solid #d5ded8;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  color: #46584c;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.25s ease, background 0.2s, color 0.2s;
}

.allRequests:hover,
.allRequests:focus-visible {
  border-color: var(--accent, #2f7d4f);
  box-shadow: 0 0 0 3px rgba(47, 125, 79, 0.18);
  outline: none;
}

.allRequests.isActive {
  background: var(--accent, #2f7d4f);
  border-color: var(--accent, #2f7d4f);
  color: #fff;
}

/* ---------- distance slider (green fill, plant thumb, bubble) ---------- */
.distanceLabel {
  display: flex;
  align-items: flex-end; /* the slider has bubble space above it, so line the text up with the track instead of the top */
  gap: 0.75rem;
}
/* "See all" with no pin yet: slider greyed out but still taking its space */
.distanceLabel.isDisabled {
  opacity: 0.45;
}
.distanceLabel.isDisabled .plantSlider {
  cursor: not-allowed;
}
.mapHint {
  margin: 0 0 0.75rem;
  color: var(--muted, #68766b);
  font-size: 0.9rem;
}

.distanceText {
  min-width: 9.5rem; /* fixed width so the slider doesn't shift when "500 m" becomes "1.0 km" */
  line-height: 34px; /* same as the thumb height, so the text sits level with the track */
  font-variant-numeric: tabular-nums;
}

.sliderWrap {
  --thumb: 34px;
  --track-h: 10px;
  --green: var(--accent, #2f7d4f);
  position: relative;
  display: block;
  width: 240px;
  max-width: 100%; /* never wider than the screen */
  padding-top: 34px; /* room for the bubble */
}

.plantSlider {
  -webkit-appearance: none;
  appearance: none;
  display: block;
  width: 100%;
  height: var(--thumb);
  margin: 0;
  background: transparent;
  cursor: pointer;
}

.plantSlider:focus {
  outline: none;
}

/* track: green up to the thumb, grey after it (the fill is driven by --pct) */
.plantSlider::-webkit-slider-runnable-track {
  height: var(--track-h);
  border-radius: 999px;
  border: 1px solid #cfc9bf;
  background: linear-gradient(to right, #a8d65a, var(--green)) 0 / calc(var(--pct) * 1%) 100% no-repeat,
    #e4e0d8;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18);
}

.plantSlider::-moz-range-track {
  height: var(--track-h);
  border-radius: 999px;
  border: 1px solid #cfc9bf;
  background: #e4e0d8;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18);
}

.plantSlider::-moz-range-progress {
  height: var(--track-h);
  border-radius: 999px;
  background: linear-gradient(to right, #a8d65a, var(--green));
}

/* thumb: a little sprout in a green ring */
.plantSlider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: var(--thumb);
  height: var(--thumb);
  margin-top: calc((var(--track-h) - var(--thumb)) / 2 - 1px);
  border-radius: 50%;
  border: 3px solid var(--green);
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 21v-8' stroke='%23558b2f' stroke-width='2' stroke-linecap='round' fill='none'/%3E%3Cpath d='M12 13C12 8 8.5 5.5 4 6c0 4.5 3 7.5 8 7z' fill='%2389c34a'/%3E%3Cpath d='M12 12c0-4 3-7 8-7 0 4.5-3 7.500-8 7z' fill='%23558b2f'/%3E%3C/svg%3E") center / 70% no-repeat;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s var(--transition-bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.plantSlider::-moz-range-thumb {
  box-sizing: border-box;
  width: var(--thumb);
  height: var(--thumb);
  border-radius: 50%;
  border: 3px solid var(--green);
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 21v-8' stroke='%23558b2f' stroke-width='2' stroke-linecap='round' fill='none'/%3E%3Cpath d='M12 13C12 8 8.5 5.5 4 6c0 4.5 3 7.5 8 7z' fill='%2389c34a'/%3E%3Cpath d='M12 12c0-4 3-7 8-7 0 4.5-3 7.500-8 7z' fill='%23558b2f'/%3E%3C/svg%3E") center / 70% no-repeat;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
}

.plantSlider:active::-webkit-slider-thumb,
.plantSlider:focus-visible::-webkit-slider-thumb {
  transform: scale(1.15);
}

/* bubble above the thumb; the maths keeps it centred on the thumb across the whole track */
.bubble {
  position: absolute;
  top: 0;
  left: calc(var(--thumb) / 2 + (100% - var(--thumb)) * var(--pct) / 100);
  transform: translate(-50%, 6px) scale(0.8);
  padding: 0.15rem 0.55rem;
  border-radius: 6px;
  background: var(--green);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.2s var(--transition-bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
}

/* little arrow pointing down at the thumb */
.bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 100%;
  margin-left: -5px;
  border: 5px solid transparent;
  border-top-color: var(--green);
}

.sliderWrap.isSliding .bubble,
.sliderWrap:focus-within .bubble {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .bubble,
  .plantSlider::-webkit-slider-thumb {
    transition: none;
  }
}

/* ---------- date picker: Option 1 native input styling ---------- */
.dateField {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.dateText {
  min-width: 0;
  margin-right: 0.25rem;
}

.styledDate {
  padding: 0.4rem 0.7rem;
  border: 1px solid #d5ded8;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  color: #46584c;
  font: inherit;
  font-weight: 600;
  accent-color: var(--accent, #2f7d4f);
  color-scheme: light;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.25s ease;
}

.styledDate:hover,
.styledDate:focus-visible {
  border-color: var(--accent, #2f7d4f);
  box-shadow: 0 0 0 3px rgba(47, 125, 79, 0.18);
  outline: none;
}

.styledDate::-webkit-calendar-picker-indicator {
  cursor: pointer;
  border-radius: 50%;
  padding: 2px;
  opacity: 0.7;
  filter: invert(35%) sepia(40%) saturate(600%) hue-rotate(95deg);
}

.styledDate::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
  background: rgba(47, 125, 79, 0.12);
}

/* phone layout (map on top, list below): the map is shorter, the list scrolls in its own box */
.requestPanel {
  min-width: 0;
  padding-block: 1rem;
  overflow: hidden;
}

.mapArea {
  height: max(300px, 50vh);
  flex-shrink: 0;
  overflow: hidden;
}

.requests {
  min-width: 0; /* lets the column shrink instead of pushing the page wider */
  padding: 1rem;
  overflow-y: auto;
  max-height: 70vh;
  min-height: 0;
  flex-shrink: 0;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
}

.requests.is-scrollable {
  overscroll-behavior-y: contain;
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
  align-items: center;
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

/* every request card: title, one muted line, then the same small chips */
.cardText {
  min-width: 0;
  flex: 1;
}

.cardText h3 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cardText p {
  margin: 0.1rem 0 0.4rem;
  color: #637466;
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cardChips {
  gap: 0.3rem;
}

.cardChips .chip {
  padding: 0.1rem 0.5rem;
  font-size: 0.72rem;
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
  white-space: nowrap;
  font-size: 0.8rem;
  font-weight: 600;
}

.chipReward {
  background: var(--accent, #2f7d4f);
  border-color: var(--accent, #2f7d4f);
  color: #fff;
}

/* ---------- grouped request (see all requests) ---------- */
.photoStrip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 0.4rem;
}

.photoStrip img {
  width: 100%;
  height: 90px;
  object-fit: cover;
  border-radius: 12px;
}

.groupNote {
  margin: 0 0 0.5rem;
  color: #637466;
  font-size: 0.82rem;
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

/* Care checklist (Carolyn): care steps list */
.stepsTitle {
  margin: 0.35rem 0 0.25rem;
  color: #637466;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.stepsList {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.2rem;
}

.stepsList li::marker {
  color: #34834c;
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

/* ---------- responsive, keep these two blocks at the very bottom ---------- */

/* phones (under 768px): the slider takes the space left beside the text (up to 360px), the date input fills its row */
@media (max-width: 767px) {
  .sliderWrap {
    flex: 1 1 0;
    min-width: 0;
    width: auto;
    max-width: 360px;
  }

  .styledDate {
    flex: 1;
  }
}

/* Stacked layouts need a smaller results window: a few cards should scroll
   inside the list rather than requiring another screenful of page scrolling. */
@media (max-width: 991px) {
  .requests {
    max-height: 40vh;
    max-height: min(40dvh, 20rem);
  }
}

/* laptops (992px and up): map 70% on the left, list 30% on the right, like the original */
@media (min-width: 992px) {
  .mapArea {
    flex: 0 0 70%;
    max-width: 70%;
    height: 70vh;
  }

  .requestPanel {
    flex: 0 0 30%;
    max-width: 30%;
    padding-block: 0;
  }
}
</style>
