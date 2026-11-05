<script setup>
// Component: summarizes an open visit and emits the sitter's accept action to its parent.
import plantPlaceholder from '@/assets/plant.png'
// Care checklist (Carolyn): this request's instructions (or the plant's notes) as steps
import { getRequestSteps } from '@/utils/careSteps'
// (Carolyn) Fix 5: shared date / token / water wording for all visit cards
import { formatDate as date, tokenText, waterSourceLabel } from '@/utils/visitFormat'

defineProps({
  visit: { type: Object, required: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['accept-visit'])
</script>

<template>
  <article class="available-card">
    <!-- Open the status-aware detail page without accepting the visit. -->
    <RouterLink :to="{ name: 'visit-detail', params: { visitId: visit.visitId } }">View visit details</RouterLink>
    <div class="card-heading">
      <div>
        <p class="eyebrow">{{ date(visit.visitDate) }} · {{ visit.owner?.userName || 'Neighbour' }}</p>
        <strong>{{ visit.plants?.length || 1 }} plant{{ (visit.plants?.length || 1) === 1 ? '' : 's' }} to care for</strong>
      </div>
      <span v-if="visit.request?.tokenReward" class="reward">{{ tokenText(visit.request.tokenReward) }}</span>
    </div>
    <p class="water-source">Water: {{ waterSourceLabel(visit.request?.waterSource) }}</p>
    <p v-if="visit.request?.note" class="note">{{ visit.request.note }}</p>
    <div class="plant-grid">
      <div v-for="item in visit.items || []" :key="item.plantId" class="plant-tile">
        <img
          :src="item.plant?.photoUrl || plantPlaceholder"
          :alt="item.plant?.plantName"
          @error="$event.target.src = plantPlaceholder"
        />
        <div>
          <strong>{{ item.plant?.plantName }}</strong>
          <span>{{ item.plant?.plantLocation }}</span>
          <span>Water {{ item.amountToWater ?? 0 }} ml</span>
        </div>
        <!-- Care checklist (Carolyn): <details> = click the summary to open/close the list -->
        <details v-if="getRequestSteps(item).length" class="care-steps">
          <summary>📋 {{ getRequestSteps(item).length }} care steps</summary>
          <ul>
            <li v-for="step in getRequestSteps(item)" :key="step">{{ step }}</li>
          </ul>
        </details>
      </div>
    </div>
    <button
      type="button"
      class="btn btn-primary btn-sm"
      :disabled="busy"
      @click="emit('accept-visit', visit)"
    >
      {{ busy ? 'Accepting…' : 'Accept visit' }}
    </button>
  </article>
</template>

<style scoped>
.available-card { padding: 1rem; border: 1px solid #dce8dd; border-radius: 14px; background: #fff; box-shadow: 0 2px 8px #183c240d; transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.available-card:hover { transform: translateY(-3px); border-color: #85ae8e; box-shadow: 0 10px 22px #183c2418; }
.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.card-heading strong { color: #283d2d; }
.eyebrow { margin: 0 0 0.2rem; color: #667568; font-size: 0.83rem; }
.reward { flex-shrink: 0; padding: 0.25rem 0.65rem; border-radius: 999px; background: #e7f3e9; color: #28623a; font-size: 0.83rem; font-weight: 700; }
.note { margin: 0.7rem 0; color: #59665c; }
.water-source { margin: 0.6rem 0 0; color: #34463a; font-size: 0.9rem; font-weight: 700; }
.plant-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 0.55rem; margin: 0.8rem 0; }
.plant-tile { display: flex; min-width: 0; align-items: center; gap: 0.5rem; padding: 0.35rem; border-radius: 10px; background: #f5f8f5; }
.plant-tile img { width: 48px; height: 48px; flex-shrink: 0; border-radius: 8px; object-fit: cover; }
.plant-tile div { min-width: 0; display: grid; }
.plant-tile strong, .plant-tile span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plant-tile strong { color: #334638; font-size: 0.85rem; }
.plant-tile span { color: #718074; font-size: 0.75rem; }
.available-card button { margin-top: 0.35rem; }
/* Care checklist (Carolyn): steps list under the photo + name, full tile width */
.plant-tile { flex-wrap: wrap; }
.care-steps { flex-basis: 100%; font-size: 0.75rem; color: #34463a; }
.care-steps summary { color: #28623a; font-weight: 700; cursor: pointer; }
.care-steps ul { margin: 0.3rem 0 0; padding-left: 1rem; display: grid; gap: 0.15rem; }
@media (prefers-reduced-motion: reduce) { .available-card { transition: none; } .available-card:hover { transform: none; } }
</style>
