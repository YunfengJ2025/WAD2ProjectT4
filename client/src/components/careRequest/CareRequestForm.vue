<script setup>
// Component: collects plant-specific care details, dates, water source, and reward for a request.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import plantPlaceholder from '@/assets/plant.png'
import { buildRequestPlan } from '@/composables/schedule/buildRequestPlan'
import { startOfDay, toDateInputValue } from '@/utils/wateringStatus'

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
  healthCheck: false, // added for health check
})
const animatedCalendar = ref('')
const selectionError = ref('')
let calendarAnimationTimer

// Keep selected plant objects and an ID lookup in sync with the form selection.
const selectedPlants = computed(() => props.plants.filter((plant) => form.value.plantIds.includes(plant.plantId)))
const plantById = computed(() => Object.fromEntries(props.plants.map((plant) => [plant.plantId, plant])))
const todayISO = toDateInputValue(new Date()) // local date, so no UTC off-by-one in Singapore
// Only allow a request to begin on or after the first selected plant is due.
const earliestStartDate = computed(() => {
  if (!selectedPlants.value.length) return todayISO
  const today = startOfDay(new Date())
  return selectedPlants.value.map((plant) => {
    if (!plant.lastWateredAt) return todayISO
    const nextDue = startOfDay(plant.lastWateredAt)
    nextDue.setDate(nextDue.getDate() + Number(plant.wateringInfo.frequencyDays || 1))
    return toDateInputValue(nextDue < today ? today : nextDue)
  }).sort()[0]
})

// Keep the chosen range valid when selected plants change.
watch(earliestStartDate, (earliest) => {
  if (form.value.startDate && form.value.startDate < earliest) {
    form.value.startDate = earliest
    if (form.value.endDate && form.value.endDate < earliest) form.value.endDate = earliest
  }
})

// is there enough input to work out a plan?
const planReady = computed(() =>
  form.value.plantIds.length > 0 &&
  !!form.value.startDate &&
  !!form.value.endDate &&
  form.value.endDate >= form.value.startDate
)
const periodDays = computed(() =>
  planReady.value ? Math.round((new Date(form.value.endDate) - new Date(form.value.startDate)) / 86_400_000) + 1 : 0
)

// the visit plan is a computed, so it updates itself when the plants or dates change
const plan = computed(() =>
  planReady.value
    ? buildRequestPlan(selectedPlants.value, form.value.startDate, form.value.endDate)
    : [],
)
const visitCount = computed(() => plan.value.length)
const totalReward = computed(() => visitCount.value * Number(form.value.tokenReward || 0))

// Format a planned visit date for the preview list.
function formatDay(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Briefly animate the chosen date field when its calendar control is clicked.
function animateCalendar(field) {
  animatedCalendar.value = field
  clearTimeout(calendarAnimationTimer)
  calendarAnimationTimer = setTimeout(() => {
    animatedCalendar.value = ''
  }, 500)
}

// Correct a manually selected start date if it precedes the plants' due date.
function clampStartDate() {
  if (form.value.startDate && form.value.startDate < earliestStartDate.value) {
    form.value.startDate = earliestStartDate.value
    if (form.value.endDate && form.value.endDate < form.value.startDate)
      form.value.endDate = form.value.startDate
  }
}

// Validate the planned visits, then send normalized per-plant details to the parent view.
function submit() {
  if (!visitCount.value) {
    return
  }
  if (!form.value.plantIds.length) {
    selectionError.value = 'Select at least one plant for this request.'
    return
  }
  emit('create-request', {
    ...form.value,
    plantIds: form.value.plantIds.slice(),
    plantDetails: selectedPlants.value.map((plant) => ({
      plantId: plant.plantId,
      usePlantAmount: form.value.plantDetails[plant.plantId]?.usePlantAmount === true,
      amountToWater: Number(form.value.plantDetails[plant.plantId]?.usePlantAmount
        ? plant.wateringInfo.amountMl : form.value.plantDetails[plant.plantId]?.amountToWater || 0),
      careInstructions: form.value.plantDetails[plant.plantId]?.careInstructions || '',
    })),
    tokenReward: Number(form.value.tokenReward),
  })
}

// Add or remove a plant, copying its saved care defaults when it is first selected.
function togglePlant(plant) {
  const plantId = plant.plantId
  if (plant.isOutdoor === false) {
    selectionError.value = `${plant.plantName} is an indoor plant and cannot be requested.`
    return
  }
  if (form.value.plantIds.includes(plantId)) {
    form.value.plantIds = form.value.plantIds.filter((id) => id !== plantId)
  } else {
    form.value.plantIds.push(plantId)
    // Care checklist (Carolyn): start with the plant's own amount and care notes
    // (from its plant profile); the owner can still change them for this request
    const plant = plantById.value[plantId]
    form.value.plantDetails[plantId] = {
      usePlantAmount: true,
      amountToWater: plant?.wateringInfo?.amountMl || 0,
      careInstructions: plant?.wateringInfo?.notes || '',
    }
  }
  selectionError.value = ''
}

// Care checklist (Carolyn): instructions box shows every line (one row per line,
// 3 to 8 rows) so the steps aren't cut off
function instructionRows(plantId) {
  const text = form.value.plantDetails[plantId]?.careInstructions || ''
  const lines = text.split('\n').filter((line) => line.trim() !== '').length
  return Math.min(8, Math.max(3, lines + 1))
}

// Clear the calendar animation timer when the form is removed.
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
            :class="{ selected: form.plantIds.includes(plant.plantId), 'indoor-plant': plant.isOutdoor === false }"
            :aria-pressed="form.plantIds.includes(plant.plantId)"
            :aria-disabled="plant.isOutdoor === false"
            @click="togglePlant(plant)"
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
            <!-- <span v-if="plant.isOutdoor === false" class="indoor-label">Indoor plant</span> -->
          </button>
        </div>
        <p v-if="selectionError" class="selection-error" role="alert">
          <span class="warning-icon" aria-hidden="true">⚠</span>{{ selectionError }}
        </p>
      </fieldset>
      <template v-if="selectedPlants.length">
      <fieldset v-for="plant in selectedPlants" :key="`care-${plant.plantId}`" class="wide plant-care">
        <!-- Care checklist (Carolyn): small photo + name as the card title -->
        <legend>
          <img :src="plant.photoUrl || plantPlaceholder" alt="" @error="$event.target.src = plantPlaceholder" />
          Care for {{ plant.plantName }}
        </legend>
        <div class="watering-choice">
          <label class="amount-default">
            <input v-model="form.plantDetails[plant.plantId].usePlantAmount" type="checkbox" />
            Use plant’s watering amount
          </label>
          <small v-if="form.plantDetails[plant.plantId].usePlantAmount" class="care-hint">Upcoming visits follow changes to the plant’s amount.</small>
          <label>
            {{ form.plantDetails[plant.plantId].usePlantAmount ? 'Water per visit' : 'Custom amount for this request' }}
            <!-- number box with "ml" joined on the right -->
            <span class="amount-input">
              <input v-if="form.plantDetails[plant.plantId].usePlantAmount" :value="plant.wateringInfo.amountMl" type="number" disabled />
              <input v-else v-model.number="form.plantDetails[plant.plantId].amountToWater" type="number" min="0" max="10000" step="1" required />
              <span class="unit">ml</span>
            </span>
          </label>
        </div>
        <label>
          Plant-specific instructions
          <textarea v-model="form.plantDetails[plant.plantId].careInstructions" maxlength="500" :rows="instructionRows(plant.plantId)" placeholder="e.g. Keep away from direct sun after watering"></textarea>
          <small class="care-hint">Filled in from the plant's profile. Each line becomes a checklist step for the sitter.</small>
        </label>
      </fieldset>
      <label>
        Start date
        <input
          v-model="form.startDate"
          type="date"
          lang="en-GB"
          :min="earliestStartDate"
          @change="clampStartDate"
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
      <section class="wide visit-plan" aria-live="polite">
        <h3>Visit plan</h3>
        <p v-if="!planReady" class="plan-note">Choose plants and a start and end date to see which days need a visit.</p>
        <p v-else-if="!visitCount" class="plan-note">
          None of the selected plants need watering between these dates, so there is nothing to request. Try a longer period.
        </p>
        <template v-else>
          <p class="plan-note">
            {{ visitCount }} visit{{ visitCount === 1 ? '' : 's' }} over {{ periodDays }} days. Days with nothing due are skipped.
          </p>
          <ul class="plan-list">
            <li v-for="day in plan" :key="day.date">
              <strong>{{ formatDay(day.date) }}</strong>
              <span class="plan-thumbs">
                <img
                  v-for="id in day.plantIds"
                  :key="id"
                  :src="plantById[id]?.photoUrl || plantPlaceholder"
                  :alt="plantById[id]?.plantName"
                  :title="plantById[id]?.plantName"
                  @error="$event.target.src = plantPlaceholder"
                />
              </span>
            </li>
          </ul>
          <p class="reward-preview">
            {{ visitCount }} × {{ form.tokenReward }} = <strong>{{ totalReward }} tokens</strong> will be frozen for this request.
          </p>
          <p v-if="totalReward > availableBalance" class="selection-error" role="alert">
            <span class="warning-icon" aria-hidden="true">⚠</span>
            You only have {{ availableBalance }} tokens available.
          </p>
        </template>
      </section>

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
      <label class="wide health-option">
        <input v-model="form.healthCheck" type="checkbox" />
        Run a plant health check on the sitter's photos
        <small>(results are for you only)</small>
      </label>
      <button class="btn btn-primary" :disabled="saving || !visitCount || totalReward > availableBalance">
        {{ saving ? 'Posting…' : 'Post request' }}
      </button>
      </template>
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
.request-form .health-option { display: flex; align-items: center; gap: 0.5rem; }
.request-form .health-option input { width: auto; }
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
/* Care checklist (Carolyn): tidier "Care for ..." cards */
.plant-care { grid-template-columns: 180px minmax(0, 1fr); align-items: start; gap: 1rem; padding: 1rem; background: #fafcfb; }
.plant-care legend { display: flex; align-items: center; gap: 0.6rem; margin: 0; padding: 0 0.25rem; font-size: 1rem; color: #245b34; }
.plant-care legend img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.plant-care label { font-size: 0.9rem; }
.plant-care textarea { line-height: 1.5; resize: vertical; }
.watering-choice { display: grid; gap: 0.5rem; }
.plant-care .amount-default { display: flex; align-items: center; gap: 0.5rem; }
.amount-default input { width: auto; flex: 0 0 auto; }
.amount-input { display: flex; }
.amount-input input { flex: 1; min-width: 0; border-radius: 7px 0 0 7px; }
.amount-input .unit { display: grid; place-items: center; padding: 0 0.75rem; border: 1px solid #b9c7bb; border-left: 0; border-radius: 0 7px 7px 0; background: #edf3ed; color: #637466; font-weight: 500; }
.care-hint { color: #637466; font-size: 0.8rem; font-weight: 400; }
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
.plant-selection .selection-error { margin-top: 1rem; }
.plant-option {
  display: flex;
  flex-direction: column;
  width: 100%;
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
.plant-option.indoor-plant { border-style: dashed; }
.plant-option:focus-visible { outline: 3px solid #34834c; outline-offset: 2px; }
.plant-photo { position: relative; display: block; width: 100%; height: 150px; flex: 0 0 150px; overflow: hidden; border-radius: 8px; background: #edf3ed; }
.plant-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.25s ease; }
.plant-option:hover .plant-photo img { transform: scale(1.04); }
.selection-check { position: absolute; right: 0.45rem; bottom: 0.45rem; display: grid; place-items: center; width: 27px; height: 27px; border: 2px solid #fff; border-radius: 7px; background: #ffffffd9; color: transparent; font-size: 1.1rem; font-weight: 700; box-shadow: 0 1px 5px #0003; }
.plant-option.selected .selection-check { background: #287de2; color: #fff; }
.plant-name { display: block; margin: 0.5rem 0 0.15rem; color: inherit; font-weight: 700; }
.plant-location { display: block; overflow: hidden; color: #637466; font-size: 0.8rem; text-overflow: ellipsis; white-space: nowrap; }
.indoor-label { display: inline-block; margin-top: 0.35rem; color: #8b3a32; font-size: 0.78rem; font-weight: 700; }
.selection-error { display: flex; align-items: flex-start; gap: 0.45rem; margin: 0.65rem 0 0; padding: 0.6rem 0.75rem; border: 1px solid #f1b7b1; border-radius: 8px; background: #fff3f1; color: #b42318; font-size: 0.9rem; font-weight: 600; }
.warning-icon { flex: 0 0 auto; font-size: 1rem; line-height: 1.2; }

.visit-plan { padding: 0.9rem; border: 1px solid #d7e1d8; border-radius: 10px; background: #f8fbf8; }
.visit-plan h3 { margin: 0 0 0.35rem; font-size: 1rem; font-weight: 700; }
.plan-note { margin: 0 0 0.5rem; color: #637466; font-size: 0.9rem; }
.plan-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.5rem; margin: 0.5rem 0 0.75rem; padding: 0; list-style: none; }
.plan-list li { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.5rem 0.6rem; border: 1px solid #d7e1d8; border-radius: 9px; background: #fff; font-size: 0.85rem; }
.plan-thumbs { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.plan-thumbs img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: #edf3ed; }

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
