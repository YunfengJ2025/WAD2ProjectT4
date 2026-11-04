<script setup>
// PlantForm: one form used for BOTH adding a new plant and editing an existing one.
import { computed, ref } from 'vue'
import { usePlantsStore } from '@/stores/plants'
import { formatShortDate, toDateInputValue } from '@/utils/wateringStatus'
import { getCareSteps } from '@/utils/careSteps'
import PlantIcon from './PlantIcon.vue'

// Pass an existing plant to edit it; leave it out to add a new one.
const props = defineProps({
  plant: { type: Object, default: null },
})
const emit = defineEmits(['saved', 'cancel'])
const plantsStore = usePlantsStore()
const { burst } = useLeafBurst({ keepOnUnmount: true })
const saveBtn = ref(null) // the Confirm button, where the leaves burst from

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 2 * 1024 * 1024 // 2MB in bytes
const NOTES_MAX = 500
// Choices for "Where is this plant?" (value is what gets saved as isOutdoor)
const PLACE_OPTIONS = [
  { value: false, label: 'Inside my home' },
  { value: true, label: 'Outside my door' },
]
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
let initialLastWatered = today
if (props.plant) {
  initialLastWatered = props.plant.lastWateredAt ? toDateInputValue(props.plant.lastWateredAt) : ''
}

const form = ref({
  plantName: props.plant?.plantName ?? '',
  plantLocation: props.plant?.plantLocation ?? '',
  frequencyDays: props.plant ? String(props.plant.wateringInfo.frequencyDays) : '',
  amountMl: props.plant?.wateringInfo.amountMl ? String(props.plant.wateringInfo.amountMl) : '',
  // null = not chosen yet (new plant); editing starts with the saved true/false.
  // Older plants have no isOutdoor saved, so anything except false counts as outdoor.
  isOutdoor: props.plant ? props.plant.isOutdoor !== false : null,
  // null = not chosen yet (new plant); editing starts with the saved true/false
  rainExposed: props.plant ? props.plant.rainExposed : null,
  // Lets the watering schedule change with the weather (off unless ticked)
  weatherAdjustmentEnabled: props.plant?.weatherAdjustmentEnabled ?? false,
  notes: props.plant?.wateringInfo.notes ?? '',
  lastWateredAt: initialLastWatered,
})

// Care notes box grows with the text: one row per line that has words (empty lines
// from pressing Enter don't count), plus one spare row, at least 4
const notesRows = computed(() => {
  const filled = form.value.notes.split('\n').filter((line) => line.trim() !== '')
  return Math.max(4, filled.length + 1)
})

// Live preview: computed values update as the user types
const previewSteps = computed(() => getCareSteps(form.value.notes))
const previewLastWatered = computed(() => {
  if (!form.value.lastWateredAt) return 'Not yet'
  return formatShortDate(new Date(lastWateredToISO(form.value.lastWateredAt)))
})

const photoFile = ref(null)
// What the preview box shows: the new photo, or the plant's current photo
const photoPreview = ref(props.plant?.photoUrl || '')
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

  // Inside / outside: one option must be chosen
  if (form.value.isOutdoor === null) {
    errors.value.isOutdoor = 'Please choose where this plant is'
  }

  // Rain: only asked for outdoor plants, then one option must be chosen
  if (form.value.isOutdoor === true && form.value.rainExposed === null) {
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

// Checks a chosen or pasted file (type and size), then previews it.
// Returns false if the file isn't allowed.
function acceptPhoto(file) {
  delete errors.value.photo

  let message = ''
  if (!PHOTO_TYPES.includes(file.type)) message = 'Photo must be a JPG, PNG or WebP image'
  else if (file.size > MAX_PHOTO_BYTES) message = 'Photo must be 2MB or smaller'

  if (message) {
    errors.value.photo = message
    return false
  }

  // Good file: keep it for submit, then read it so <img> can preview it
  photoFile.value = file
  const reader = new FileReader()
  reader.onload = () => (photoPreview.value = reader.result)
  reader.readAsDataURL(file)
  return true
}

// Runs when the user picks a file with "Choose photo"
function onPhotoChange(event) {
  const file = event.target.files[0]
  delete errors.value.photo
  if (!file) return
  // Bad file: clear the file input
  if (!acceptPhoto(file)) event.target.value = ''
}

// Ctrl+V on the photo box. clipboardData.files holds a copied image
// (e.g. a screenshot), as the same kind of File that "Choose photo" gives.
function onPhotoPaste(event) {
  const file = event.clipboardData.files[0]
  if (!file) {
    errors.value.photo = 'Nothing to paste. Copy an image first.'
    return
  }
  event.preventDefault()
  acceptPhoto(file)
}

// "Undo" button: drop the new photo and go back to the original one (if any)
function clearNewPhoto() {
  photoFile.value = null
  delete errors.value.photo
  photoPreview.value = props.plant?.photoUrl || ''
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
  data.append('isOutdoor', String(form.value.isOutdoor)) // "true" or "false"
  // Indoor plants never get rain, so they are always saved as sheltered
  if (form.value.isOutdoor) {
    data.append('rainExposed', String(form.value.rainExposed))
  } else {
    data.append('rainExposed', 'false')
  }
  data.append('weatherAdjustmentEnabled', String(form.value.weatherAdjustmentEnabled))
  // Drop empty lines so the checklist only gets real steps
  const noteLines = form.value.notes.split('\n').filter((line) => line.trim() !== '')
  data.append('notes', noteLines.join('\n').trim())
  // When editing, only send the date if it changed so the stored time is kept.
  if (!isEdit.value || form.value.lastWateredAt !== initialLastWatered) {
    data.append('lastWateredAt', lastWateredToISO(form.value.lastWateredAt))
  }
  // Only send a photo if a new one was chosen
  if (photoFile.value) data.append('photo', photoFile.value)
  return data
}

// Runs when the form is submitted (Confirm / Save changes button).
// 1. Validate in the browser. 2. Send to the server. 3. Show any server errors.
async function onSubmit() {
  if (saving.value) return
  formError.value = ''
  if (!validate()) {
    formError.value = 'Please fix the highlighted fields.'
    return
  }

  saving.value = true
  try {
    const data = buildFormData()
    const saved = await plantsStore.savePlant(data, isEdit.value ? props.plant.plantId : undefined)
    if (!isEdit.value) burst(saveBtn.value) // celebrate the new plant (only once it really saved)
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
    <!-- Title with Cancel / Save on the same line.
         Buttons are disabled while saving so the form can't be sent twice. -->
    <div class="form-head">
      <div>
        <h1>{{ isEdit ? 'Edit plant' : 'Add a plant' }} <span aria-hidden="true">🌱</span></h1>
        <p class="subtitle">Fill in the details and see how your plant card will look.</p>
      </div>
      <div class="form-actions">
        <button
          type="button"
          class="btn btn-secondary-outline"
          :disabled="saving"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button type="submit" class="btn btn-primary save-btn" :disabled="saving">
          {{ saving ? 'Saving…' : isEdit ? 'Save changes' : '+ Add plant' }}
        </button>
      </div>
    </div>

    <!-- Summary message at the top. role="alert" makes screen readers read it out. -->
    <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

    <!-- Form card (2 columns inside) + live preview card on the right -->
    <div class="form-layout">
      <div class="form-card">
        <!-- Left column: Basics + Location -->
        <div class="form-col">
          <!-- ===== Basics ===== -->
          <section class="form-section">
            <h2><span class="section-icon" aria-hidden="true">🌿</span> Basics</h2>

            <div class="field">
              <label for="plantName"
                >Plant name <span class="req" aria-hidden="true">*</span></label
              >
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
              <p v-if="errors.plantName" id="plantName-error" class="error">
                {{ errors.plantName }}
              </p>
            </div>

            <!-- Photo: small preview + upload box (choose a file, or click the box and paste) -->
            <div class="field">
              <span class="label" id="photo-label"
                >Photo <span class="optional">(optional)</span></span
              >
              <div class="photo-row">
                <div class="preview" :class="{ empty: !photoPreview }">
                  <img v-if="photoPreview" :src="photoPreview" alt="Selected plant photo preview" />
                  <span v-else>No photo</span>
                </div>
                <!-- tabindex="0": clicking the box focuses it, so Ctrl+V pastes into it -->
                <div
                  class="photo-controls"
                  tabindex="0"
                  aria-label="Photo box. Press Ctrl+V to paste a photo."
                  @paste="onPhotoPaste"
                >
                  <div class="photo-buttons">
                    <!-- The real file input is hidden; this label acts as the button and opens it -->
                    <label class="btn btn-secondary-outline" for="photo">{{
                      photoPreview ? 'Change photo' : 'Choose photo'
                    }}</label>
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
                    <button
                      v-if="photoFile"
                      type="button"
                      class="btn btn-secondary-outline"
                      @click="clearNewPhoto"
                    >
                      Undo
                    </button>
                  </div>
                  <!-- Text swaps when the box is focused (see .paste-ready in the CSS) -->
                  <p class="paste-text">
                    <span class="paste-idle">📷 or click here and paste a photo (Ctrl+V)</span>
                    <span class="paste-ready">📋 Ready, press Ctrl+V to paste</span>
                  </p>
                  <p class="hint">JPG, PNG or WebP, up to 2MB</p>
                </div>
              </div>
              <p v-if="errors.photo" id="photo-error" class="error">{{ errors.photo }}</p>
            </div>
          </section>

          <!-- ===== Location ===== -->
          <section class="form-section">
            <h2><span class="section-icon" aria-hidden="true">📍</span> Location</h2>

            <!-- Inside / outside: only outside plants can be looked after by a neighbour -->
            <fieldset
              class="field"
              :aria-describedby="errors.isOutdoor ? 'isOutdoor-error' : undefined"
            >
              <legend>Where is it? <span class="req" aria-hidden="true">*</span></legend>
              <div class="segmented" :class="{ invalid: errors.isOutdoor }">
                <label v-for="opt in PLACE_OPTIONS" :key="String(opt.value)">
                  <input
                    v-model="form.isOutdoor"
                    type="radio"
                    name="isOutdoor"
                    :value="opt.value"
                  />
                  <span
                    ><span aria-hidden="true">{{ opt.value ? '☀️' : '🏠' }}</span>
                    {{ opt.label }}</span
                  >
                </label>
              </div>
              <p class="hint">Neighbours can only care for plants outside your door.</p>
              <p v-if="errors.isOutdoor" id="isOutdoor-error" class="error">
                {{ errors.isOutdoor }}
              </p>
            </fieldset>

            <!-- Where to find it: free text so the helper knows exactly which plant -->
            <div class="field">
              <label for="plantLocation"
                >Where to find it <span class="req" aria-hidden="true">*</span></label
              >
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

            <!-- Rain: only shown for outdoor plants (indoor plants never get rain) -->
            <fieldset
              v-if="form.isOutdoor"
              class="field"
              :aria-describedby="errors.rainExposed ? 'rainExposed-error' : undefined"
            >
              <legend>Rain exposure <span class="req" aria-hidden="true">*</span></legend>
              <div class="segmented" :class="{ invalid: errors.rainExposed }">
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
          </section>
        </div>

        <!-- Right column: Watering + Care (care notes stretch to fill the column) -->
        <div class="form-col fill-col">
          <!-- ===== Watering ===== -->
          <section class="form-section">
            <h2><span class="section-icon" aria-hidden="true">💧</span> Watering</h2>

            <!-- Frequency and amount side by side, unit shown inside the box -->
            <div class="pair">
              <div class="field">
                <label for="frequencyDays"
                  >Water every <span class="req" aria-hidden="true">*</span></label
                >
                <!-- Bootstrap input-group: puts "days" inside the box -->
                <div class="input-group">
                  <input
                    id="frequencyDays"
                    v-model="form.frequencyDays"
                    class="form-control"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    max="30"
                    step="1"
                    placeholder="e.g. 7"
                    required
                    :aria-invalid="!!errors.frequencyDays"
                    :aria-describedby="errors.frequencyDays ? 'frequencyDays-error' : undefined"
                  />
                  <span class="input-group-text">days</span>
                </div>
                <p v-if="errors.frequencyDays" id="frequencyDays-error" class="error">
                  {{ errors.frequencyDays }}
                </p>
              </div>

              <div class="field">
                <label for="amountMl">Amount <span class="req" aria-hidden="true">*</span></label>
                <div class="input-group">
                  <input
                    id="amountMl"
                    v-model="form.amountMl"
                    class="form-control"
                    type="number"
                    inputmode="numeric"
                    min="10"
                    max="5000"
                    step="10"
                    placeholder="e.g. 250"
                    required
                    :aria-invalid="!!errors.amountMl"
                    :aria-describedby="errors.amountMl ? 'amountMl-error' : undefined"
                  />
                  <span class="input-group-text">ml</span>
                </div>
                <p v-if="errors.amountMl" id="amountMl-error" class="error">
                  {{ errors.amountMl }}
                </p>
              </div>
            </div>

            <div class="field">
              <label for="lastWateredAt"
                >Last watered <span class="optional">(optional)</span></label
              >
              <input
                id="lastWateredAt"
                v-model="form.lastWateredAt"
                class="date-input"
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

            <!-- Weather adjustment as a Bootstrap switch (a styled checkbox) -->
            <div class="field">
              <div class="form-check form-switch switch-row">
                <label class="form-check-label" for="weatherAdjustmentEnabled"
                  ><span aria-hidden="true">⛅</span> Adjust for the weather</label
                >
                <input
                  id="weatherAdjustmentEnabled"
                  v-model="form.weatherAdjustmentEnabled"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  aria-describedby="weatherAdjustmentEnabled-hint"
                />
              </div>
              <p id="weatherAdjustmentEnabled-hint" class="hint">
                Skips watering when rain is forecast (only if the spot gets rain), and adds an extra
                watering on very hot days.
              </p>
            </div>
          </section>

          <!-- ===== Care ===== -->
          <section class="form-section care-section">
            <h2><span class="section-icon" aria-hidden="true">🤍</span> Care</h2>

            <div class="field notes-field">
              <label for="notes">Care notes <span class="optional">(optional)</span></label>
              <!-- :rows grows with the number of lines so nothing gets cut off -->
              <textarea
                id="notes"
                v-model="form.notes"
                :rows="notesRows"
                :maxlength="NOTES_MAX"
                placeholder="e.g. Let the top soil dry out first"
                :aria-invalid="!!errors.notes"
                :aria-describedby="errors.notes ? 'notes-error' : 'notes-hint'"
              ></textarea>
              <!-- Helper text and counter on one line -->
              <div class="notes-footer">
                <p id="notes-hint" class="hint">Each line becomes a checklist item</p>
                <p class="hint counter" :class="{ over: form.notes.length >= NOTES_MAX }">
                  {{ form.notes.length }}/{{ NOTES_MAX }}
                </p>
              </div>
              <p v-if="errors.notes" id="notes-error" class="error">{{ errors.notes }}</p>
            </div>
          </section>
        </div>
      </div>

      <!-- ===== Live preview: shows the plant card as the user types ===== -->
      <aside class="preview-card" aria-label="Live preview">
        <div class="preview-head">
          <h2><span class="section-icon" aria-hidden="true">👁️</span> Live Preview</h2>
          <span class="live-tag">Updates as you type</span>
        </div>

        <div class="mini-card">
          <div class="mini-photo">
            <img v-if="photoPreview" :src="photoPreview" alt="" />
            <PlantIcon v-else type="monstera" :size="96" />
            <span v-if="form.isOutdoor !== null" class="place-tag">
              {{ form.isOutdoor ? '☀️ Outdoor' : '🏠 Indoor' }}
            </span>
          </div>

          <div class="mini-body">
            <h3>{{ form.plantName.trim() || 'Your plant' }}</h3>

            <div class="mini-facts">
              <div class="mini-fact">
                <span aria-hidden="true">💧</span>
                <div>
                  <small>Water every</small>
                  <strong>{{ form.frequencyDays || '–' }} days</strong>
                </div>
              </div>
              <div class="mini-fact">
                <span aria-hidden="true">🥛</span>
                <div>
                  <small>Amount</small>
                  <strong>{{ form.amountMl || '–' }} ml</strong>
                </div>
              </div>
            </div>

            <div class="mini-row">
              <div>
                <small>🗓️ Last watered</small>
                <strong>{{ previewLastWatered }}</strong>
              </div>
              <div>
                <small>⛅ Weather adjust</small>
                <strong>{{ form.weatherAdjustmentEnabled ? 'On' : 'Off' }}</strong>
              </div>
            </div>

            <div class="mini-notes">
              <h4>🤍 Care notes</h4>
              <!-- Fills the space left in the card; scrolls when the list is longer -->
              <div v-if="previewSteps.length" class="steps-scroll">
                <ul>
                  <li v-for="step in previewSteps" :key="step">
                    <span class="box" aria-hidden="true"></span>{{ step }}
                  </li>
                </ul>
              </div>
              <p v-else class="hint">Your care notes will show here as a checklist.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </form>
</template>

<style scoped>
/* Sizes: text 18 / 15 / 13px, spacing in steps of 8px */
.plant-form {
  --text-dark: #1f3a2b;
  --text-soft: #4d5b52;
  --line: #d5ded8;
  display: grid;
  gap: 24px;
  font-size: 15px;
  color: var(--text-dark);
}

/* Form card + preview card: stacked, then side by side on wide screens */
.form-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: stretch; /* form card and preview card the same height */
}

@media (min-width: 1200px) {
  .form-layout {
    grid-template-columns: minmax(0, 1fr) 340px;
  }
}

/* One big card holding both form columns */
.form-card {
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
  min-width: 0;
  padding: 24px;
  border: 1px solid #e1e8e3;
  border-radius: 16px;
  background: #fff;
}

/* Each column: its sections stacked */
.form-col {
  display: grid;
  gap: 32px; /* between sections */
  align-content: start;
  min-width: 0;
}

/* Two columns with a thin line between them */
@media (min-width: 860px) {
  .form-card {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .form-col + .form-col {
    padding-left: 32px;
    border-left: 1px solid var(--line);
  }
}

/* Phones/tablets: line on top instead of on the left */
@media (max-width: 859px) {
  .form-col + .form-col {
    padding-top: 32px;
    border-top: 1px solid var(--line);
  }
}

/* Red * on required fields */
.req {
  color: var(--danger);
}

.subtitle {
  margin: 4px 0 0;
  color: var(--text-soft);
}

/* Each section: heading + its fields, 16px apart */
.form-section {
  display: grid;
  gap: 16px;
}

.form-section + .form-section {
  padding-top: 32px;
  border-top: 1px solid var(--line);
}

/* Section title with an icon in front */
.form-section h2,
.preview-head h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-heading);
}

.section-icon {
  font-size: 20px;
}

.field {
  display: grid;
  gap: 8px;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

/* One label style for every field (legend included) */
label,
legend,
.label {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-dark);
}

/* Bootstrap makes legend big and floated; reset it to look like a label */
legend {
  float: none;
  width: auto;
  padding: 0;
  margin-bottom: 8px;
  line-height: inherit;
}

.optional {
  color: var(--text-soft);
  font-weight: 400;
}

input[type='text'],
input[type='number'],
input[type='date'],
textarea {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--text-dark);
  font: inherit;
}

textarea {
  resize: vertical;
  line-height: 1.5;
}

input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: var(--accent);
  box-shadow: none;
}

[aria-invalid='true'] {
  border-color: var(--danger) !important;
}

.error {
  margin: 0;
  color: var(--danger);
  font-size: 13px;
  font-weight: 500;
}

.error::before {
  content: '⚠ ';
}

.hint {
  margin: 0;
  color: var(--text-soft);
  font-size: 13px;
}

.form-error {
  margin: 0;
  padding: 8px 16px;
  border-radius: 8px;
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: 600;
}

/* Two fields side by side (Water every + Amount) */
.pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  /* Keep both boxes on the same line, even when only one has an error under it */
  align-items: start;
}

/* Lighter example text, so it doesn't look like a typed value */
.form-control::placeholder {
  color: #9aa79e;
}

/* Number + unit on one line: the input shares the row instead of taking 100% */
.input-group {
  flex-wrap: nowrap;
}

.input-group input {
  width: auto;
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 8px 0 0 8px;
}

/* Unit box ("days" / "ml") joined to the right of the input */
.input-group-text {
  border: 1px solid var(--line);
  border-left: 0;
  border-radius: 0 8px 8px 0;
  background: #f3f7f4;
  color: var(--text-soft);
  font-size: 15px;
}

.date-input {
  max-width: 220px;
}

/* Care notes: helper on the left, counter on the right */
.notes-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.counter {
  flex-shrink: 0;
}

.counter.over {
  color: var(--danger);
}

/* Photo: small square thumbnail with the buttons beside it */
.photo-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview {
  width: 136px;
  height: 136px;
  position: relative; /* so the photo can be pinned inside */
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 12px;
  background: #f3f7f4;
}

.preview.empty {
  border: 1px dashed var(--line);
  color: var(--text-soft);
  font-size: 13px;
}

/* Pinned to all 4 edges of the frame (inset: 0), then contain shows
   the whole photo inside it, no cropping */
.preview img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Upload box: dashed area filling the space beside the photo */
.photo-controls {
  flex: 1;
  min-width: 0;
  align-self: stretch; /* same height as the photo beside it */
  display: grid;
  align-content: center;
  gap: 4px;
  padding: 12px 16px;
  border: 1.5px dashed var(--line);
  border-radius: 12px;
  background: #fafcfb;
  cursor: pointer;
}

.photo-controls:hover {
  border-color: var(--accent);
}

/* Focused (clicked) box: green, ready for Ctrl+V */
.photo-controls:focus {
  outline: none;
  border-color: var(--accent);
  border-style: solid;
  background: var(--accent-soft);
}

.paste-text {
  margin: 0;
  color: var(--text-dark);
  font-size: 13px;
  font-weight: 600;
}

/* Only one message shows: "click here…" normally, "Ready…" when focused */
.paste-ready {
  display: none;
  color: var(--accent);
}

.photo-controls:focus .paste-idle {
  display: none;
}

.photo-controls:focus .paste-ready {
  display: inline;
}

.photo-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

/* Buttons: same height, no glow */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: none;
}

/* Secondary: white with a border, so it clearly looks clickable */
.btn-secondary-outline {
  border: 1.5px solid var(--line);
  background: #fff;
  color: var(--text-dark);
  cursor: pointer;
}

.btn-secondary-outline:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* flat Save changes button */
.save-btn.btn-primary,
.save-btn.btn-primary:hover {
  box-shadow: none;
}
/* Leaf Confirm button: the .btn rule above (same specificity, loaded after main.css)
   would square off the corners and remove the shadow, so put the leaf shape back. */
.btn.btn-leaf {
  padding: 0 1.4rem;
  border-radius: 2rem 0.3rem 2rem 0.3rem;
  box-shadow: 0 4px 10px rgba(22, 163, 74, 0.35);
}
  box-shadow: 0 8px 16px rgba(22, 163, 74, 0.4);
}
  box-shadow: none;
}

/* Weather switch: label on the left, switch on the right */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
  margin: 0;
  padding: 0;
}

.switch-row .form-check-input {
  float: none;
  width: 2.75em;
  height: 1.5em;
  margin: 0;
  cursor: pointer;
}

.switch-row .form-check-input:checked {
  border-color: var(--accent);
  background-color: var(--accent);
}

.switch-row .form-check-input:focus {
  box-shadow: none;
}

.switch-row .form-check-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Segmented radio buttons */
.segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

/* label > span = only the pill itself, not the icon span inside it */
.segmented label > span {
  display: inline-flex;
  align-items: center;
  gap: 8px; /* space between icon and text */
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--text-dark);
  white-space: nowrap;
}

.segmented.invalid label > span {
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

/* Title on the left, Cancel / Save on the right */
.form-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.form-head h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: var(--color-heading);
}

.form-actions {
  display: flex;
  gap: 8px;
}

/* Right column: flex column so the Care section can take the leftover height,
   then the notes box grows to fill it (no empty gap at the bottom) */
.form-col.fill-col {
  display: flex;
  flex-direction: column;
}

/* ===== Live preview card ===== */
/* Flex columns all the way down, so the steps list gets the leftover height */
.preview-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border: 1px solid #e1e8e3;
  border-radius: 16px;
  background: #fff;
}

.preview-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.live-tag {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}

/* The pretend plant card */
.mini-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e1e8e3;
  border-radius: 16px;
  box-shadow: var(--shadow);
}

.mini-photo {
  position: relative;
  height: 180px;
  display: grid;
  place-items: center;
  background: #f3f7f4;
}

/* Pinned to the frame's 4 edges, so a tall photo can't grow past 180px
   and cover the name below (same fix as the small photo preview) */
.mini-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.place-tag {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
}

.mini-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.mini-photo {
  flex-shrink: 0; /* photo keeps its 180px */
}

/* Care notes take the rest of the card */
.mini-notes {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* The list is pinned inside this box (absolute), so it never makes the
   card taller: it fills the space and scrolls when there are more steps */
.steps-scroll {
  position: relative;
  flex: 1;
  min-height: 160px;
}

.steps-scroll ul {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding-right: 4px;
  align-content: start; /* steps keep their own height, spare space stays at the bottom */
}

.mini-body h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-heading);
  overflow-wrap: anywhere;
}

.mini-body small {
  display: block;
  color: var(--text-soft);
  font-size: 12px;
}

.mini-body strong {
  font-size: 15px;
}

.mini-facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mini-fact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  background: #f3f7f4;
}

.mini-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.mini-notes h4 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
}

.mini-notes ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mini-notes li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f3f7f4;
  font-size: 14px;
  overflow-wrap: anywhere;
}

/* Empty tick box in front of each step */
.mini-notes .box {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  border: 1.5px solid var(--text-soft);
  border-radius: 4px;
}

/* flex: 1 = take the spare space only (starts at normal size, never forces the card taller) */
.care-section,
.notes-field {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.care-section {
  gap: 16px;
}

.notes-field {
  gap: 8px;
}

/* Grows up to about 10 lines, then scrolls inside so the card stays balanced */
.notes-field textarea {
  flex: 1;
  max-height: 320px;
  overflow-y: auto;
}

/* Phones: stack the pair, full-width buttons */
@media (max-width: 480px) {
  .pair {
    grid-template-columns: 1fr;
  }

  .form-card {
    padding: 16px;
  }

  .form-actions {
    width: 100%;
  }

  .form-actions .btn {
    flex: 1;
  }
}
</style>
