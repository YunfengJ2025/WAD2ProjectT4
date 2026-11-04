<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import plantPlaceholder from '@/assets/plant.png'
import { getRequestSteps } from '@/utils/careSteps'

const props = defineProps({
  request: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  makeupBusyVisitId: { type: Number, default: 0 },
  highlighted: { type: Boolean, default: false },
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
const title = computed(
  () =>
    plants.value.map((plant) => plant.plantName).filter(Boolean).join(', ') ||
    `${plants.value.length || 1} unnamed plant${plants.value.length > 1 ? 's' : ''}`,
)
const MAX_AVATARS = 3
const visits = computed(() => props.request.visits || [])

// () Progress: "2 of 5 visits done" (+ the bar), and the next visit still to come
const doneCount = computed(() => visits.value.filter((visit) => visit.status === 'completed').length)
const donePercent = computed(() =>
  visits.value.length ? Math.round((doneCount.value / visits.value.length) * 100) : 0,
)
const nextVisit = computed(() =>
  visits.value
    .filter((visit) => ['open', 'accepted'].includes(visit.status))
    .sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate))[0],
)
const nextVisitText = computed(() => {
  if (!nextVisit.value) return ''
  const who = nextVisit.value.status === 'accepted' ? 'sitter found' : 'waiting for a sitter'
  return `${chipDate(nextVisit.value.visitDate)} · ${who}`
})

// (Ca Cancel asks first (it used to cancel straight away on one click)
function askCancel() {
  if (window.confirm(`Cancel the request for ${title.value}? Visits not done yet will be cancelled.`)) {
    emit('cancel-request', props.request)
  }
}

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

// Keep the card compact; the modal lists all remaining visits.
const MAX_CHIPS = 3
const hiddenCount = computed(() => Math.max(0, visits.value.length - MAX_CHIPS))
const chipVisits = computed(() => visits.value.slice(0, MAX_CHIPS))

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
      <!-- (Carolyn) plant names first; request number moved to small text -->
      <div class="heading">
        <h3>{{ title }}</h3>
        <small class="request-no">Request #{{ request.requestId }}</small>
      </div>
      <span class="status">{{ request.status.replace('_', ' ') }}</span>
    </div>

    <!-- (Carolyn) key details as chips that wrap (no more cut-off text) -->
    <ul class="facts">
      <li>🗓️ {{ date(request.startDate) }} – {{ date(request.endDate) }}</li>
      <li v-if="request.tokenReward">
        🪙 {{ request.tokenReward }} token{{ request.tokenReward === 1 ? '' : 's' }} / visit
      </li>
      <li>💧 {{ waterSourceLabels[request.waterSource] || 'Tap available' }}</li>
      <li v-if="request.healthCheck">🌿 Health check on</li>
    </ul>

    <!-- (Carolyn) visit progress + next visit -->
    <div v-if="visits.length" class="progress-row">
      <div class="progress-text">
        <strong
          >{{ doneCount }} of {{ visits.length }} visit{{ visits.length === 1 ? '' : 's' }} done</strong
        >
        <span v-if="nextVisitText">Next: {{ nextVisitText }}</span>
      </div>
      <div
        class="progress-bar-track"
        role="progressbar"
        :aria-valuenow="donePercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`${doneCount} of ${visits.length} visits done`"
      >
        <div class="progress-bar-fill" :style="{ width: donePercent + '%' }"></div>
      </div>
    </div>

    <p v-if="request.note" class="note" :title="request.note">{{ request.note }}</p>

    <!-- one chip per visit; click a chip for that visit's page -->
    <ul v-if="visits.length" class="timeline" aria-label="Visits">
      <li v-for="visit in chipVisits" :key="visit.visitId">
        <RouterLink
          class="chip"
          :class="visitState(visit).tone"
          :to="{ name: 'visit-detail', params: { visitId: visit.visitId } }"
          :title="`Visit on ${date(visit.visitDate)}. Open its details`"
        >
          {{ chipDate(visit.visitDate) }} · {{ visitState(visit).label }}
        </RouterLink>
        <!-- Offer an owner a manual replacement after a visit expires or is missed. -->
        <button
          v-if="visit.status === 'missed' && !visit.makeupRequestId"
          type="button"
          class="makeup-button"
          :disabled="makeupBusyVisitId === visit.visitId"
          @click="emit('makeup-request', { request, visit })"
        >
          {{ makeupBusyVisitId === visit.visitId ? 'Creating…' : 'Request make-up visit' }}
        </button>
        <span v-else-if="visit.makeupRequestId" class="makeup-created">Make-up requested</span>
      </li>
      <li v-if="hiddenCount" class="earlier">
        <button type="button" class="chip off" @click="open = true">+{{ hiddenCount }} more</button>
      </li>
    </ul>

    <!-- (Carolyn) details is the main button; cancel is a small quiet link on the right -->
    <div class="foot">
      <button type="button" class="details-toggle" @click="open = true">View details</button>
      <button
        v-if="['open', 'in_progress'].includes(request.status)"
        type="button"
        class="cancel-link"
        :disabled="busy"
        @click="askCancel"
      >
        {{ busy ? 'Cancelling…' : 'Cancel request' }}
      </button>
    </div>

    <Teleport to="body">
    <div v-if="open" class="modal-backdrop" role="presentation" @click.self="open = false">
      <section class="details-modal" role="dialog" aria-modal="true" :aria-label="`Details for request ${request.requestId}`" @keydown.esc="open = false">
        <div class="modal-heading">
          <h3>Request #{{ request.requestId }} details</h3>
          <button type="button" class="modal-close" aria-label="Close details" @click="open = false">×</button>
        </div>
        <div class="details">
      <p><strong>Dates:</strong> {{ date(request.startDate) }} – {{ date(request.endDate) }}</p>
      <p><strong>Reward:</strong> {{ request.tokenReward }} tokens per visit</p>
      <p><strong>Water source:</strong> {{ waterSourceLabels[request.waterSource] || 'Tap available' }}</p>
      <p v-if="request.note"><strong>Note:</strong> {{ request.note }}</p>
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
            <RouterLink class="visit-date-button" :to="{ name: 'visit-detail', params: { visitId: visit.visitId } }">{{ date(visit.visitDate) }}</RouterLink>
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
      </section>
    </div>
    </Teleport>
  </article>
</template>

<style scoped>
.request-card {
  --tone: #93b99a;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  min-height: 320px; /* (Carolyn) was height: 320px; grows instead of cutting off */
  padding: 1rem 1.1rem;
  margin: 0 0 0.9rem;
  border: 1px solid #e2e8e2;
  border-top: 5px solid var(--tone);
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
.heading { flex: 1; min-width: 0; }
.heading h3 { margin: 0; font-size: 1.05rem; font-weight: 700; overflow-wrap: anywhere; }
/* (Carolyn) request number, fact chips, progress, quiet cancel */
.request-no { color: #68766b; font-size: 0.8rem; }
.facts { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0 0; padding: 0; list-style: none; }
.facts li { padding: 0.2rem 0.6rem; border-radius: 999px; background: #f0f6f1; color: #34463a; font-size: 0.82rem; }
.progress-row { display: grid; gap: 0.35rem; margin-top: 0.75rem; }
.progress-text { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.25rem 0.75rem; font-size: 0.85rem; color: #59665c; }
.progress-text strong { color: #245b34; }
.progress-bar-track { height: 6px; overflow: hidden; border-radius: 999px; background: #e3ece5; }
.progress-bar-fill { height: 100%; border-radius: 999px; background: var(--primary, #14804a); transition: width 0.3s ease; }
.cancel-link { padding: 0.3rem 0.4rem; border: 0; background: transparent; color: #8a5a55; font-size: 0.82rem; text-decoration: underline; cursor: pointer; }
.cancel-link:hover:not(:disabled) { color: var(--danger, #a22f17); }
.cancel-link:disabled { opacity: 0.6; cursor: default; }
.cancel-link:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }
.status { padding: 0.15rem 0.7rem; border-radius: 999px; background: #e8f3e9; color: #2d6740; font-size: 0.8rem; font-weight: 700; text-transform: capitalize; }
.is-open .status { background: #d8f3f9; color: #07657a; }
.is-in_progress .status { background: #fff3cf; color: #7a5a00; }
.is-cancelled .status, .is-funding .status { background: #eceeed; color: #4d5650; }
.note { display: -webkit-box; overflow: hidden; margin: 0.6rem 0 0; color: #59665c; font-size: 0.9rem; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

/* ---------- visit chips ---------- */
/* no max-height/overflow: hidden, so make-up buttons can't get cut off */
.timeline { display: flex; flex-wrap: wrap; align-content: flex-start; min-height: 2.2rem; gap: 0.5rem; margin: 0.9rem 0 0.25rem; padding: 0; list-style: none; }
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
.makeup-button { padding: 0.25rem 0.6rem; border: 1px solid #c28b00; border-radius: 8px; background: #fff9e6; color: #8a6200; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.makeup-button:disabled { opacity: 0.6; cursor: default; }
.makeup-created { color: #2d6740; font-size: 0.82rem; }

/* ---------- footer and details ---------- */
.foot { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-top: auto; padding-top: 0.8rem; border-top: 1px dashed #e2e8e2; }
.details-toggle { padding: 0.45rem 0.9rem; border: 1px solid #b9d6c1; border-radius: 999px; background: #f4f8f4; color: #245b34; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.details-toggle:hover { background: #e6f1e8; }
.details { margin-top: 0.8rem; color: #59665c; font-size: 0.9rem; }
.modal-backdrop { position: fixed; z-index: 1050; inset: 0; display: grid; place-items: center; padding: 1rem; background: #10231bb3; }
.details-modal { width: min(720px, 100%); max-height: min(85vh, 800px); overflow: auto; padding: 1.25rem; border: 1px solid #e2e8e2; border-radius: 16px; background: #fff; box-shadow: 0 22px 70px #10231b50; }
.modal-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: 0.7rem; border-bottom: 1px solid #e7ece7; }
.modal-heading h3 { margin: 0; color: #245b34; }
.modal-close { display: grid; flex: 0 0 2rem; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 0; border-radius: 50%; background: #eef4ef; color: #34463a; font-size: 1.4rem; line-height: 1; cursor: pointer; }
.visit-date-button { display: inline-block; padding: 0.25rem 0.55rem; border: 1px solid #d3e3d6; border-radius: 8px; background: #f1f7f2; color: #245b34; text-decoration: none; font-weight: 600; }
.visit-date-button:hover { background: #e3f0e5; }
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
  .request-card { transition: none; }
  .request-card:hover { transform: none; }
}
</style>
