<script setup>
import plantPlaceholder from '@/assets/plant.png'
import { computed } from 'vue'
const props = defineProps({
  visit: { type: Object, required: true },
  paid: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
const plants = computed(() => props.visit.plants?.length ? props.visit.plants : (props.visit.plant ? [props.visit.plant] : []))
const emit = defineEmits(['claim-reward'])

function date(value) {
  return new Date(value).toLocaleString('en-GB')
}
</script>

<template>
  <article class="history-card">
    <div>
      <strong>{{ plants.length }} plant{{ plants.length === 1 ? '' : 's' }} · {{ plants.map((plant) => plant.plantName).join(', ') || 'Plant' }}</strong>
      <p>{{ date(visit.visitDate) }}</p>
      <ul class="item-actions">
        <li v-for="item in visit.items || []" :key="item.requestItemId">
          {{ item.plant?.plantName || 'Plant' }}: {{ item.action }}
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
    <span v-if="paid" class="paid">Reward paid</span>
    <button
      v-else-if="visit.status === 'completed'"
      type="button"
      class="btn btn-outline-primary btn-sm"
      :disabled="busy"
      @click="emit('claim-reward', visit)"
    >
      {{ busy ? 'Claiming…' : 'Claim reward' }}
    </button>
  </article>
</template>

<style scoped>
.history-card { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.65rem 0; border-top: 1px solid #edf0ed; }
p { margin: 0.2rem 0 0; color: #59665c; }
.item-actions { margin: 0.3rem 0; padding-left: 1rem; color: #59665c; font-size: 0.9rem; }
.plant-strip { display: flex; gap: 0.25rem; margin-top: 0.35rem; }
.plant-strip img { width: 32px; height: 32px; border-radius: 7px; object-fit: cover; }
a { white-space: nowrap; }
.proof-links { display: grid; gap: 0.25rem; }
.paid { color: #2d6740; font-size: 0.9rem; }
</style>
