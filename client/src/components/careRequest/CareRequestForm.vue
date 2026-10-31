<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import plantPlaceholder from '@/assets/plant.png'

const props = defineProps({
  plants: { type: Array, default: () => [] },
  availableBalance: { type: Number, default: 0 },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['create-request'])

const form = ref({
  plantIds: [],
  plantDetails: {},
  startDate: '',
  endDate: '',
  note: '',
  waterSource: 'tap_available',
  tokenReward: 1,
})
const animatedCalendar = ref('')
const selectionError = ref('')
let calendarAnimationTimer

const totalReward = computed(() => {
  const start = form.value.startDate
  const end = form.value.endDate
  if (!start || !end || end < start) return 0
  const days = Math.round((new Date(end) - new Date(start)) / 86_400_000) + 1
  return days * Number(form.value.tokenReward)
})
const selectedPlants = computed(() => props.plants.filter((plant) => form.value.plantIds.includes(plant.plantId)))

function animateCalendar(field) {
  animatedCalendar.value = field
  clearTimeout(calendarAnimationTimer)
  calendarAnimationTimer = setTimeout(() => {
    animatedCalendar.value = ''
  }, 500)
}

function submit() {
  if (!form.value.plantIds.length) {
    selectionError.value = 'Select at least one plant for this request.'
    return
  }
  emit('create-request', {
    ...form.value,
    plantIds: form.value.plantIds.slice(),
    plantDetails: selectedPlants.value.map((plant) => ({
      plantId: plant.plantId,
      amountToWater: Number(form.value.plantDetails[plant.plantId]?.amountToWater || 0),
      careInstructions: form.value.plantDetails[plant.plantId]?.careInstructions || '',
    })),
    tokenReward: Number(form.value.tokenReward),
  })
}

function togglePlant(plantId) {
  if (form.value.plantIds.includes(plantId)) {
    form.value.plantIds = form.value.plantIds.filter((id) => id !== plantId)
  } else {
    form.value.plantIds.push(plantId)
    form.value.plantDetails[plantId] = { amountToWater: 0, careInstructions: '' }
  }
  selectionError.value = ''
}

onBeforeUnmount(() => clearTimeout(calendarAnimationTimer))
</script>

<template>
  <section class="panel">
    <h2>Post a request</h2>
    <p v-if="!plants.length">Add a plant first, then you can request care for it.</p>
    <form v-else class="request-form" @submit.prevent="submit">
      <fieldset class="wide plant-selection">
        <legend>Select plants <span>{{ form.plantIds.length }} selected</span></legend>
        <p>Choose the plants that need care. You can select more than one.</p>
        <div class="plant-grid">
          <button
            v-for="plant in plants"
            :key="plant.plantId"
            type="button"
            class="plant-option"
            :class="{ selected: form.plantIds.includes(plant.plantId) }"
            :aria-pressed="form.plantIds.includes(plant.plantId)"
            @click="togglePlant(plant.plantId)"
          >
            <span class="plant-photo">
              <img
                :src="plant.photoUrl || plantPlaceholder"
                :alt="plant.plantName"
                @error="$event.target.src = plantPlaceholder"
              />
              <span class="selection-check" aria-hidden="true">
                {{ form.plantIds.includes(plant.plantId) ? '✓' : '' }}
              </span>
            </span>
            <span class="plant-name">{{ plant.plantName }}</span>
            <span class="plant-location">{{ plant.plantLocation }}</span>
          </button>
        </div>
        <p v-if="selectionError" class="selection-error" role="alert">{{ selectionError }}</p>
      </fieldset>
      <fieldset v-for="plant in selectedPlants" :key="`care-${plant.plantId}`" class="wide plant-care">
        <legend>Care for {{ plant.plantName }}</legend>
        <label>
          Water amount per visit (ml)
          <input v-model.number="form.plantDetails[plant.plantId].amountToWater" type="number" min="0" max="10000" step="10" required />
        </label>
        <label>
          Plant-specific instructions
          <textarea v-model="form.plantDetails[plant.plantId].careInstructions" maxlength="500" rows="2" placeholder="e.g. Keep away from direct sun after watering"></textarea>
        </label>
      </fieldset>
      <label>
        Start date
        <input
          v-model="form.startDate"
          type="date"
          lang="en-GB"
          required
          :class="{ 'calendar-bounce': animatedCalendar === 'start' }"
          @click="animateCalendar('start')"
        />
      </label>
      <label>
        End date
        <input
          v-model="form.endDate"
          type="date"
          lang="en-GB"
          :min="form.startDate"
          required
          :class="{ 'calendar-bounce': animatedCalendar === 'end' }"
          @click="animateCalendar('end')"
        />
      </label>
      <label>
        Reward per visit (tokens)
        <input v-model.number="form.tokenReward" type="number" min="1" step="1" required />
      </label>
      <p class="wide reward-preview">
        {{ totalReward }} tokens will be frozen for this request (one visit per day).
      </p>
      <fieldset class="wide water-source">
        <legend>Water for the visit</legend>
        <div class="water-source-options">
          <label><input v-model="form.waterSource" type="radio" name="waterSource" value="left_out" required /> Water left outside</label>
          <label><input v-model="form.waterSource" type="radio" name="waterSource" value="tap_available" required /> Tap available</label>
          <label><input v-model="form.waterSource" type="radio" name="waterSource" value="sitter_brings" required /> Sitter brings water</label>
        </div>
      </fieldset>
      <label class="wide">
        Note
        <textarea
          v-model="form.note"
          maxlength="1000"
          rows="3"
          placeholder="Care instructions for the sitter"
        ></textarea>
      </label>
      <button class="btn btn-primary" :disabled="saving || totalReward <= 0 || totalReward > availableBalance">
        {{ saving ? 'Posting…' : 'Post request' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.panel {
  padding: 1.25rem;
  margin-bottom: 1rem;
  border: 1px solid var(--color-border, #dce5dc);
  border-radius: 12px;
  background: var(--surface, #fff);
}
h2 { margin-bottom: 1rem; font-size: 1.2rem; }
.request-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.request-form label { display: grid; gap: 0.35rem; font-weight: 600; }
.request-form input,
.request-form textarea {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #b9c7bb;
  border-radius: 7px;
  font: inherit;
}
.request-form input.calendar-bounce { animation: dateFieldPulse 0.45s ease-out; }
.request-form input.calendar-bounce::-webkit-calendar-picker-indicator {
  animation: calendarIconBounce 0.45s ease-out;
  transform-origin: center;
}
.reward-preview { margin: 0; }
.wide { grid-column: 1 / -1; }
.request-form > button { justify-self: start; }
.plant-selection { min-width: 0; margin: 0; padding: 0; border: 0; }
.plant-care { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; margin: 0; padding: 0.9rem; border: 1px solid #d7e1d8; border-radius: 10px; }
.plant-care legend { float: none; width: 100%; font-weight: 700; }
.water-source { min-width: 0; margin: 0; padding: 0; border: 0; }
.water-source legend { float: none; width: 100%; margin-bottom: 0.5rem; font-weight: 700; }
.water-source-options { display: flex; flex-wrap: wrap; gap: 0.55rem; }
.water-source-options label { display: flex; align-items: center; gap: 0.45rem; padding: 0.6rem 0.75rem; border: 1px solid #d7e1d8; border-radius: 9px; background: #fff; cursor: pointer; transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease; }
.water-source-options label:has(input:checked) { border-color: #34834c; background: #f0f8f1; color: #245b34; }
.water-source-options input { width: auto; padding: 0; accent-color: #34834c; }
.plant-selection legend { float: none; width: 100%; margin-bottom: 0.25rem; font-weight: 700; }
.plant-selection legend span { margin-left: 0.45rem; color: #637466; font-size: 0.85rem; font-weight: 500; }
.plant-selection > p { margin: 0 0 0.75rem; color: #637466; font-size: 0.9rem; }
.plant-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 0.75rem; }
.plant-option {
  min-width: 0;
  padding: 0.45rem;
  overflow: hidden;
  border: 1px solid #d7e1d8;
  border-radius: 12px;
  background: #fff;
  color: #34463a;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}
.plant-option:hover { transform: translateY(-3px); border-color: #75a781; box-shadow: 0 8px 18px #183c241a; color: #245b34; }
.plant-option.selected { border: 2px solid #34834c; padding: calc(0.45rem - 1px); background: #f0f8f1; }
.plant-option:focus-visible { outline: 3px solid #34834c; outline-offset: 2px; }
.plant-photo { position: relative; display: block; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 8px; background: #edf3ed; }
.plant-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.25s ease; }
.plant-option:hover .plant-photo img { transform: scale(1.04); }
.selection-check { position: absolute; right: 0.45rem; bottom: 0.45rem; display: grid; place-items: center; width: 27px; height: 27px; border: 2px solid #fff; border-radius: 7px; background: #ffffffd9; color: transparent; font-size: 1.1rem; font-weight: 700; box-shadow: 0 1px 5px #0003; }
.plant-option.selected .selection-check { background: #287de2; color: #fff; }
.plant-name { display: block; margin: 0.5rem 0 0.15rem; color: inherit; font-weight: 700; }
.plant-location { display: block; overflow: hidden; color: #637466; font-size: 0.8rem; text-overflow: ellipsis; white-space: nowrap; }
.selection-error { margin: 0.65rem 0 0; color: #b42318; font-size: 0.9rem; }
@keyframes calendarIconBounce {
  0%, 100% { transform: scale(1) rotate(0); }
  35% { transform: scale(1.2) rotate(-12deg); }
  70% { transform: scale(1.08) rotate(9deg); }
}
@keyframes dateFieldPulse {
  35% { box-shadow: 0 0 0 3px rgba(47, 125, 74, 0.18); }
}
@media (max-width: 700px) {
  .request-form { grid-template-columns: 1fr; }
  .plant-care { grid-template-columns: 1fr; }
  .plant-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wide { grid-column: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .request-form input.calendar-bounce,
  .request-form input.calendar-bounce::-webkit-calendar-picker-indicator { animation: none; }
  .plant-option, .plant-photo img { transition: none; }
  .plant-option:hover, .plant-option:hover .plant-photo img { transform: none; }
}
</style>
