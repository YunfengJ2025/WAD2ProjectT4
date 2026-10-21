<script setup>
// PlantForm: one form used for BOTH adding a new plant and editing an existing one.
import { computed, ref } from 'vue'
import { createPlant, updatePlant, photoSrc } from '@/api/plants'
import { toDateInputValue } from '@/utils/wateringStatus'

// Pass an existing plant to edit it; leave it out to add a new one.
const props = defineProps({
  plant: { type: Object, default: null },
})
const emit = defineEmits(['saved', 'cancel'])

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 2 * 1024 * 1024 // 2MB in bytes
const NOTES_MAX = 500
// Choices for "Does this spot get rain?" (value is what gets saved as rainExposed)
const RAIN_OPTIONS = [
  { value: true, label: 'Exposed to rain' },
  { value: false, label: 'Sheltered' },
]

// true when a plant was passed in, i.e. we are editing
const isEdit = computed(() => props.plant !== null)
const today = toDateInputValue(new Date())
// Starting value for "Last watered":
// - editing a plant that has a date -> that date
// - editing a plant never watered   -> blank
// - adding a new plant              -> today
const initialLastWatered = props.plant
  ? props.plant.lastWateredAt
    ? toDateInputValue(props.plant.lastWateredAt)
    : ''
  : today

const form = ref({
  plantName: props.plant?.plantName ?? '',
  plantLocation: props.plant?.plantLocation ?? '',
  frequencyDays: props.plant ? String(props.plant.wateringInfo.frequencyDays) : '',
  amountMl: props.plant?.wateringInfo.amountMl ? String(props.plant.wateringInfo.amountMl) : '',
  // null = not chosen yet (new plant); editing starts with the saved true/false
  rainExposed: props.plant ? props.plant.rainExposed : null,
  notes: props.plant?.wateringInfo.notes ?? '',
  lastWateredAt: initialLastWatered,
})

const photoFile = ref(null)
// What the preview box shows: the new photo, or the plant's current photo
const photoPreview = ref(props.plant?.photoUrl ? photoSrc(props.plant.photoUrl) : '')
const photoInput = ref(null)

// Error message per field, e.g. { plantName: 'Please enter a plant name' }
const errors = ref({})
const formError = ref('') // message shown at the top of the form
const saving = ref(false) // true while waiting for the server (disables buttons)

// Checks every field on submit and fills in `errors`. Returns true if all are valid.
function validate() {

  const photoError = errors.value.photo
  errors.value = {}
  // Restore the photo error
  if (photoError) errors.value.photo = photoError

  const name = form.value.plantName.trim()
  if (!name) {
    errors.value.plantName = 'Please enter a plant name'
  } else if (name.length > 100) {
    errors.value.plantName = 'Plant name cannot exceed 100 characters'
  }

  // Where to find it: required, max 100 characters
  const location = form.value.plantLocation.trim()
  if (!location) {
    errors.value.plantLocation = 'Please describe where to find the plant'
  } else if (location.length > 100) {
    errors.value.plantLocation = 'Location cannot exceed 100 characters'
  }

  // /^\d+$/ means "digits only", so 2.5, -1 or abc are rejected.
  const days = String(form.value.frequencyDays).trim()
  if (!days) {
    errors.value.frequencyDays = 'Please enter how often to water'
  } else if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 30) {
    errors.value.frequencyDays = 'Enter a whole number of days from 1 to 30'
  }

  // Amount each time: required, whole number of ml from 10 to 5000
  const amount = String(form.value.amountMl).trim()
  if (!amount) {
    errors.value.amountMl = 'Please enter how much water to give'
  } else if (!/^\d+$/.test(amount) || Number(amount) < 10 || Number(amount) > 5000) {
    errors.value.amountMl = 'Enter a whole number of ml from 10 to 5000'
  }

  // Rain: one option must be chosen
  if (form.value.rainExposed === null) {
    errors.value.rainExposed = 'Please choose whether this spot gets rain'
  }

  if (form.value.notes.length > NOTES_MAX) {
    errors.value.notes = `Notes cannot exceed ${NOTES_MAX} characters`
  }

  // Last watered: optional, cannot be in the future.
  if (form.value.lastWateredAt && form.value.lastWateredAt > today) {
    errors.value.lastWateredAt = 'Last watered date cannot be in the future'
  }

  // Valid only if no errors were added
  return Object.keys(errors.value).length === 0
}

// Runs when the user picks a file. Checks type and size straight away;
function onPhotoChange(event) {
  const file = event.target.files[0]
  delete errors.value.photo
  if (!file) return

  let message = ''
  if (!PHOTO_TYPES.includes(file.type)) message = 'Photo must be a JPG, PNG or WebP image'
  else if (file.size > MAX_PHOTO_BYTES) message = 'Photo must be 2MB or smaller'

  // Bad file: show the error and clear the file input
  if (message) {
    errors.value.photo = message
    event.target.value = ''
    return
  }

  // Good file: keep it for submit, then read it so <img> can preview it
  photoFile.value = file
  const reader = new FileReader()
  reader.onload = () => (photoPreview.value = reader.result)
  reader.readAsDataURL(file)
}

// "Undo" button: drop the new photo and go back to the original one (if any)
function clearNewPhoto() {
  photoFile.value = null
  delete errors.value.photo
  photoPreview.value = props.plant?.photoUrl ? photoSrc(props.plant.photoUrl) : ''
  if (photoInput.value) photoInput.value.value = '' //vue and html
}

// Date inputs give a calendar day. Today becomes "now"; past days become
// midday local time so the day doesn't shift across timezones.
function lastWateredToISO(value) {
  if (!value) return ''
  if (value === today) return new Date().toISOString()
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 12).toISOString()
}


function buildFormData() {
  const data = new FormData()
  data.append('plantName', form.value.plantName.trim())
  data.append('plantLocation', form.value.plantLocation.trim())
  data.append('frequencyDays', String(form.value.frequencyDays).trim())
  data.append('amountMl', String(form.value.amountMl).trim())
  data.append('rainExposed', String(form.value.rainExposed)) // "true" or "false"
  data.append('notes', form.value.notes.trim())
  // When editing, only send the date if it changed so the stored time is kept.
  if (!isEdit.value || form.value.lastWateredAt !== initialLastWatered) {
    data.append('lastWateredAt', lastWateredToISO(form.value.lastWateredAt))
  }
  // Only send a photo if a new one was chosen
  if (photoFile.value) data.append('photo', photoFile.value)
  return data
}

// Runs when the form is submitted (Add plant / Save changes button).
// 1. Validate in the browser. 2. Send to the server. 3. Show any server errors.
async function onSubmit() {
  formError.value = ''
  if (!validate()) {
    formError.value = 'Please fix the highlighted fields.'
    return
  }

  saving.value = true
  try {
    const data = buildFormData()
    const saved = isEdit.value
      ? await updatePlant(props.plant.plantId, data)
      : await createPlant(data)
    emit('saved', saved) // tell the parent page it worked
  } catch (err) {
    // per-field messages, which we show under the fields like ours.
    Object.assign(errors.value, err.errors)
    formError.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!--
    novalidate: turn off the browser's built-in popups; we show our own messages.
    @submit.prevent: run onSubmit and stop the page from reloading
    (.prevent = event.preventDefault()).
  -->
  <form class="plant-form" novalidate @submit.prevent="onSubmit">
    <!-- Summary message at the top. role="alert" makes screen readers read it out. -->
    <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

    <div class="field">
      <label for="plantName">Plant name <span class="req" aria-hidden="true">*</span></label>
      <input
        id="plantName"
        v-model="form.plantName"
        type="text"
        maxlength="100"
        autocomplete="off"
        placeholder="e.g. Monstera"
        required
        :aria-invalid="!!errors.plantName"
        :aria-describedby="errors.plantName ? 'plantName-error' : undefined"
      />
      <!-- v-if: only shown when this field has an error -->
      <p v-if="errors.plantName" id="plantName-error" class="error">{{ errors.plantName }}</p>
    </div>

    <!-- Where to find it: free text so the helper knows exactly which plant -->
    <div class="field">
      <label for="plantLocation">
        Where to find it <span class="req" aria-hidden="true">*</span>
      </label>
      <input
        id="plantLocation"
        v-model="form.plantLocation"
        type="text"
        maxlength="100"
        autocomplete="off"
        placeholder="e.g. Floor pot beside the shoe rack"
        required
        :aria-invalid="!!errors.plantLocation"
        :aria-describedby="errors.plantLocation ? 'plantLocation-error' : undefined"
      />
      <p v-if="errors.plantLocation" id="plantLocation-error" class="error">
        {{ errors.plantLocation }}
      </p>
    </div>

    <!-- Photo: preview box + choose/undo buttons -->
    <div class="field">
      <span class="label" id="photo-label">Photo</span>
      <div class="photo-row">
        <div class="preview" :class="{ empty: !photoPreview }">
          <img v-if="photoPreview" :src="photoPreview" alt="Selected plant photo preview" />
          <span v-else>No photo</span>
        </div>
        <div class="photo-controls">
          <!-- The real file input is hidden; this label acts as the button and opens it -->
          <label class="btn" for="photo">{{ photoPreview ? 'Change photo' : 'Choose photo' }}</label>
          <input
            id="photo"
            ref="photoInput"
            class="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-labelledby="photo-label"
            :aria-invalid="!!errors.photo"
            :aria-describedby="errors.photo ? 'photo-error' : undefined"
            @change="onPhotoChange"
          />
          <!-- Undo only appears after a new photo is chosen -->
          <button v-if="photoFile" type="button" class="btn" @click="clearNewPhoto">
            Undo
          </button>
          <p class="hint">JPG, PNG or WebP, up to 2MB.</p>
        </div>
      </div>
      <p v-if="errors.photo" id="photo-error" class="error">{{ errors.photo }}</p>
    </div>

    <!-- Watering frequency in days (1-30) -->
    <div class="field narrow">
      <label for="frequencyDays">
        Water every (days) <span class="req" aria-hidden="true">*</span>
      </label>
      <input
        id="frequencyDays"
        v-model="form.frequencyDays"
        type="number"
        inputmode="numeric"
        min="1"
        max="30"
        step="1"
        placeholder="7"
        required
        :aria-invalid="!!errors.frequencyDays"
        :aria-describedby="errors.frequencyDays ? 'frequencyDays-error' : undefined"
      />
      <p v-if="errors.frequencyDays" id="frequencyDays-error" class="error">
        {{ errors.frequencyDays }}
      </p>
    </div>

    <!-- Amount of water each time, in ml (10-5000) -->
    <div class="field narrow">
      <label for="amountMl">
        Amount each time (ml) <span class="req" aria-hidden="true">*</span>
      </label>
      <input
        id="amountMl"
        v-model="form.amountMl"
        type="number"
        inputmode="numeric"
        min="10"
        max="5000"
        step="10"
        placeholder="250"
        required
        :aria-invalid="!!errors.amountMl"
        :aria-describedby="errors.amountMl ? 'amountMl-error' : undefined"
      />
      <p v-if="errors.amountMl" id="amountMl-error" class="error">{{ errors.amountMl }}</p>
    </div>

    <!-- Rain: fieldset + legend groups the radio buttons under one question -->
    <fieldset
      class="field"
      :aria-describedby="errors.rainExposed ? 'rainExposed-error' : undefined"
    >
      <legend>Does this spot get rain? <span class="req" aria-hidden="true">*</span></legend>
      <div class="segmented" :class="{ invalid: errors.rainExposed }">
        <!-- v-for makes one radio per option -->
        <label v-for="opt in RAIN_OPTIONS" :key="String(opt.value)">
          <input
            v-model="form.rainExposed"
            type="radio"
            name="rainExposed"
            :value="opt.value"
          />
          <span>{{ opt.label }}</span>
        </label>
      </div>
      <p class="hint">Exposed means the pot is in the open, not under the shelter.</p>
      <p v-if="errors.rainExposed" id="rainExposed-error" class="error">
        {{ errors.rainExposed }}
      </p>
    </fieldset>


    <div class="field">
      <label for="notes">Care notes</label>
      <textarea
        id="notes"
        v-model="form.notes"
        rows="3"
        :maxlength="NOTES_MAX"
        placeholder="e.g. Let the top soil dry out first"
        :aria-invalid="!!errors.notes"
        :aria-describedby="errors.notes ? 'notes-error' : undefined"
      ></textarea>
      <p class="hint counter" :class="{ over: form.notes.length >= NOTES_MAX }">
        {{ form.notes.length }}/{{ NOTES_MAX }}
      </p>
      <p v-if="errors.notes" id="notes-error" class="error">{{ errors.notes }}</p>
    </div>

    <div class="field narrow">
      <label for="lastWateredAt">Last watered</label>
      <input
        id="lastWateredAt"
        v-model="form.lastWateredAt"
        type="date"
        :max="today"
        :aria-invalid="!!errors.lastWateredAt"
        :aria-describedby="errors.lastWateredAt ? 'lastWateredAt-error' : undefined"
      />
      <p class="hint">Leave blank if it hasn't been watered yet.</p>
      <p v-if="errors.lastWateredAt" id="lastWateredAt-error" class="error">
        {{ errors.lastWateredAt }}
      </p>
    </div>

    <!-- Buttons are disabled while saving so the form can't be sent twice -->
    <div class="form-actions">
      <button type="button" class="btn" :disabled="saving" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="btn btn-primary" :disabled="saving">
        {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add plant' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.plant-form {
  display: grid;
  gap: 1.25rem;
}

.field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  border: 0;
  padding: 0;
}

.field.narrow {
  max-width: 220px;
}

label,
legend,
.label {
  font-weight: 600;
  color: var(--color-heading);
}

legend {
  padding: 0;
  margin-bottom: 0.35rem;
}

.req {
  color: var(--danger);
}

input[type='text'],
input[type='number'],
input[type='date'],
textarea {
  width: 100%;
  min-height: 44px;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--color-border-hover);
  border-radius: 8px;
  background: var(--surface);
  color: var(--color-text);
  font: inherit;
}

textarea {
  resize: vertical;
}

input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: var(--accent);
}

[aria-invalid='true'] {
  border-color: var(--danger) !important;
}

.error {
  color: var(--danger);
  font-size: 0.875rem;
  font-weight: 500;
}

.error::before {
  content: '⚠ ';
}

.hint {
  color: var(--muted);
  font-size: 0.85rem;
}

.counter {
  justify-self: end;
}

.counter.over {
  color: var(--danger);
}

.form-error {
  padding: 0.7rem 0.9rem;
  border-radius: 8px;
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: 600;
}

/* Photo */
.photo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.preview {
  width: 120px;
  aspect-ratio: 4 / 3;
  border-radius: 10px;
  overflow: hidden;
  background: var(--accent-soft);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.preview.empty {
  border: 1px dashed var(--color-border-hover);
  color: var(--muted);
  font-size: 0.85rem;
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.photo-controls .hint {
  flex-basis: 100%;
}

.photo-controls label.btn {
  font-weight: 600;
  color: var(--color-text);
}

.photo-controls:focus-within label.btn {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Segmented radio buttons */
.segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.segmented label {
  position: relative;
  font-weight: 500;
}

.segmented input {
  position: absolute;
  opacity: 0;
  inset: 0;
  margin: 0;
  cursor: pointer;
}

.segmented span {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0.4rem 1rem;
  border: 1px solid var(--color-border-hover);
  border-radius: 999px;
  background: var(--surface);
  color: var(--color-text);
}

.segmented.invalid span {
  border-color: var(--danger);
}

.segmented input:checked + span {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
  font-weight: 600;
}

.segmented input:focus-visible + span {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

@media (max-width: 480px) {
  .form-actions .btn {
    flex: 1;
  }
}
</style>
