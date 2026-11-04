<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import plantPlaceholder from '@/assets/plant.png'
import { getRequestSteps } from '@/utils/careSteps'

const props = defineProps({
  request: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  makeupBusyVisitId: { type: Number, default: 0 },
})
// Emit make-up actions to the view so request creation stays in the parent.
const emit = defineEmits(['cancel-request', 'makeup-request'])
const waterSourceLabels = {
  left_out: 'Water left outside',
  tap_available: 'Tap available',
  sitter_brings: 'Sitter brings water',
}
const plants = computed(() =>
  props.request.plants?.length
    ? props.request.plants
    : props.request.plant
      ? [props.request.plant]
      : [],
)
// what the owner asked for each plant (water amount, instructions), shown under Details
const plantRows = computed(() => (props.request.plantDetails?.length ? props.request.plantDetails : plants.value))
const title = computed(() => plants.value.map((plant) => plant.plantName).filter(Boolean).join(', ') || 'Plant')
const MAX_AVATARS = 3
const visits = computed(() => props.request.visits || [])

function date(value) {
  return new Date(value).toLocaleDateString('en-GB')
}
// "Tue 3": short label for a visit chip, in Singapore time like the server
function chipDate(value) {
  return new Date(value).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Singapore' })
}

// ---------- the visit chips ----------
const VISIT_STATES = {
  open: { label: 'Open', tone: 'open' },
  accepted: { label: '⏳ Accepted', tone: 'accepted' },
  completed: { label: '✅ Done', tone: 'done' },
  missed: { label: '⚠️ Missed', tone: 'missed' },
  expired: { label: 'Expired', tone: 'missed' },
  cancelled: { label: 'Cancelled', tone: 'off' },
  weather_skipped: { label: '🌧️ Skipped', tone: 'rain' },
}
function visitState(visit) {
  // rain was forecast on the visit day, so the sitter may skip it
  if (visit.weatherSkip && ['open', 'accepted'].includes(visit.status)) return { label: '🌧️ May skip', tone: 'rain' }
  return VISIT_STATES[visit.status] || { label: String(visit.status).replace('_', ' '), tone: 'open' }
}

// a red "!" on the chip if a photo from that visit looks unhealthy, a green tick if all checked photos look fine
function healthMark(visit) {
  const checks = (visit.items || []).map((item) => item.health).filter((check) => check?.status === 'completed')
  if (!checks.length) return null
  return checks.some((check) => check.isHealthy === false) ? 'issue' : 'ok'
}

// with a long request, fold the earliest visits away so the row stays short
const MAX_CHIPS = 10
const showEarlier = ref(false)
const hiddenCount = computed(() => (showEarlier.value ? 0 : Math.max(0, visits.value.length - MAX_CHIPS)))
const chipVisits = computed(() => visits.value.slice(hiddenCount.value))

// ---------- details ----------
const open = ref(false)

function visitPlants(visit) {
  return visit.plants?.map((plant) => plant.plantName).join(', ') || visit.plant?.plantName || 'Plant'
}

// Care checklist (Carolyn): how many care steps the sitter ticked on a finished visit,
// e.g. "3/5 steps", or '' if the plant has no care steps or the visit isn't done yet
function stepsSummary(item) {
  const total = getRequestSteps(item).length
  if (total === 0 || item.status !== 'completed') return ''
  return `${(item.completedSteps || []).length}/${total} steps`
}

function healthLine(item) {
  const check = item.health
  if (!check) return ''
  const name = item.plant?.plantName || 'Plant'
  if (check.status === 'failed') return `${name}: the health check could not run for this photo`
  if (check.isHealthy === false) return `${name}: possible ${check.issues?.[0]?.name || 'issue'}`
  return `${name}: looks healthy`
}
</script>

<template>
  <article class="request-card" :class="`is-${request.status}`">
    <div class="top">
      <div v-if="plants.length" class="stack" aria-hidden="true">
        <img
          v-for="plant in plants.slice(0, MAX_AVATARS)"
          :key="plant.plantId"
          :src="plant.photoUrl || plantPlaceholder"
          alt=""
          @error="$event.target.src = plantPlaceholder"
        />
        <span v-if="plants.length > MAX_AVATARS" class="more">+{{ plants.length - MAX_AVATARS }}</span>
      </div>
      <div class="heading">
        <h3>Request #{{ request.requestId }} · {{ title }}</h3>
        <div class="meta">
          {{ date(request.startDate) }} – {{ date(request.endDate) }} · {{ request.tokenReward }} tokens per visit ·
          💧 {{ waterSourceLabels[request.waterSource] || 'Tap available' }}
          <template v-if="request.healthCheck"> · 🌿 Health check on</template>
        </div>
      </div>
      <span class="status">{{ request.status.replace('_', ' ') }}</span>
    </div>

    <p v-if="request.note" class="note">{{ request.note }}</p>

    <!-- one chip per visit; click a chip for that visit's page -->
    <ul v-if="visits.length" class="timeline" aria-label="Visits">
      <li v-if="hiddenCount" class="earlier">
        <button type="button" class="chip off" @click="showEarlier = true">+{{ hiddenCount }} earlier</button>
      </li>
      <li v-for="visit in chipVisits" :key="visit.visitId">
        <RouterLink
          class="chip"
          :class="visitState(visit).tone"
          :to="{ name: 'visit-detail', params: { visitId: visit.visitId } }"
          :title="`Visit on ${date(visit.visitDate)}. Open its details`"
        >
          {{ chipDate(visit.visitDate) }} · {{ visitState(visit).label }}
          <span
            v-if="healthMark(visit)"
            class="hmark"
            :class="healthMark(visit)"
            :aria-label="healthMark(visit) === 'issue' ? 'A plant may be unhealthy' : 'Plants look healthy'"
          >{{ healthMark(visit) === 'issue' ? '!' : '✓' }}</span>
        </RouterLink>
        <!-- Offer an owner a manual replacement after a visit expires or is missed. -->
        <button
          v-if="['missed', 'expired'].includes(visit.status) && !visit.makeupRequestId"
          type="button"
          class="makeup-button"
          :disabled="makeupBusyVisitId === visit.visitId"
          @click="emit('makeup-request', { request, visit })"
        >
          {{ makeupBusyVisitId === visit.visitId ? 'Creating…' : 'Request make-up visit' }}
        </button>
        <span v-else-if="visit.makeupRequestId" class="makeup-created">Make-up requested</span>
      </li>
    </ul>

    <div class="foot">
      <button
        v-if="['open', 'in_progress'].includes(request.status)"
        type="button"
        class="btn btn-outline-secondary btn-sm"
        :disabled="busy"
        @click="emit('cancel-request', request)"
      >
        {{ busy ? 'Cancelling…' : 'Cancel request' }}
      </button>
      <button type="button" class="details-toggle" :aria-expanded="open" @click="open = !open">
        Details <span class="chev" :class="{ open }">▸</span>
      </button>
    </div>

    <div v-if="open" class="details">
      <h4>Plants</h4>
      <ul class="plant-list">
        <li v-for="plant in plantRows" :key="plant.plantId">
          <img :src="plant.photoUrl || plantPlaceholder" :alt="plant.plantName" @error="$event.target.src = plantPlaceholder" />
          <div>
            <strong>{{ plant.plantName }}</strong>
            <small>Water {{ plant.amountToWater ?? 0 }} ml</small>
            <small v-if="plant.careInstructions">{{ plant.careInstructions }}</small>
          </div>
        </li>
      </ul>

      <template v-if="visits.length">
        <h4>Visits</h4>
        <ul class="visit-list">
          <li v-for="visit in visits" :key="visit.visitId">
            <RouterLink :to="{ name: 'visit-detail', params: { visitId: visit.visitId } }">{{ date(visit.visitDate) }}</RouterLink>
            · {{ visitPlants(visit) }} · {{ String(visit.status).replace('_', ' ') }}
            <span v-for="item in visit.items || []" :key="item.requestItemId" class="extra">
              <a v-if="item.proofUrl" :href="item.proofUrl" target="_blank" rel="noopener noreferrer">{{ item.plant?.plantName || 'Plant' }} proof</a>
              <!-- Care checklist (Carolyn) -->
              <small v-if="stepsSummary(item)" class="steps-done"> ({{ stepsSummary(item) }})</small>
              <small v-if="healthLine(item)" class="health-line" :class="{ issue: item.health?.isHealthy === false }">🌿 {{ healthLine(item) }}</small>
            </span>
          </li>
        </ul>
      </template>
    </div>
  </article>
</template>

<style scoped>
.request-card {
  --tone: #93b99a;
  padding: 1rem 1.1rem;
  margin: 0 0 0.9rem;
  border: 1px solid #e2e8e2;
  border-left: 5px solid var(--tone);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 4px 14px #183c2410;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.request-card:hover { transform: translateY(-2px); box-shadow: 0 7px 18px #183c2417; }
.is-funding { --tone: #6c757d; }
.is-open { --tone: #0aa2c0; }
.is-in_progress { --tone: #d19a00; }
.is-completed { --tone: #198754; }
.is-cancelled { --tone: #6c757d; }

.top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; }
.stack { display: flex; align-items: center; }
.stack img, .stack .more { width: 44px; height: 44px; margin-left: -12px; border: 3px solid #fff; border-radius: 50%; object-fit: cover; background: #e8f3e9; }
.stack img:first-child { margin-left: 0; }
.stack .more { display: grid; place-items: center; font-size: 0.75rem; font-weight: 700; color: #245b34; }
.heading { flex: 1; min-width: 220px; }
.heading h3 { margin: 0; font-size: 1.05rem; font-weight: 700; }
.meta { margin-top: 0.2rem; color: #59665c; font-size: 0.88rem; }
.status { padding: 0.15rem 0.7rem; border-radius: 999px; background: #e8f3e9; color: #2d6740; font-size: 0.8rem; font-weight: 700; text-transform: capitalize; }
.is-open .status { background: #d8f3f9; color: #07657a; }
.is-in_progress .status { background: #fff3cf; color: #7a5a00; }
.is-cancelled .status, .is-funding .status { background: #eceeed; color: #4d5650; }
.note { margin: 0.6rem 0 0; color: #59665c; font-size: 0.9rem; }

/* ---------- visit chips ---------- */
.timeline { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.9rem 0 0.25rem; padding: 0; list-style: none; }
.timeline li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid #e2e8e2;
  border-radius: 10px;
  background: #f1f6f1;
  color: #34463a;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.chip:hover { filter: brightness(0.97); }
.chip:focus-visible, .details-toggle:focus-visible, .makeup-button:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }
.chip.open { background: #e4f6fa; border-color: #b3e3ee; color: #07657a; }
.chip.accepted { background: #fff6dd; border-color: #f0dc9a; color: #7a5a00; }
.chip.done { background: #e6f5ea; border-color: #b8dfc0; color: #14532d; }
.chip.missed { background: #fde8ea; border-color: #f3b5bc; color: #a3212f; }
.chip.rain { background: #e4f6fa; border: 1px dashed #8ad4e4; color: #07657a; }
.chip.off { background: #eceeed; color: #6c757d; }
.hmark { position: absolute; top: -8px; right: -8px; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; color: #fff; font-size: 0.7rem; font-weight: 700; box-shadow: 0 0 0 2px #fff; }
.hmark.issue { background: #dc3545; }
.hmark.ok { background: #198754; }
.makeup-button { padding: 0.25rem 0.6rem; border: 1px solid #c28b00; border-radius: 8px; background: #fff9e6; color: #8a6200; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.makeup-button:disabled { opacity: 0.6; cursor: default; }
.makeup-created { color: #2d6740; font-size: 0.82rem; }

/* ---------- footer and details ---------- */
.foot { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px dashed #e2e8e2; }
.details-toggle { margin-left: auto; padding: 0.2rem 0.3rem; border: 0; background: none; color: #59665c; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.chev { display: inline-block; transition: transform 0.2s ease; }
.chev.open { transform: rotate(90deg); }
.details { margin-top: 0.8rem; color: #59665c; font-size: 0.9rem; }
.details h4 { margin: 0.6rem 0 0.4rem; color: #1f2d24; font-size: 0.9rem; }
.plant-list, .visit-list { margin: 0; padding: 0; list-style: none; }
.plant-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.plant-list li { display: flex; align-items: center; gap: 0.5rem; max-width: 240px; padding: 0.35rem 0.6rem 0.35rem 0.3rem; border-radius: 12px; background: #f1f6f1; color: #34463a; }
.plant-list img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.plant-list div { min-width: 0; }
.plant-list strong, .plant-list small { display: block; overflow: hidden; text-overflow: ellipsis; }
.visit-list li + li { margin-top: 0.4rem; }
.extra { margin-left: 0.4rem; }
.health-line { display: block; margin-left: 0.2rem; color: #198754; }
.health-line.issue { color: #a3212f; }

@media (prefers-reduced-motion: reduce) {
  .request-card, .chev { transition: none; }
  .request-card:hover { transform: none; }
}
</style>
