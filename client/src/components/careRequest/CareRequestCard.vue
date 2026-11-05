<script setup>
// Component: summarizes one owner request and opens its visit/plant details on demand.
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import plantPlaceholder from '@/assets/plant.png'
import { getRequestSteps } from '@/utils/careSteps'
// (Carolyn) Fix 5: shared date / token / water / status wording for all visit cards.
// chipDate = "Tue 3", date = "03/11/2026", both in Singapore time like the server
import {
  formatDate as date,
  formatDateRange,
  formatShortDate as chipDate,
  statusLabel,
  tokenText,
  waterSourceLabel,
} from '@/utils/visitFormat'

const props = defineProps({
  request: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  makeupBusyVisitId: { type: Number, default: 0 },
  // true when a notification linked to this request (?requestId=…), so the card gets a green ring
  highlighted: { type: Boolean, default: false },
})
// Emit make-up actions to the view so request creation stays in the parent.
const emit = defineEmits(['cancel-request', 'makeup-request'])
// Normalize the multi-plant response and older single-plant response for display.
const plants = computed(() =>
  props.request.plants?.length
    ? props.request.plants
    : props.request.plant
      ? [props.request.plant]
      : [],
)
// what the owner asked for each plant (water amount, instructions), shown under Details
const plantRows = computed(() =>
  (props.request.plantDetails?.length ? props.request.plantDetails : plants.value)
    .map((plant) => ({ ...plant, careSteps: getRequestSteps(plant) })),
)
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
// Explain the next open or accepted visit in the card's progress summary.
const nextVisitText = computed(() => {
  if (!nextVisit.value) return ''
  const who = nextVisit.value.status === 'accepted' ? 'sitter found' : 'waiting for a sitter'
  return `${chipDate(nextVisit.value.visitDate)} · ${who}`
})

// (Carolyn) Cancel asks first (it used to cancel straight away on one click)
const confirmingCancel = ref(false)
function confirmCancel() {
  if (props.busy) return
  confirmingCancel.value = false
  emit('cancel-request', props.request)
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
// Convert each backend visit status into the card's label and color tone.
function visitState(visit) {
  // rain was forecast on the visit day, so the sitter may skip it
  if (visit.weatherSkip && ['open', 'accepted'].includes(visit.status)) return { label: '🌧️ May skip', tone: 'rain' }
  return VISIT_STATES[visit.status] || { label: statusLabel(visit.status), tone: 'open' }
}

// (Carolyn) card only shows missed visits (they need a make-up); the modal lists every visit
const missedVisits = computed(() => visits.value.filter((visit) => visit.status === 'missed'))

// ---------- details ----------
const open = ref(false)

// Build the plant-name summary shown for one visit in the details modal.
function visitPlants(visit) {
  return visit.plants?.map((plant) => plant.plantName).join(', ') || visit.plant?.plantName || 'Unnamed plant'
}

// Care checklist (Carolyn): how many care steps the sitter ticked on a finished visit,
// e.g. "3/5 steps", or '' if the plant has no care steps or the visit isn't done yet
function stepsSummary(item) {
  const total = getRequestSteps(item).length
  if (total === 0 || item.status !== 'completed') return ''
  return `${(item.completedSteps || []).length}/${total} steps`
}

// Turn a stored photo health result into a short owner-facing status line.
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
  <!-- the id lets My Requests scroll to this card from a notification -->
  <article
    :id="`care-request-${request.requestId}`"
    class="request-card"
    :class="[`is-${request.status}`, { 'notification-target': highlighted }]"
  >
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
      <span class="status">{{ statusLabel(request.status) }}</span>
    </div>

    <!-- (Carolyn) one quiet line of key facts; water, health check and note are in View details -->
    <p class="meta">
      <span>🗓️ {{ formatDateRange(request.startDate, request.endDate) }}</span>
      <span v-if="request.tokenReward">🪙 {{ tokenText(request.tokenReward) }} / visit</span>
    </p>

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

    <!-- (Carolyn) only missed visits stay on the card, because the owner needs to act on them;
         all other visits are listed in View details -->
    <ul v-if="missedVisits.length" class="timeline" aria-label="Missed visits">
      <li v-for="visit in missedVisits" :key="visit.visitId">
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
          v-if="!visit.makeupRequestId"
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

    <!-- (Carolyn) details is the main button; cancel is a small quiet link on the right -->
    <div class="foot">
      <button type="button" class="details-toggle" @click="open = true">View details</button>
      <button
        v-if="['open', 'in_progress'].includes(request.status)"
        type="button"
        class="cancel-link"
        :disabled="busy"
        @click="confirmingCancel = true"
      >
        {{ busy ? 'Cancelling…' : 'Cancel request' }}
      </button>
    </div>

    <Teleport to="body">
    <div v-if="open" class="modal-backdrop" role="presentation" @click.self="open = false">
      <section class="details-modal" role="dialog" aria-modal="true" :aria-label="`Details for request ${request.requestId}`" @keydown.esc="open = false">
        <!-- (Carolyn) Fix 3: plant names as title, summary chips, big plant cards with
             a care checklist, and visits as simple rows -->
        <div class="modal-heading">
          <div>
            <h3>{{ title }}</h3>
            <small class="request-no">Request #{{ request.requestId }} · <span class="status">{{ statusLabel(request.status) }}</span></small>
          </div>
          <button type="button" class="modal-close" aria-label="Close details" @click="open = false">×</button>
        </div>
        <div class="details">
          <ul class="facts">
            <li>🗓️ {{ formatDateRange(request.startDate, request.endDate) }}</li>
            <li v-if="request.tokenReward">
              🪙 {{ tokenText(request.tokenReward) }} / visit
            </li>
            <li>💧 {{ waterSourceLabel(request.waterSource) }}</li>
            <li v-if="request.healthCheck">🌿 Health check on</li>
          </ul>
          <p v-if="request.note" class="owner-note"><strong>Your note:</strong> {{ request.note }}</p>

          <h4>Plants</h4>
          <ul class="plant-grid">
            <li v-for="plant in plantRows" :key="plant.plantId" class="plant-card">
              <img
                :src="plant.photoUrl || plantPlaceholder"
                :alt="plant.plantName || 'Plant photo'"
                @error="$event.target.src = plantPlaceholder"
              />
              <div class="plant-card-body">
                <strong>{{ plant.plantName || 'Unnamed plant' }}</strong>
                <span class="water-amount">💧 {{ plant.amountToWater ?? 0 }} ml {{ nextVisit ? 'per upcoming visit' : 'per visit' }}</span>
                <small v-if="nextVisit" class="no-steps">{{ plant.usePlantAmount ? 'Follows plant’s watering amount' : 'Custom amount for this request' }}</small>
                <!-- Care instructions as a checklist (one line = one step) -->
                <ul v-if="plant.careSteps.length" class="care-steps" aria-label="Care steps">
                  <li v-for="step in plant.careSteps" :key="step">
                    <span class="tick" aria-hidden="true">✓</span>{{ step }}
                  </li>
                </ul>
                <span v-else class="no-steps">No care instructions</span>
              </div>
            </li>
          </ul>

          <template v-if="visits.length">
            <h4>Visits <small>({{ doneCount }} of {{ visits.length }} done)</small></h4>
            <ul class="visit-rows">
              <li v-for="visit in visits" :key="visit.visitId" class="visit-row">
                <div class="visit-row-main">
                  <!-- (Carolyn) this link stretches over the whole row (see .visit-row-link::after),
                       so clicking anywhere on the row opens /care-visits/:visitId -->
                  <RouterLink
                    class="visit-date-button visit-row-link"
                    :to="{ name: 'visit-detail', params: { visitId: visit.visitId } }"
                    :aria-label="`Open visit on ${date(visit.visitDate)}`"
                  >
                    {{ chipDate(visit.visitDate) }}
                  </RouterLink>
                  <span class="visit-plants">{{ visitPlants(visit) }}</span>
                  <span class="chip" :class="visitState(visit).tone">{{ visitState(visit).label }}</span>
                </div>
                <!-- Proof photos, ticked steps and health results, only when there are any -->
                <div v-if="(visit.items || []).some((item) => item.proofUrl || stepsSummary(item) || healthLine(item))" class="visit-row-extra">
                  <span v-for="item in visit.items || []" :key="item.requestItemId">
                    <a v-if="item.proofUrl" :href="item.proofUrl" target="_blank" rel="noopener noreferrer">📷 {{ item.plant?.plantName || 'Plant' }} proof</a>
                    <!-- Care checklist (Carolyn) -->
                    <small v-if="stepsSummary(item)" class="steps-done"> ({{ stepsSummary(item) }})</small>
                    <small v-if="healthLine(item)" class="health-line" :class="{ issue: item.health?.isHealthy === false }">🌿 {{ healthLine(item) }}</small>
                  </span>
                </div>
              </li>
            </ul>
          </template>
        </div>
      </section>
    </div>
    </Teleport>
  <ConfirmDialog
    :open="confirmingCancel"
    title="Cancel request?"
    :message="`Cancel the request for ${title}? Visits not done yet will be cancelled.`"
    confirm-label="Cancel request"
    :busy="busy"
    busy-label="Cancelling..."
    @confirm="confirmCancel"
    @cancel="confirmingCancel = false"
  />
  </article>
</template>

<style scoped>
.request-card {
  --tone: #93b99a;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  align-self: stretch; /* (Carolyn) same height as the other cards in the row, buttons line up */
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
.request-card.notification-target { border-color: var(--primary, #14804a); box-shadow: 0 0 0 3px #14804a40, 0 7px 18px #183c2417; }
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
/* min-width: the status badge wraps to the next line before the name gets squeezed letter by letter */
.heading { flex: 1; min-width: 7.5rem; }
.heading h3 { margin: 0; font-size: 1.05rem; font-weight: 700; overflow-wrap: break-word; }
/* (Carolyn) request number, fact chips, progress, quiet cancel */
.request-no { color: #68766b; font-size: 0.8rem; }
/* (Carolyn) parts keep their size; extra height goes above the buttons (.foot margin-top: auto) */
.request-card > * { flex-shrink: 0; }
.meta { display: flex; flex-wrap: wrap; gap: 0.15rem 0.6rem; margin: 0.6rem 0 0; color: #59665c; font-size: 0.85rem; }
.meta span { white-space: nowrap; }
.progress-row { margin-bottom: 0.9rem; } /* gap above the dashed line on the tallest card */
.facts { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.75rem 0 0; padding: 0; list-style: none; }
.facts li { padding: 0.2rem 0.6rem; border-radius: 999px; background: #f0f6f1; color: #34463a; font-size: 0.82rem; }
.progress-row { display: grid; gap: 0.35rem; margin-top: 0.75rem; }
.progress-text { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.25rem 0.75rem; font-size: 0.85rem; color: #59665c; }
.progress-text strong { color: #245b34; }
.progress-bar-track { height: 6px; overflow: hidden; border-radius: 999px; background: #e3ece5; }
.progress-bar-fill { height: 100%; border-radius: 999px; background: var(--primary, #14804a); transition: width 0.3s ease; }
/* (Carolyn) Cancel as a small pill button, same shape as "View details" but quiet red outline */
.cancel-link { padding: 0.45rem 0.9rem; border: 1px solid #e7c3bd; border-radius: 999px; background: #fff; color: #a22f17; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background-color 0.15s, color 0.15s; }
.cancel-link:hover:not(:disabled) { border-color: var(--danger, #a22f17); background: var(--danger-soft, #fbe6df); }
.cancel-link:disabled { opacity: 0.6; cursor: default; }
.cancel-link:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }
.status { padding: 0.15rem 0.7rem; border-radius: 999px; background: #e8f3e9; color: #2d6740; font-size: 0.8rem; font-weight: 700; text-transform: capitalize; }
.is-open .status { background: #d8f3f9; color: #07657a; }
.is-in_progress .status { background: #fff3cf; color: #7a5a00; }
.is-cancelled .status, .is-funding .status { background: #eceeed; color: #4d5650; }
.note { display: -webkit-box; overflow: hidden; margin: 0.6rem 0 0; color: #59665c; font-size: 0.9rem; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }

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
.details-modal { width: min(960px, 100%); max-height: min(85vh, 800px); overflow: auto; padding: 1.25rem; border: 1px solid #e2e8e2; border-radius: 16px; background: #fff; box-shadow: 0 22px 70px #10231b50; }
.modal-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: 0.7rem; border-bottom: 1px solid #e7ece7; }
.modal-heading h3 { margin: 0; color: #245b34; }
.modal-close { display: grid; flex: 0 0 2rem; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 0; border-radius: 50%; background: #eef4ef; color: #34463a; font-size: 1.4rem; line-height: 1; cursor: pointer; }
.visit-date-button { display: inline-block; padding: 0.25rem 0.55rem; border: 1px solid #d3e3d6; border-radius: 8px; background: #f1f7f2; color: #245b34; text-decoration: none; font-weight: 600; }
.visit-date-button:hover { background: #e3f0e5; }
.details h4 { margin: 0.6rem 0 0.4rem; color: #1f2d24; font-size: 0.9rem; }
/* (Carolyn) Fix 3: request details pop-up */
.details h4 small { color: #68766b; font-weight: 400; }
.owner-note { margin: 0.75rem 0 0; padding: 0.6rem 0.8rem; border-radius: 10px; background: #f7faf7; color: #34463a; overflow-wrap: anywhere; }
.plant-grid, .visit-rows, .care-steps { margin: 0; padding: 0; list-style: none; }
/* Plant cards fill the pop-up width: 2 per row on wide screens, 1 on phones */
.plant-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 0.75rem; }
.plant-card { display: flex; gap: 0.85rem; padding: 0.75rem; border: 1px solid #e2e8e2; border-radius: 14px; background: #fbfdfb; }
.plant-card img { flex-shrink: 0; width: 96px; height: 96px; border-radius: 12px; object-fit: cover; }
.plant-card-body { display: grid; align-content: start; gap: 0.35rem; min-width: 0; }
.plant-card-body strong { color: #1f2d24; font-size: 1rem; overflow-wrap: anywhere; }
.water-amount { color: #1d4f7a; font-size: 0.85rem; }
.care-steps { display: grid; gap: 0.25rem; }
.care-steps li { display: flex; align-items: flex-start; gap: 0.4rem; color: #34463a; font-size: 0.85rem; overflow-wrap: anywhere; }
.tick { flex-shrink: 0; display: grid; place-items: center; width: 1rem; height: 1rem; margin-top: 0.15rem; border-radius: 4px; background: #e3f1e6; color: #245b34; font-size: 0.7rem; font-weight: 700; }
.no-steps { color: #68766b; font-size: 0.85rem; font-style: italic; }
/* Visits: one simple row each, extras on a second line */
.visit-rows { display: grid; gap: 0.4rem; }
/* position: relative = the stretched link below covers only this row */
.visit-row { position: relative; padding: 0.5rem 0.65rem; border: 1px solid #edf1ed; border-radius: 10px; transition: background-color 0.15s, border-color 0.15s; }
.visit-row:hover { border-color: #b9d6c1; background: #f7fbf8; }
/* Invisible layer over the whole row, so any click opens the visit page */
.visit-row-link::after { content: ''; position: absolute; inset: 0; border-radius: 10px; }
.visit-row:has(.visit-row-link:focus-visible) { outline: 2px solid #16a34a; outline-offset: 2px; }
.visit-row-link:focus-visible { outline: none; }
/* Proof links sit above that layer, so they still open the photo */
.visit-row-extra a { position: relative; z-index: 1; }
.visit-row-main { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.visit-plants { flex: 1; min-width: 8rem; color: #34463a; overflow-wrap: anywhere; }
/* static: the chip must not sit above the row's link layer, or clicking "Open" does nothing */
.visit-row .chip { position: static; cursor: pointer; }
.visit-row-extra { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; margin-top: 0.35rem; font-size: 0.85rem; }
.health-line { display: block; margin-left: 0.2rem; color: #198754; }
.health-line.issue { color: #a3212f; }

@media (prefers-reduced-motion: reduce) {
  .request-card { transition: none; }
  .request-card:hover { transform: none; }
}
</style>
