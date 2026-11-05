<script setup>
// Component: shows a compact visit-history summary and a detailed proof/reward pop-up.
import plantPlaceholder from '@/assets/plant.png'
import { computed, ref } from 'vue'
import { useScrollLock } from '@/composables/useScrollLock'
import { getRequestSteps } from '@/utils/careSteps'
// (Carolyn) Fix 5: shared date / token / status wording for all visit cards.
// formatLongDate = "Tue, 10 Nov 2026" in Singapore time (no meaningless 08:00:00)
import { formatLongDate as date, statusIcon, statusLabel, tokenText } from '@/utils/visitFormat'
const props = defineProps({
  visit: { type: Object, required: true },
  paid: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
// Normalize visits from both multi-plant and older single-plant responses.
const plants = computed(() => props.visit.plants?.length ? props.visit.plants : (props.visit.plant ? [props.visit.plant] : []))
const emit = defineEmits(['claim-reward'])
const detailsOpen = ref(false)
useScrollLock(detailsOpen) // the page behind the pop-up can't scroll while it's open

// (Carolyn) Fix 4: pop-up summary
const plantNames = computed(
  () => plants.value.map((plant) => plant.plantName).filter(Boolean).join(', ') || 'Unnamed plant',
)
const tokens = computed(() => props.visit.request?.tokenReward)
// "Plant care" (server default) and "Care done" (blank note) aren't real notes, so hide them
function sitterNote(item) {
  const text = String(item.action || '').trim()
  return ['Plant care', 'Care done'].includes(text) ? '' : text
}

// Care checklist (Carolyn): "3 of 5 care steps", or '' if the plant has no care steps
// Only for completed visits: an upcoming visit has nothing ticked yet, so "0 of 7" would mislead
function stepsSummary(item) {
  const total = getRequestSteps(item).length
  if (total === 0 || props.visit.status !== 'completed') return ''
  return `${(item.completedSteps || []).length} of ${total} care steps`
}
</script>

<template>
  <article class="history-card" :class="`is-${visit.status}`">
    <!-- (Carolyn) big photo(s) on the left, plant names + date on the right, badge with a symbol -->
    <div class="history-heading">
      <div class="plant-strip">
        <img v-for="plant in plants.slice(0, 3)" :key="plant.plantId" :src="plant.photoUrl || plantPlaceholder" :alt="plant.plantName" @error="$event.target.src = plantPlaceholder" />
        <span v-if="plants.length > 3" class="plant-count">+{{ plants.length - 3 }}</span>
        <span v-if="plants.length > 2" class="mobile-plant-count">+{{ plants.length - 2 }} more</span>
      </div>
      <div class="history-text">
        <strong class="plant-names" :title="plantNames">{{ plantNames }}</strong>
        <p>🗓️ {{ date(visit.visitDate) }}</p>
        <p v-if="tokens" class="history-tokens">🪙 {{ tokenText(tokens) }}</p>
      </div>
      <span class="status">
        <span aria-hidden="true">{{ statusIcon(visit.status) }}</span> {{ statusLabel(visit.status) }}
      </span>
    </div>
    <div class="card-actions">
      <span v-if="paid" class="paid"><span aria-hidden="true">🪙</span> Reward paid</span>
      <button
        v-else-if="visit.status === 'completed'"
        type="button"
        class="btn btn-outline-primary btn-sm"
        :disabled="busy"
        @click="emit('claim-reward', visit)"
      >{{ busy ? 'Claiming…' : 'Claim reward' }}</button>
      <button type="button" class="more-details" @click="detailsOpen = true">More details</button>
    </div>
    <Teleport to="body">
    <div v-if="detailsOpen" class="modal-backdrop" role="presentation" @click.self="detailsOpen = false">
      <!-- (Carolyn) .single = one plant, so a narrower pop-up -->
      <section class="details-modal" :class="{ single: (visit.items || []).length <= 1 }" role="dialog" aria-modal="true" :aria-label="`Visit ${visit.visitId} history details`" @keydown.esc="detailsOpen = false">
        <!-- (Carolyn) Fix 4: status, date, tokens and proof photos first; visit page link last -->
        <div class="modal-heading">
          <div>
            <h3>{{ plantNames }}</h3>
            <small class="visit-no">Visit #{{ visit.visitId }}</small>
          </div>
          <button type="button" class="modal-close" aria-label="Close details" @click="detailsOpen = false">×</button>
        </div>

        <ul class="summary">
          <li class="status" :class="`tone-${visit.status}`">{{ statusLabel(visit.status) }}</li>
          <li>🗓️ {{ date(visit.visitDate) }}</li>
          <li v-if="tokens">🪙 {{ tokenText(tokens) }}</li>
          <li v-if="paid" class="paid-chip">✓ Reward paid</li>
        </ul>

        <!-- One card per plant: big proof photo, then what was done -->
        <ul class="proof-grid">
          <li v-for="item in visit.items || []" :key="item.requestItemId" class="proof-card">
            <a
              v-if="item.proofUrl"
              :href="item.proofUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="proof-photo"
              :title="`Open ${item.plant?.plantName || 'plant'} proof full size`"
            >
              <img :src="item.proofUrl" :alt="`Proof photo for ${item.plant?.plantName || 'plant'}`" />
            </a>
            <div v-else class="proof-photo no-proof">
              {{ ['accepted', 'open'].includes(visit.status) ? 'Not submitted yet' : 'No proof photo' }}
            </div>
            <div class="proof-body">
              <strong>{{ item.plant?.plantName || 'Unnamed plant' }}</strong>
              <!-- Care checklist (Carolyn) -->
              <span v-if="stepsSummary(item)" class="steps">✓ {{ stepsSummary(item) }}</span>
              <span v-if="sitterNote(item)" class="note">“{{ sitterNote(item) }}”</span>
            </div>
          </li>
        </ul>
        <p v-if="!(visit.items || []).length" class="empty">No plant details for this visit.</p>

        <div class="modal-foot">
          <RouterLink class="visit-link" :to="{ name: 'visit-detail', params: { visitId: visit.visitId } }">
            View visit page →
          </RouterLink>
        </div>
      </section>
    </div>
    </Teleport>
  </article>
</template>

<style scoped>
.history-card { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; box-sizing: border-box; min-width: 0; padding: 1rem; border: 1px solid #e2e8e2; border-top: 5px solid #c4d5c7; border-radius: 14px; background: #fff; box-shadow: 0 4px 14px #183c2410; transition: transform 0.18s ease, box-shadow 0.18s ease; }
.history-card:hover { transform: translateY(-2px); box-shadow: 0 7px 18px #183c2417; }
.history-card.is-completed { border-top-color: #3d8b58; }
.history-card.is-missed, .history-card.is-expired { border-top-color: #c65050; }
.history-card.is-cancelled { border-top-color: #8b9490; }
.history-card.is-accepted, .history-card.is-in_progress { border-top-color: #d1a330; }
/* (Carolyn) photo | names + date | badge, in one row; no fixed card height (was height: 230px) */
.history-heading { display: flex; align-items: flex-start; gap: 0.85rem; width: 100%; color: #34463a; }
.history-text { flex: 1; min-width: 0; display: grid; gap: 0.15rem; }
.history-text p { margin: 0; font-size: 0.88rem; }
.history-tokens { color: #795900; }
.history-heading .status { flex-shrink: 0; white-space: nowrap; }
.status { padding: 0.2rem 0.6rem; border-radius: 999px; background: #e8f3e9; color: #2d6740; font-size: 0.78rem; text-transform: capitalize; }
.is-missed .status, .is-expired .status { background: #fde8ea; color: #a3212f; }
.is-cancelled .status { background: #eceeed; color: #4d5650; }
.is-accepted .status, .is-in_progress .status { background: #fff3d1; color: #795900; }
.plant-names { display: -webkit-box; overflow: hidden; max-height: 2.8em; color: #1f2d24; font-size: 1.05rem; overflow-wrap: anywhere; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
p { margin: 0.2rem 0 0; color: #59665c; }
/* (Carolyn) bigger photos (were 32px), overlapping when there are several */
.plant-strip { display: flex; flex-shrink: 0; }
.plant-strip img, .plant-count { width: 68px; height: 68px; margin-left: -20px; border: 3px solid #fff; border-radius: 14px; box-shadow: 0 2px 6px #183c2418; }
.plant-strip > :first-child { margin-left: 0; }
.plant-strip img { object-fit: cover; }
.plant-count { display: grid; place-items: center; background: #edf3ed; color: #34463a; font-size: 0.9rem; font-weight: 700; }
a { white-space: normal; }
/* (Carolyn) "Reward paid" as a soft green pill with a coin, like the status badges */
.paid { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.7rem; border: 1px solid #b8dfc0; border-radius: 999px; background: #e6f5ea; color: #14532d; font-size: 0.82rem; font-weight: 600; }
.card-actions { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%; margin-top: auto; }
/* (Carolyn) margin-left: auto = always on the right, with or without "Reward paid" beside it */
.more-details { margin-left: auto; padding: 0.45rem 0.8rem; border: 1px solid #dce5dc; border-radius: 9px; background: #f4f8f4; color: #245b34; font-weight: 600; cursor: pointer; }
.modal-backdrop { position: fixed; z-index: 1050; inset: 0; display: grid; place-items: center; padding: 1rem; background: #10231bb3; }
.details-modal { box-sizing: border-box; width: min(720px, 100%); max-height: min(85vh, 800px); overflow: auto; padding: 1.25rem; border: 1px solid #e2e8e2; border-radius: 16px; background: #fff; box-shadow: 0 22px 70px #10231b50; }
.modal-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.8rem; padding-bottom: 0.7rem; border-bottom: 1px solid #e7ece7; }
.modal-heading h3 { margin: 0; color: #245b34; }
.modal-close { display: grid; flex: 0 0 2rem; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 0; border-radius: 50%; background: #eef4ef; color: #34463a; font-size: 1.4rem; line-height: 1; cursor: pointer; }
.visit-link { display: inline-block; padding: 0.45rem 0.9rem; border: 1px solid #b9d6c1; border-radius: 999px; background: #f1f7f2; color: #245b34; text-decoration: none; font-weight: 600; }
.visit-link:hover { background: #e3f0e5; }
/* (Carolyn) Fix 4: history pop-up */
.visit-no { color: #68766b; font-size: 0.8rem; }
.summary, .proof-grid { margin: 0; padding: 0; list-style: none; }
.summary { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin-bottom: 1rem; }
.summary li { padding: 0.2rem 0.65rem; border-radius: 999px; background: #f0f6f1; color: #34463a; font-size: 0.85rem; }
.summary .paid-chip { background: #e6f5ea; color: #14532d; font-weight: 600; }
/* the pop-up is teleported outside the card, so the card's .is-missed colours can't reach it */
.details-modal .status { font-weight: 700; }
.summary .tone-completed { background: #e6f5ea; color: #14532d; }
.summary .tone-accepted, .summary .tone-open { background: #fff3d1; color: #795900; }
.summary .tone-missed, .summary .tone-expired { background: #fde8ea; color: #a3212f; }
.summary .tone-cancelled { background: #eceeed; color: #4d5650; }
/* (Carolyn) pop-up size follows the plants: 1 plant = 440px wide, 2+ = 720px with 2 photos a row.
   Heading, chips and footer stay put; only the photos scroll when there are many. */
.details-modal { display: flex; flex-direction: column; overflow: hidden; }
.details-modal.single { width: min(440px, 100%); }
.modal-heading, .summary, .modal-foot { flex-shrink: 0; }
.proof-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 0.75rem; min-height: 0; overflow-y: auto; grid-auto-rows: max-content; /* rows keep full height, so it scrolls instead of squashing */ }
.proof-card { overflow: hidden; border: 1px solid #e2e8e2; border-radius: 14px; background: #fbfdfb; }
.proof-photo { display: block; aspect-ratio: 4 / 3; padding: 0; background: #eef4ef; }
.proof-photo img { width: 100%; height: 100%; object-fit: cover; }
.proof-photo:hover { background: #eef4ef; }
.no-proof { display: grid; place-items: center; color: #68766b; font-size: 0.85rem; }
.proof-body { display: grid; gap: 0.25rem; padding: 0.65rem 0.75rem; }
.proof-body strong { color: #1f2d24; overflow-wrap: anywhere; }
.proof-body .steps { color: #245b34; font-size: 0.85rem; }
.proof-body .note { color: #59665c; font-size: 0.85rem; font-style: italic; overflow-wrap: anywhere; }
.empty { color: #68766b; }
.modal-foot { display: flex; justify-content: flex-end; margin-top: 1rem; padding-top: 0.8rem; border-top: 1px solid #e7ece7; }
@media (prefers-reduced-motion: reduce) { .history-card { transition: none; } .history-card:hover { transform: none; } }
.mobile-plant-count { display: none; }
@media (max-width: 600px) {
  .history-card { padding: 0.85rem; }
  .history-heading { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 0.5rem 0.75rem; }
  .plant-strip { grid-column: 1; grid-row: 1 / span 2; flex-direction: column; gap: 0.4rem; }
  .plant-strip img { width: 56px; height: 56px; margin: 0; border-width: 2px; border-radius: 10px; }
  .plant-strip img:nth-of-type(n+3), .plant-strip .plant-count { display: none; }
  .mobile-plant-count { display: block; font-size: 0.7rem; color: var(--muted); text-align: center; }
  .history-text { grid-column: 2; grid-row: 1; gap: 0.35rem; }
  .plant-names { display: block; max-height: none; overflow: visible; -webkit-line-clamp: unset; font-size: 1rem; line-height: 1.4; word-break: normal; overflow-wrap: break-word; }
  .history-heading > .status { grid-column: 2; grid-row: 2; justify-self: start; }
  .history-text p { line-height: 1.5; }
  .card-actions { flex-wrap: wrap; margin-top: 0.5rem; }
  .card-actions button { min-height: 44px; }
  .details-modal { max-height: calc(100dvh - 2rem); }
}
/* Scrolling inside the pop-up never spills over to the page behind (needed on iPhones too) */
.modal-backdrop, .modal-backdrop [role="dialog"] { overscroll-behavior: contain; }
</style>
