<script setup>
import plantPlaceholder from '@/assets/plant.png'
import { computed, ref } from 'vue'
import { getRequestSteps } from '@/utils/careSteps'
const props = defineProps({
  visit: { type: Object, required: true },
  paid: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
const plants = computed(() => props.visit.plants?.length ? props.visit.plants : (props.visit.plant ? [props.visit.plant] : []))
const emit = defineEmits(['claim-reward'])
const detailsOpen = ref(false)

function date(value) {
  return new Date(value).toLocaleString('en-GB')
}

// Care checklist (Carolyn): "3 of 5 care steps", or '' if the plant has no care steps
function stepsSummary(item) {
  const total = getRequestSteps(item).length
  if (total === 0) return ''
  return `${(item.completedSteps || []).length} of ${total} care steps`
}
</script>

<template>
  <article class="history-card" :class="`is-${visit.status}`">
    <div class="history-heading">
      <strong>{{ plants.length }} plant{{ plants.length === 1 ? '' : 's' }}</strong>
      <span class="status">{{ String(visit.status).replace('_', ' ') }}</span>
    </div>
    <p class="plant-names">{{ plants.map((plant) => plant.plantName).join(', ') || 'Plant' }}</p>
    <p>{{ date(visit.visitDate) }}</p>
    <div class="plant-strip">
      <img v-for="plant in plants.slice(0, 4)" :key="plant.plantId" :src="plant.photoUrl || plantPlaceholder" :alt="plant.plantName" @error="$event.target.src = plantPlaceholder" />
      <span v-if="plants.length > 4" class="plant-count">+{{ plants.length - 4 }}</span>
    </div>
    <div class="card-actions">
      <span v-if="paid" class="paid">Reward paid</span>
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
      <section class="details-modal" role="dialog" aria-modal="true" :aria-label="`Visit ${visit.visitId} history details`" @keydown.esc="detailsOpen = false">
        <div class="modal-heading">
          <h3>Visit history details</h3>
          <button type="button" class="modal-close" aria-label="Close details" @click="detailsOpen = false">×</button>
        </div>
        <RouterLink class="visit-link" :to="{ name: 'visit-detail', params: { visitId: visit.visitId } }">View visit page</RouterLink>
        <div>
          <strong>{{ plants.length }} plant{{ plants.length === 1 ? '' : 's' }} · {{ plants.map((plant) => plant.plantName).join(', ') || 'Plant' }}</strong>
          <p>{{ date(visit.visitDate) }}</p>
          <ul class="item-actions">
            <li v-for="item in visit.items || []" :key="item.requestItemId">
              {{ item.plant?.plantName || 'Plant' }}: {{ item.action }}
              <!-- Care checklist (Carolyn) -->
              <span v-if="stepsSummary(item)"> · {{ stepsSummary(item) }}</span>
            </li>
          </ul>
          <div class="plant-strip">
            <img v-for="plant in plants" :key="plant.plantId" :src="plant.photoUrl || plantPlaceholder" :alt="plant.plantName" @error="$event.target.src = plantPlaceholder" />
          </div>
        </div>
        <div class="proof-links">
          <template v-for="item in visit.items || []" :key="item.requestItemId">
            <a v-if="item.proofUrl" :href="item.proofUrl" target="_blank" rel="noopener noreferrer">
              {{ item.plant?.plantName || 'Plant' }} proof
            </a>
          </template>
        </div>
      </section>
    </div>
    </Teleport>
  </article>
</template>

<style scoped>
.history-card { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; box-sizing: border-box; min-width: 0; height: 230px; padding: 1rem; border: 1px solid #e2e8e2; border-top: 5px solid #c4d5c7; border-radius: 14px; background: #fff; box-shadow: 0 4px 14px #183c2410; transition: transform 0.18s ease, box-shadow 0.18s ease; }
.history-card:hover { transform: translateY(-2px); box-shadow: 0 7px 18px #183c2417; }
.history-card.is-completed { border-top-color: #3d8b58; }
.history-card.is-missed, .history-card.is-expired { border-top-color: #c65050; }
.history-card.is-cancelled { border-top-color: #8b9490; }
.history-card.is-accepted, .history-card.is-in_progress { border-top-color: #d1a330; }
.history-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%; color: #34463a; }
.status { padding: 0.2rem 0.6rem; border-radius: 999px; background: #e8f3e9; color: #2d6740; font-size: 0.78rem; text-transform: capitalize; }
.is-missed .status, .is-expired .status { background: #fde8ea; color: #a3212f; }
.is-cancelled .status { background: #eceeed; color: #4d5650; }
.is-accepted .status, .is-in_progress .status { background: #fff3d1; color: #795900; }
.plant-names { display: -webkit-box; overflow: hidden; max-height: 2.8em; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
p { margin: 0.2rem 0 0; color: #59665c; }
.item-actions { margin: 0.3rem 0; padding-left: 1rem; color: #59665c; font-size: 0.9rem; }
.plant-strip { display: flex; gap: 0.25rem; margin-top: 0.35rem; }
.plant-strip img { width: 32px; height: 32px; border-radius: 7px; object-fit: cover; }
.plant-count { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 7px; background: #edf3ed; color: #34463a; font-size: 0.8rem; }
a { white-space: normal; }
.proof-links { display: grid; gap: 0.25rem; }
.paid { color: #2d6740; font-size: 0.9rem; }
.card-actions { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%; margin-top: auto; }
.more-details { padding: 0.45rem 0.8rem; border: 1px solid #dce5dc; border-radius: 9px; background: #f4f8f4; color: #245b34; font-weight: 600; cursor: pointer; }
.modal-backdrop { position: fixed; z-index: 1050; inset: 0; display: grid; place-items: center; padding: 1rem; background: #10231bb3; }
.details-modal { box-sizing: border-box; width: min(720px, 100%); max-height: min(85vh, 800px); overflow: auto; padding: 1.25rem; border: 1px solid #e2e8e2; border-radius: 16px; background: #fff; box-shadow: 0 22px 70px #10231b50; }
.modal-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.8rem; padding-bottom: 0.7rem; border-bottom: 1px solid #e7ece7; }
.modal-heading h3 { margin: 0; color: #245b34; }
.modal-close { display: grid; flex: 0 0 2rem; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 0; border-radius: 50%; background: #eef4ef; color: #34463a; font-size: 1.4rem; line-height: 1; cursor: pointer; }
.visit-link { display: inline-block; margin-bottom: 0.75rem; padding: 0.3rem 0.65rem; border: 1px solid #d3e3d6; border-radius: 8px; background: #f1f7f2; color: #245b34; text-decoration: none; font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .history-card { transition: none; } .history-card:hover { transform: none; } }
</style>
