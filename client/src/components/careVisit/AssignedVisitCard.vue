<script setup>
import { reactive, ref } from 'vue'
import plantPlaceholder from '@/assets/plant.png'

const waterSourceLabels = {
  left_out: 'Water left outside',
  tap_available: 'Tap available',
  sitter_brings: 'Sitter brings water',
}

const props = defineProps({
  visit: { type: Object, required: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['submit-proof'])

const actions = reactive({})
const photos = reactive({})
const error = ref('')
const items = props.visit.items?.length ? props.visit.items : (props.visit.plants || [props.visit.plant]).filter(Boolean).map((plant) => ({ plant }))
const plants = items.map((item) => item.plant).filter(Boolean)

function choosePhoto(event, plantId) {
  photos[plantId] = event.target.files.length ? event.target.files[0] : null
}

function submit() {
  error.value = ''
  if (items.some((item) => !actions[item.plantId]?.trim())) {
    error.value = 'Describe the care you completed for each plant.'
    return
  }
  if (items.some((item) => !photos[item.plantId])) {
    error.value = 'Choose a proof photo for each plant.'
    return
  }
  emit('submit-proof', {
    visit: props.visit,
    actions: Object.fromEntries(items.map((item) => [item.plantId, actions[item.plantId].trim()])),
    photos: Object.fromEntries(items.map((item) => [item.plantId, photos[item.plantId]])),
  })
}

function date(value) {
  return new Date(value).toLocaleDateString('en-GB')
}
</script>

<template>
  <article class="visit-card">
    <div class="visit-heading">
      <div>
        <h3>{{ plants.length }} plant{{ plants.length === 1 ? '' : 's' }} to care for</h3>
        <p>{{ date(visit.visitDate) }} · {{ visit.request?.tokenReward }} tokens</p>
      </div>
      <span class="status">{{ visit.status }}</span>
    </div>
    <p class="water-source">Water: {{ waterSourceLabels[visit.request?.waterSource] || 'Tap available' }}</p>
    <form class="visit-form" @submit.prevent="submit">
    <div class="plant-care-list">
      <div v-for="item in items" :key="item.plantId" class="plant-care-card">
        <div class="plant-chip">
          <img :src="item.plant?.photoUrl || plantPlaceholder" :alt="item.plant?.plantName" @error="$event.target.src = plantPlaceholder" />
          <span>{{ item.plant?.plantName || 'Plant' }}</span>
        </div>
        <p>Water {{ item.amountToWater ?? 0 }} ml each visit</p>
        <p v-if="item.careInstructions">{{ item.careInstructions }}</p>
        <label>
          Action completed for this plant
          <input v-model="actions[item.plantId]" maxlength="100" required placeholder="e.g. Watered and checked the soil" />
        </label>
        <label>
          Proof photo for this plant
          <input type="file" accept="image/jpeg,image/png,image/webp" required @change="choosePhoto($event, item.plantId)" />
        </label>
      </div>
    </div>
    <p class="upload-hint">Upload one JPG, PNG or WebP photo per plant (up to 2 MB each).</p>
    <p v-if="visit.request?.note">Notes from owner: {{ visit.request.note }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" :disabled="busy">
        {{ busy ? 'Saving…' : 'Submit visit proof' }}
      </button>
    </form>
  </article>
</template>

<style scoped>
.visit-card { padding: 1rem 0; border-top: 1px solid #e2e8e2; }
.visit-heading { display: flex; justify-content: space-between; gap: 1rem; }
h3 { margin: 0; font-size: 1.05rem; }
p { margin: 0.3rem 0; color: #59665c; }
.status { align-self: start; padding: 0.2rem 0.6rem; border-radius: 999px; background: #e8f3e9; color: #2d6740; font-size: 0.8rem; text-transform: capitalize; }
.water-source { margin: 0.6rem 0; color: #34463a; font-size: 0.9rem; font-weight: 700; }
.plant-care-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(235px, 1fr)); gap: 0.75rem; margin: 0.75rem 0; }
.plant-care-card { display: grid; align-content: start; gap: 0.45rem; padding: 0.75rem; border: 1px solid #e2e8e2; border-radius: 10px; background: #fbfdfb; }
.plant-chip { display: flex; align-items: center; gap: 0.4rem; color: #34463a; font-weight: 700; }
.plant-chip img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.plant-care-card p { margin: 0; }
.plant-care-card label { display: grid; gap: 0.35rem; font-weight: 600; }
.plant-care-card input:not([type='file']) { padding: 0.55rem; border: 1px solid #b9c7bb; border-radius: 7px; font: inherit; }
.upload-hint { font-size: 0.85rem; }
.visit-form { display: grid; gap: 0.8rem; margin: 1rem 0; }
.visit-form label { display: grid; gap: 0.35rem; font-weight: 600; }
.visit-form input:not([type='file']) { padding: 0.55rem; border: 1px solid #b9c7bb; border-radius: 7px; font: inherit; }
.visit-form small { color: #68766b; font-weight: 400; }
.visit-form button { justify-self: start; }
.error { color: #b42318; }
</style>
