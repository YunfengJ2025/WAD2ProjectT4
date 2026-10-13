<script setup>
import { computed, reactive, ref, nextTick } from 'vue'
import { createPlant, updatePlant, photoSrc } from '@/api/plants'
import { toDateInputValue } from '@/utils/wateringStatus'

// Pass an existing plant to edit it; leave it out to add a new one.
const props = defineProps({
  plant: { type: Object, default: null },
})
const emit = defineEmits(['saved', 'cancel'])

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const NOTES_MAX = 200
const SUNLIGHT_OPTIONS = [
  { value: 'full', label: 'Full sun' },
  { value: 'partial', label: 'Partial sun' },
  { value: 'shade', label: 'Shade' },
]
const PLACEMENT_OPTIONS = [
  { value: 'balcony', label: 'Balcony' },
  { value: 'corridor', label: 'Corridor' },
  { value: 'indoor', label: 'Indoor' },
]
// Field order here is the order we scroll to the first error.
const FIELDS = ['plantName', 'photo', 'frequencyDays', 'sunlight', 'plantLocation', 'notes', 'lastWateredAt']

const isEdit = computed(() => !!props.plant)
const today = toDateInputValue(new Date())
const initialLastWatered = props.plant
  ? props.plant.lastWateredAt
    ? toDateInputValue(props.plant.lastWateredAt)
    : ''
  : today

const form = reactive({
  plantName: props.plant?.plantName ?? '',
  frequencyDays: props.plant ? String(props.plant.wateringInfo.frequencyDays) : '',
  sunlight: props.plant?.sunlight ?? '',
  plantLocation: props.plant?.plantLocation ?? '',
  notes: props.plant?.wateringInfo.notes ?? '',
  lastWateredAt: initialLastWatered,
})
const photoFile = ref(null)
const photoPreview = ref(props.plant?.photoUrl ? photoSrc(props.plant.photoUrl) : '')
const photoInput = ref(null)

const errors = reactive({})
const touched = reactive({})
const formError = ref('')
const saving = ref(false)

const validators = {
  plantName: () => {
    const name = form.plantName.trim()
    if (!name) return 'Please enter a plant name'
    if (name.length > 100) return 'Plant name cannot exceed 100 characters'
  },
  frequencyDays: () => {
    const raw = String(form.frequencyDays).trim()
    if (!raw) return 'Please enter how often to water'
    const days = Number(raw)
    if (!/^\d+$/.test(raw) || days < 1 || days > 30) {
      return 'Enter a whole number of days from 1 to 30'
    }
  },
  sunlight: () => (form.sunlight ? undefined : 'Please choose how much sun it needs'),
  plantLocation: () => (form.plantLocation ? undefined : 'Please choose where the plant is kept'),
  notes: () =>
    form.notes.length > NOTES_MAX ? `Notes cannot exceed ${NOTES_MAX} characters` : undefined,
  lastWateredAt: () =>
    form.lastWateredAt && form.lastWateredAt > today
      ? 'Last watered date cannot be in the future'
      : undefined,
  // The photo is checked when chosen; this keeps any server error until a new file is picked.
  photo: () => errors.photo,
}

function validate(field) {
  const message = validators[field]()
  if (message) errors[field] = message
  else delete errors[field]
  return !message
}

// On blur: mark the field touched and check it.
function touch(field) {
  touched[field] = true
  validate(field)
}

// While typing, only re-check fields that already showed an error or were left.
function recheck(field) {
  if (touched[field]) validate(field)
}

// Radio groups count as "blurred" once focus leaves the whole group.
function onGroupFocusOut(field, event) {
  if (!event.currentTarget.contains(event.relatedTarget)) touch(field)
}

function onPhotoChange(event) {
  const file = event.target.files[0]
  delete errors.photo
  if (!file) return

  let message = ''
  if (!PHOTO_TYPES.includes(file.type)) message = 'Photo must be a JPG, PNG or WebP image'
  else if (file.size > MAX_PHOTO_BYTES) message = 'Photo must be 2MB or smaller'

  if (message) {
    errors.photo = message
    event.target.value = ''
    return
  }

  photoFile.value = file
  const reader = new FileReader()
  reader.onload = () => (photoPreview.value = reader.result)
  reader.readAsDataURL(file)
}

function clearNewPhoto() {
  photoFile.value = null
  delete errors.photo
  photoPreview.value = props.plant?.photoUrl ? photoSrc(props.plant.photoUrl) : ''
  if (photoInput.value) photoInput.value.value = ''
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
  data.append('plantName', form.plantName.trim())
  data.append('frequencyDays', String(form.frequencyDays).trim())
  data.append('sunlight', form.sunlight)
  data.append('plantLocation', form.plantLocation)
  data.append('notes', form.notes.trim())
  // When editing, only send the date if it changed so the stored time is kept.
  if (!isEdit.value || form.lastWateredAt !== initialLastWatered) {
    data.append('lastWateredAt', lastWateredToISO(form.lastWateredAt))
  }
  if (photoFile.value) data.append('photo', photoFile.value)
  return data
}

async function focusFirstError() {
  await nextTick()
  const first = FIELDS.find((f) => errors[f])
  document.querySelector(`[data-field="${first}"]`)?.focus()
}

async function onSubmit() {
  formError.value = ''
  FIELDS.forEach((f) => (touched[f] = true))
  const allValid = FIELDS.map(validate).every(Boolean)
  if (!allValid) {
    formError.value = 'Please fix the highlighted fields.'
    return focusFirstError()
  }

  saving.value = true
  try {
    const data = buildFormData()
    const saved = isEdit.value
      ? await updatePlant(props.plant.plantId, data)
      : await createPlant(data)
    emit('saved', saved)
  } catch (err) {
    Object.assign(errors, err.errors)
    formError.value = err.message
    if (Object.keys(err.errors || {}).length) focusFirstError()
  } finally {
    saving.value = false
  }
}

const fieldAttrs = (field) => ({
  'data-field': field,
  'aria-invalid': errors[field] ? 'true' : 'false',
  'aria-describedby': errors[field] ? `${field}-error` : undefined,
})
</script>

<template>
  <form class="plant-form" novalidate @submit.prevent="onSubmit">
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
        v-bind="fieldAttrs('plantName')"
        @blur="touch('plantName')"
        @input="recheck('plantName')"
      />
      <p v-if="errors.plantName" id="plantName-error" class="error">{{ errors.plantName }}</p>
    </div>

    <div class="field">
      <span class="label" id="photo-label">Photo</span>
      <div class="photo-row">
        <div class="preview" :class="{ empty: !photoPreview }">
          <img v-if="photoPreview" :src="photoPreview" alt="Selected plant photo preview" />
          <span v-else>No photo</span>
        </div>
        <div class="photo-controls">
          <label class="btn" for="photo">{{ photoPreview ? 'Change photo' : 'Choose photo' }}</label>
          <input
            id="photo"
            ref="photoInput"
            class="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-labelledby="photo-label"
            v-bind="fieldAttrs('photo')"
            @change="onPhotoChange"
          />
          <button v-if="photoFile" type="button" class="btn" @click="clearNewPhoto">
            Undo
          </button>
          <p class="hint">JPG, PNG or WebP, up to 2MB.</p>
        </div>
      </div>
      <p v-if="errors.photo" id="photo-error" class="error">{{ errors.photo }}</p>
    </div>

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
        v-bind="fieldAttrs('frequencyDays')"
        @blur="touch('frequencyDays')"
        @input="recheck('frequencyDays')"
      />
      <p v-if="errors.frequencyDays" id="frequencyDays-error" class="error">
        {{ errors.frequencyDays }}
      </p>
    </div>

    <fieldset
      class="field"
      :aria-describedby="errors.sunlight ? 'sunlight-error' : undefined"
      @focusout="onGroupFocusOut('sunlight', $event)"
    >
      <legend>Sunlight needs <span class="req" aria-hidden="true">*</span></legend>
      <div class="segmented" :class="{ invalid: errors.sunlight }">
        <label v-for="(opt, i) in SUNLIGHT_OPTIONS" :key="opt.value">
          <input
            v-model="form.sunlight"
            type="radio"
            name="sunlight"
            :value="opt.value"
            :data-field="i === 0 ? 'sunlight' : undefined"
            @change="validate('sunlight')"
          />
          <span>{{ opt.label }}</span>
        </label>
      </div>
      <p v-if="errors.sunlight" id="sunlight-error" class="error">{{ errors.sunlight }}</p>
    </fieldset>

    <fieldset
      class="field"
      :aria-describedby="errors.plantLocation ? 'plantLocation-error' : undefined"
      @focusout="onGroupFocusOut('plantLocation', $event)"
    >
      <legend>Placement <span class="req" aria-hidden="true">*</span></legend>
      <div class="segmented" :class="{ invalid: errors.plantLocation }">
        <label v-for="(opt, i) in PLACEMENT_OPTIONS" :key="opt.value">
          <input
            v-model="form.plantLocation"
            type="radio"
            name="plantLocation"
            :value="opt.value"
            :data-field="i === 0 ? 'plantLocation' : undefined"
            @change="validate('plantLocation')"
          />
          <span>{{ opt.label }}</span>
        </label>
      </div>
      <p v-if="errors.plantLocation" id="plantLocation-error" class="error">
        {{ errors.plantLocation }}
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
        v-bind="fieldAttrs('notes')"
        @blur="touch('notes')"
        @input="recheck('notes')"
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
        v-bind="fieldAttrs('lastWateredAt')"
        @blur="touch('lastWateredAt')"
        @input="recheck('lastWateredAt')"
      />
      <p class="hint">Leave blank if it hasn't been watered yet.</p>
      <p v-if="errors.lastWateredAt" id="lastWateredAt-error" class="error">
        {{ errors.lastWateredAt }}
      </p>
    </div>

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
