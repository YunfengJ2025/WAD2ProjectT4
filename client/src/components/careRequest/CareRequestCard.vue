<script setup>
import { computed } from 'vue'
import plantPlaceholder from '@/assets/plant.png'

const props = defineProps({
  request: { type: Object, required: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['cancel-request'])
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

function date(value) {
  return new Date(value).toLocaleDateString('en-GB')
}
</script>

<template>
  <article class="request-card">
    <div class="card-heading">
      <strong>{{ plants[0]?.plantName || 'Plant' }}</strong>
      <span class="status">{{ request.status.replace('_', ' ') }}</span>
    </div>
    <div v-if="plants.length" class="plant-strip">
      <div v-for="plant in request.plantDetails || plants" :key="plant.plantId" class="plant-chip">
        <img
          :src="plant.photoUrl || plantPlaceholder"
          :alt="plant.plantName"
          @error="$event.target.src = plantPlaceholder"
        />
        <span>{{ plant.plantName }}</span>
        <small>Water {{ plant.amountToWater ?? 0 }} ml</small>
        <small v-if="plant.careInstructions">{{ plant.careInstructions }}</small>
      </div>
    </div>
    <p>
      {{ date(request.startDate) }} – {{ date(request.endDate) }} ·
      {{ request.tokenReward }} tokens per visit
    </p>
    <p class="water-source">Water: {{ waterSourceLabels[request.waterSource] || 'Tap available' }}</p>
    <p v-if="request.note">{{ request.note }}</p>
    <button
      v-if="['open', 'in_progress'].includes(request.status)"
      type="button"
      class="btn btn-outline-secondary btn-sm"
      :disabled="busy"
      @click="emit('cancel-request', request)"
    >
      {{ busy ? 'Cancelling…' : 'Cancel request' }}
    </button>
    <ul v-if="request.visits?.length" class="proof-list">
      <li v-for="visit in request.visits" :key="visit.visitId">
        {{ date(visit.visitDate) }} · {{ visit.plants?.map((plant) => plant.plantName).join(', ') || visit.plant?.plantName || 'Plant' }} · {{ visit.status }}
        <span v-for="item in visit.items || []" :key="item.requestItemId">
          <a v-if="item.proofUrl" :href="item.proofUrl" target="_blank" rel="noopener noreferrer">{{ item.plant?.plantName || 'Plant' }} proof</a>
        </span>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.request-card { padding: 1rem; margin: 0.65rem 0; border: 1px solid #e2e8e2; border-radius: 12px; background: #fff; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
.request-card:hover { transform: translateY(-2px); border-color: #93b99a; box-shadow: 0 7px 18px #183c2417; }
.card-heading { display: flex; justify-content: space-between; gap: 0.5rem; }
p { margin: 0.35rem 0; color: #59665c; }
.status {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: #e8f3e9;
  color: #2d6740;
  font-size: 0.8rem;
  text-transform: capitalize;
}
.proof-list { margin: 0.5rem 0; padding-left: 1rem; color: #59665c; font-size: 0.9rem; }
.proof-list li + li { margin-top: 0.25rem; }
.plant-strip { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.65rem 0; }
.plant-chip { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; column-gap: 0.4rem; max-width: 220px; padding: 0.35rem 0.55rem 0.35rem 0.25rem; border-radius: 12px; background: #f1f6f1; color: #34463a; font-size: 0.85rem; }
.plant-chip img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.plant-chip span, .plant-chip small { grid-column: 2; overflow: hidden; text-overflow: ellipsis; }
@media (prefers-reduced-motion: reduce) { .request-card { transition: none; } .request-card:hover { transform: none; } }
</style>
