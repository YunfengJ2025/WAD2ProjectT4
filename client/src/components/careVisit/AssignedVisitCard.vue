<script setup>
// Component: summarizes an accepted visit and collects required care steps, notes, and proof photos.
import { computed, reactive, ref } from 'vue'
import { useScrollLock } from '@/composables/useScrollLock'
import plantPlaceholder from '@/assets/plant.png'
// Care checklist (Carolyn): same helper as the owner's plant page, so both split
// the steps the same way (one per line). Uses this request's instructions, else the plant's notes
import { getRequestSteps } from '@/utils/careSteps'
import { singaporeDate } from '@/utils/singaporeDate'
// (Carolyn) Fix 5: shared date / token / water / status wording for all visit cards
import {
  formatDate as date,
  formatLongDate as longDate,
  statusIcon,
  statusLabel,
  tokenText,
  waterSourceLabel,
  ownerAddress,
} from '@/utils/visitFormat'

const props = defineProps({
  visit: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  optingOut: { type: Boolean, default: false },
})
// Keep visit release as a separate action from submitting proof.
const emit = defineEmits(['submit-proof', 'opt-out'])

const actions = reactive({})
const photos = reactive({})
const error = ref('')
const detailsOpen = ref(false)
useScrollLock(detailsOpen) // the page behind the pop-up can't scroll while it's open
// Short date for the phone footer chip, e.g. "10 Nov"
function shortDate(value) {
  return new Date(value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}
// Normalize the visit's plant items, including the older one-plant response shape.
const items = props.visit.items?.length
  ? props.visit.items
  : (props.visit.plants || [props.visit.plant]).filter(Boolean).map((plant) => ({ plant }))
const plants = items.map((item) => item.plant).filter(Boolean)
// Match the upload control to the server's Singapore calendar-day policy.
const canCompleteToday = computed(
  () => singaporeDate(props.visit.visitDate) === singaporeDate(new Date()),
)

// Card face: plant names first, a "Due today / Tomorrow" label, water and tokens
const plantNames = plants.map((plant) => plant.plantName).filter(Boolean)
const title = plantNames.length
  ? plantNames.slice(0, 2).join(' & ') +
    (plantNames.length > 2 ? ` +${plantNames.length - 2} more` : '')
  : `${items.length} unnamed plant${items.length === 1 ? '' : 's'}`
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const dayLabel = computed(() => {
  const day = singaporeDate(props.visit.visitDate)
  if (day === singaporeDate(new Date())) return 'Due today'
  if (day === singaporeDate(tomorrow)) return 'Tomorrow'
  // (Carolyn) later visits: "In 6 days" (both dates are "YYYY-MM-DD", so subtract whole days)
  const daysAway = Math.round((new Date(day) - new Date(singaporeDate(new Date()))) / 86400000)
  if (daysAway > 1) return `In ${daysAway} days`
  return ''
})
// (Carolyn) symbol in front of the day badge: ⚠ today (act now), 🕒 coming up
const dayIcon = computed(() => (canCompleteToday.value ? '⚠' : '🕒'))
// (Carolyn) total water for this visit, e.g. 700 (ml) across all plants
const totalWater = items.reduce((sum, item) => sum + (Number(item.amountToWater) || 0), 0)
const waterSource = waterSourceLabel(props.visit.request?.waterSource)

// (Carolyn) Google Maps search link for the block + postal code (no unit number, Maps can't use it).
// encodeURIComponent makes spaces and # safe inside a link.
const mapsUrl = computed(() => {
  const owner = props.visit.owner
  if (!owner || (!owner.block && !owner.postalCode)) return ''
  const place = [
    owner.block ? `Blk ${owner.block}` : '',
    owner.postalCode ? `Singapore ${owner.postalCode}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
})
const tokens = props.visit.request?.tokenReward // may be missing on old visits

// Care checklist (Carolyn): for each plant, its care steps and the steps the sitter ticks.
// careSteps[plantId] = ["Water the soil", ...]   ticked[plantId] = steps ticked (v-model)
const careSteps = {}
const ticked = reactive({})
for (const item of items) {
  careSteps[item.plantId] = getRequestSteps(item)
  ticked[item.plantId] = []
}

// (Carolyn) Complete visit, step 4: check each proof photo before it's kept,
// show a preview, and count how many plants have one
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 2 * 1024 * 1024 // 2 MB, same limit as the server
const photoErrors = reactive({}) // e.g. { 5: 'Photo must be 2 MB or smaller' }
const previews = reactive({}) // e.g. { 5: 'data:image/jpeg;base64,…' } for the <img>

// Validate one selected image, keep its preview, and report issues for that plant.
function choosePhoto(event, plantId) {
  const file = event.target.files[0]
  delete photoErrors[plantId]
  if (!file) return
  if (!PHOTO_TYPES.includes(file.type)) {
    photoErrors[plantId] = 'That file type won’t work. Use a JPG, PNG or WebP photo.'
  } else if (file.size > MAX_PHOTO_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1)
    photoErrors[plantId] = `That photo is ${sizeMb} MB. Please use one that is 2 MB or smaller.`
  }
  if (photoErrors[plantId]) {
    event.target.value = '' // so choosing the same file again still triggers @change
    return
  }
  photos[plantId] = file
  // FileReader turns the file into a data: link the <img> can show
  const reader = new FileReader()
  reader.onload = () => (previews[plantId] = reader.result)
  reader.readAsDataURL(file)
}

const photoCount = computed(() => items.filter((item) => photos[item.plantId]).length)
const allPhotosAdded = computed(() => photoCount.value === items.length)

// (Carolyn) "Ready to submit" list next to the Submit button, so sitters see WHY it's disabled:
// visit day, every care step ticked, a photo for every plant
const totalSteps = computed(() =>
  items.reduce((sum, item) => sum + careSteps[item.plantId].length, 0),
)
const tickedSteps = computed(() =>
  items.reduce((sum, item) => sum + ticked[item.plantId].length, 0),
)
const allStepsTicked = computed(() => tickedSteps.value >= totalSteps.value)
const readyToSubmit = computed(
  () => canCompleteToday.value && allStepsTicked.value && allPhotosAdded.value,
)

// Validate visit-day eligibility and per-plant requirements before emitting proof data.
function submit() {
  error.value = ''
  if (!canCompleteToday.value) {
    error.value = 'You can only complete this visit on its scheduled date.'
    return
  }
  if (items.some((item) => !photos[item.plantId])) {
    error.value = 'Choose a proof photo for each plant.'
    return
  }
  // Care checklist (Carolyn): every step must be ticked before submitting
  const unfinished = items.find(
    (item) => ticked[item.plantId].length < careSteps[item.plantId].length,
  )
  if (unfinished) {
    error.value = `Tick every care step for ${unfinished.plant?.plantName || 'each plant'} first.`
    return
  }
  emit('submit-proof', {
    visit: props.visit,
    // Care checklist (Carolyn): the note is optional now (the checklist shows what was done).
    // It is saved in the existing "action" field, which the server requires, so a blank
    // note is sent as "Care done".
    actions: Object.fromEntries(
      items.map((item) => [item.plantId, actions[item.plantId]?.trim() || 'Care done']),
    ),
    photos: Object.fromEntries(items.map((item) => [item.plantId, photos[item.plantId]])),
    completedSteps: ticked, // Care checklist (Carolyn): e.g. { 5: ["Water the soil"] }
  })
}
</script>

<template>
  <article class="visit-card" :class="`is-${visit.status}`">
    <!--  card face: photos + plant names, day badge, water/tokens, one clear action -->
    <div class="visit-heading">
      <!-- Up to 3 plant photos, overlapping -->
      <div class="thumbs" aria-hidden="true">
        <img
          v-for="plant in plants.slice(0, 3)"
          :key="plant.plantId"
          :src="plant.photoUrl || plantPlaceholder"
          alt=""
          @error="$event.target.src = plantPlaceholder"
        />
        <span v-if="plants.length > 2" class="mobile-plant-count">+{{ plants.length - 2 }} more</span>
      </div>
      <div class="heading-text">
        <h3 :title="plantNames.join(', ')">{{ title }}</h3>
        <p>{{ date(visit.visitDate) }}</p>
      </div>
      <span v-if="dayLabel" class="day-badge" :class="{ today: canCompleteToday }">
        <span aria-hidden="true">{{ dayIcon }}</span> {{ dayLabel }}
      </span>
      <span v-else class="status">
        <span aria-hidden="true">{{ statusIcon(visit.status) }}</span>
        {{ statusLabel(visit.status) }}
      </span>
    </div>
    <!-- (Carolyn) what the visit involves, so the card isn't empty -->
    <ul class="visit-facts">
      <li>💧 {{ waterSource }}</li>
      <li v-if="totalWater">💦 {{ totalWater }} ml</li>
      <li v-if="totalSteps">📋 {{ totalSteps }} care step{{ totalSteps === 1 ? '' : 's' }}</li>
      <li v-if="tokens">🪙 {{ tokenText(tokens) }}</li>
    </ul>
    <p v-if="visit.owner" class="owner-address">📍 {{ ownerAddress(visit.owner) }}</p>
    <!-- One clear action: green "Start visit" on the day, outline "View visit" otherwise -->
    <button
      type="button"
      class="btn btn-sm visit-action"
      :class="canCompleteToday ? 'btn-primary' : 'btn-outline-secondary'"
      @click="detailsOpen = true"
    >
      {{ canCompleteToday ? 'Start visit' : 'View visit' }}
    </button>
    <Teleport to="body">
      <div
        v-if="detailsOpen"
        class="modal-backdrop"
        role="presentation"
        @click.self="detailsOpen = false"
      >
        <section
          class="details-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="`Visit ${visit.visitId} details`"
          @keydown.esc="detailsOpen = false"
        >
          <!-- (Carolyn) Complete visit, step 1: action title + date, plant count, tokens -->
          <div class="modal-heading">
            <div>
              <h3>{{ canCompleteToday ? 'Complete visit' : 'Upcoming visit' }}</h3>
              <ul class="visit-facts modal-facts">
                <li>🗓️ {{ longDate(visit.visitDate) }}</li>
                <li>🌱 {{ items.length }} plant{{ items.length === 1 ? '' : 's' }}</li>
                <li v-if="tokens">🪙 {{ tokenText(tokens) }}</li>
                <li v-if="dayLabel" class="day-badge" :class="{ today: canCompleteToday }">
                  <span aria-hidden="true">{{ dayIcon }}</span> {{ dayLabel }}
                </li>
              </ul>
            </div>
            <button
              type="button"
              class="modal-close"
              aria-label="Close details"
              @click="detailsOpen = false"
            >
              ×
            </button>
          </div>
          <!-- (Carolyn) Complete visit, step 2: where to go (address + Maps) and the water source, shown once -->
          <div class="where-box">
            <div class="where-row">
              <span class="where-icon" aria-hidden="true">📍</span>
              <div class="where-text">
                <small>Address</small>
                <strong>{{
                  visit.owner ? ownerAddress(visit.owner) : 'Address not available'
                }}</strong>
              </div>
              <a
                v-if="mapsUrl"
                :href="mapsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="maps-link"
              >
                Open in Maps ↗
              </a>
            </div>
            <div class="where-row">
              <span class="where-icon" aria-hidden="true">💧</span>
              <div class="where-text">
                <small>Water source</small>
                <strong>{{ waterSource }}</strong>
              </div>
            </div>
          </div>
          <p v-if="!canCompleteToday" class="date-restriction" role="status">
            Proof photos and care notes can only be submitted on {{ date(visit.visitDate) }}.
          </p>
          <!-- The owner's note for the whole request -->
          <p v-if="visit.request?.note" class="owner-note">
            <strong>Note from the owner:</strong> {{ visit.request.note }}
          </p>
          <form class="visit-form" @submit.prevent="submit">
            <!-- fieldset :disabled = every input is locked while the proof is being sent -->
            <fieldset class="form-lock" :disabled="busy">
              <div class="plant-care-list">
                <!-- (Carolyn) Complete visit, step 3: one card per plant, bigger photo + name + water -->
                <section v-for="item in items" :key="item.plantId" class="plant-care-card">
                  <div class="plant-head">
                    <img
                      class="plant-photo"
                      :src="item.plant?.photoUrl || plantPlaceholder"
                      :alt="item.plant?.plantName || 'Plant photo'"
                      @error="$event.target.src = plantPlaceholder"
                    />
                    <div class="plant-head-text">
                      <strong>{{ item.plant?.plantName || 'Unnamed plant' }}</strong>
                      <span>💧 Water {{ item.amountToWater ?? 0 }} ml</span>
                    </div>
                  </div>
                  <!-- Care checklist (Carolyn): plain text only when there is no checklist (avoids showing the steps twice) -->
                  <p v-if="item.careInstructions && !careSteps[item.plantId].length">
                    {{ item.careInstructions }}
                  </p>
                  <!-- Care checklist (Carolyn): the owner's instructions as tick boxes (all required to submit) -->
                  <fieldset v-if="careSteps[item.plantId].length" class="care-checklist">
                    <legend>
                      Care checklist
                      <small
                        >{{ ticked[item.plantId].length }} of
                        {{ careSteps[item.plantId].length }} done</small
                      >
                    </legend>
                    <label v-for="step in careSteps[item.plantId]" :key="step" class="step">
                      <input
                        v-model="ticked[item.plantId]"
                        type="checkbox"
                        :value="step"
                        :disabled="!canCompleteToday"
                      />
                      <span>{{ step }}</span>
                    </label>
                  </fieldset>
                  <!-- (Carolyn) Complete visit, step 4: required proof photo -->
                  <div class="proof-block">
                    <span class="block-label"
                      >Proof photo <span class="req" aria-hidden="true">*</span></span
                    >
                    <div
                      class="proof-upload"
                      :class="{
                        'has-photo': photos[item.plantId],
                        invalid: photoErrors[item.plantId],
                      }"
                    >
                      <img
                        v-if="previews[item.plantId]"
                        :src="previews[item.plantId]"
                        alt="Proof photo preview"
                        class="proof-preview"
                      />
                      <span v-else class="proof-empty" aria-hidden="true">📷</span>
                      <div class="proof-actions">
                        <!-- The real file input is hidden; this label is the styled button that opens it.
                     capture="environment" = phones open the back camera straight away -->
                        <label
                          :for="`proof-${visit.visitId}-${item.plantId}`"
                          class="upload-btn"
                          :class="{ disabled: !canCompleteToday }"
                        >
                          {{ photos[item.plantId] ? 'Replace photo' : 'Add photo' }}
                        </label>
                        <input
                          :id="`proof-${visit.visitId}-${item.plantId}`"
                          class="visually-hidden"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          :disabled="!canCompleteToday"
                          :aria-invalid="!!photoErrors[item.plantId]"
                          @change="choosePhoto($event, item.plantId)"
                        />
                        <small class="proof-hint">
                          {{
                            photos[item.plantId]
                              ? `✓ ${photos[item.plantId].name}`
                              : 'JPG, PNG or WebP, up to 2 MB'
                          }}
                        </small>
                      </div>
                    </div>
                    <p v-if="photoErrors[item.plantId]" class="error" role="alert">
                      ⚠ {{ photoErrors[item.plantId] }}
                    </p>
                  </div>
                  <!-- (Carolyn) Complete visit, step 5: optional note (saved in the same "action" field) -->
                  <label class="note-field">
                    <span class="block-label"
                      >Note for the owner <small class="optional">(optional)</small></span
                    >
                    <textarea
                      v-model="actions[item.plantId]"
                      rows="2"
                      maxlength="100"
                      placeholder="e.g. Soil was very dry, leaves look healthy"
                      :disabled="!canCompleteToday"
                    ></textarea>
                    <small class="note-count">{{ (actions[item.plantId] || '').length }}/100</small>
                  </label>
                </section>
              </div>
            </fieldset>
            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <!-- Above the footer, so the footer is always the last thing, pinned to the bottom -->
            <RouterLink
              class="visit-page-link"
              :to="{ name: 'visit-detail', params: { visitId: visit.visitId } }"
            >
              Open the full visit page →
            </RouterLink>
            <!-- (Carolyn) Complete visit, step 6: quiet opt-out on the left, main submit on the right.
           Opt-out still goes through the page's "are you sure?" box (CareVisitsView). -->
            <div class="modal-foot">
              <!-- (Carolyn) what's still needed before Submit works (✓ when done, ○ when not).
                   Each chip has a full label and a short one for phones (CSS shows one). -->
              <ul class="ready-list" aria-live="polite" aria-label="Before you submit">
                <li :class="{ done: canCompleteToday }">
                  <span class="mark" aria-hidden="true">{{ canCompleteToday ? '✓' : '○' }}</span>
                  <span class="chip-long">{{
                    canCompleteToday
                      ? 'It’s the visit day'
                      : `Opens on ${longDate(visit.visitDate)}`
                  }}</span>
                  <span class="chip-short">{{
                    canCompleteToday ? 'Visit day' : `Opens ${shortDate(visit.visitDate)}`
                  }}</span>
                </li>
                <li v-if="totalSteps" :class="{ done: allStepsTicked }">
                  <span class="mark" aria-hidden="true">{{ allStepsTicked ? '✓' : '○' }}</span>
                  <span class="chip-long">{{ tickedSteps }} of {{ totalSteps }} care step{{
                    totalSteps === 1 ? '' : 's'
                  }} ticked</span>
                  <span class="chip-short">{{ tickedSteps }}/{{ totalSteps }} steps</span>
                </li>
                <li class="photo-progress" :class="{ done: allPhotosAdded }">
                  <span class="mark" aria-hidden="true">{{ allPhotosAdded ? '✓' : '○' }}</span>
                  <span class="chip-long">{{ photoCount }} of {{ items.length }} photo{{
                    items.length === 1 ? '' : 's'
                  }} added</span>
                  <span class="chip-short">{{ photoCount }}/{{ items.length }} photos</span>
                </li>
              </ul>
              <button
                type="button"
                class="optout-btn"
                :disabled="optingOut || busy"
                aria-label="Opt out of this visit"
                @click="emit('opt-out', visit)"
              >
                <template v-if="optingOut">Opting out…</template>
                <template v-else>
                  <span class="chip-long">Opt out of this visit</span>
                  <span class="chip-short">Opt out</span>
                </template>
              </button>
              <div class="submit-side">
                <button
                  type="submit"
                  class="btn btn-primary submit-btn"
                  :disabled="busy || !readyToSubmit"
                  :title="readyToSubmit ? '' : 'Finish the items above first'"
                >
                  <span
                    v-if="busy"
                    class="spinner-border spinner-border-sm"
                    aria-hidden="true"
                  ></span>
                  {{ busy ? 'Submitting…' : 'Submit proof' }}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </article>
</template>

<style scoped>
.visit-card {
  min-width: 0;
  box-sizing: border-box;
  /* (Carolyn) no fixed height: the grid makes cards in a row equal height, without empty gaps */
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid #e2e8e2;
  border-top: 5px solid #c4d5c7;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 4px 14px #183c2410;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}
.visit-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 7px 18px #183c2417;
}
.visit-card.is-accepted {
  border-top-color: #d1a330;
}
.visit-card.is-completed {
  border-top-color: #3d8b58;
}
.visit-card.is-missed,
.visit-card.is-expired {
  border-top-color: #c65050;
}
.visit-card.is-cancelled {
  border-top-color: #8b9490;
}
.visit-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
h3 {
  margin: 0;
  font-size: 1.05rem;
}
p {
  margin: 0.3rem 0;
  color: #59665c;
}
.status {
  align-self: start;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: #e8f3e9;
  color: #2d6740;
  font-size: 0.8rem;
  text-transform: capitalize;
}
.is-accepted .status {
  background: #fff3d1;
  color: #795900;
}
.is-completed .status {
  background: #e6f5ea;
  color: #14532d;
}
.is-missed .status,
.is-expired .status {
  background: #fde8ea;
  color: #a3212f;
}
.is-cancelled .status {
  background: #eceeed;
  color: #4d5650;
}
/* card face */
.thumbs {
  display: flex;
  flex-shrink: 0;
}
/* (Carolyn) bigger plant photos (was 40px circles) so the card doesn't look empty */
.thumbs img {
  width: 68px;
  height: 68px;
  margin-left: -20px;
  border: 3px solid #fff;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 2px 6px #183c2418;
}
.thumbs img:first-child {
  margin-left: 0;
}
.heading-text {
  flex: 1;
  min-width: 0;
}
.heading-text h3 {
  overflow-wrap: anywhere;
  font-size: 1.15rem;
}
.visit-heading {
  align-items: center;
}
.day-badge {
  align-self: start;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: #e3f0fb;
  color: #1d4f7a;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}
.day-badge.today {
  background: #fff3d1;
  color: #795900;
}
.visit-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.visit-facts li {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: #f0f6f1;
  color: #34463a;
  font-size: 0.85rem;
}
.visit-action {
  align-self: flex-start;
  margin-top: auto;
  border-radius: 999px;
}
.owner-address {
  margin: 0;
  color: #34463a;
  font-size: 0.92rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.date-restriction {
  padding: 0.6rem 0.75rem;
  border-radius: 9px;
  background: #fff6dd;
  color: #735400;
  font-size: 0.9rem;
}
.modal-backdrop {
  position: fixed;
  z-index: 1050;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: #10231bb3;
}
.details-modal {
  box-sizing: border-box;
  width: min(760px, 100%);
  max-height: min(88vh, 850px);
  overflow: auto;
  padding: 1.25rem;
  border: 1px solid #e2e8e2;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 22px 70px #10231b50;
}
.modal-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid #e7ece7;
}
.modal-heading h3 {
  margin: 0;
  color: #245b34;
  font-size: 1.35rem;
  font-weight: 700;
}
/* (Carolyn) step 1: fact chips under the title (reuses the card's .visit-facts chips) */
.modal-facts {
  margin-top: 0.45rem;
}
/* (Carolyn) step 2: address + water source box */
.where-box {
  display: grid;
  gap: 0.6rem;
  margin: 0.75rem 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid #e2e8e2;
  border-radius: 12px;
  background: #f7fbf8;
}
/* flex-wrap: on narrow screens the Maps button drops under the address instead of squeezing it */
.where-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.65rem;
}
.where-icon {
  flex-shrink: 0;
  font-size: 1.15rem;
}
.where-text {
  flex: 1 1 12rem;
  min-width: 0;
  display: grid;
}
.where-text small {
  color: #68766b;
  font-size: 0.78rem;
}
.where-text strong {
  color: #1f2d24;
  overflow-wrap: anywhere;
}
.maps-link {
  flex-shrink: 0;
  padding: 0.35rem 0.8rem;
  border: 1px solid #b9d6c1;
  border-radius: 999px;
  background: #fff;
  color: #245b34;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.maps-link:hover {
  background: #e6f1e8;
}
.modal-facts .day-badge {
  align-self: center;
}
.modal-close {
  display: grid;
  flex: 0 0 2rem;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #eef4ef;
  color: #34463a;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}
/* (Carolyn) Complete visit, steps 3–6 */
.owner-note {
  margin: 0 0 0.75rem;
  padding: 0.6rem 0.8rem;
  border-left: 3px solid #b9d6c1;
  border-radius: 8px;
  background: #f7fbf8;
  color: #34463a;
  overflow-wrap: anywhere;
}
/* fieldset only used to lock the form while sending; no border or spacing of its own */
.form-lock {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
/* Step 3: one full-width card per plant */
.plant-care-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.9rem;
  margin: 0;
}
.plant-care-card {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  padding: 0.9rem;
  border: 1px solid #e2e8e2;
  border-radius: 14px;
  background: #fbfdfb;
}
.plant-head {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
.plant-photo {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 12px;
  object-fit: cover;
}
.plant-head-text {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.plant-head-text strong {
  color: #1f2d24;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}
.plant-head-text span {
  color: #1d4f7a;
  font-size: 0.9rem;
}
.plant-care-card p {
  margin: 0;
}
.block-label {
  color: #1f2d24;
  font-weight: 600;
}
.req {
  color: #b42318;
}
/* Step 4: proof photo box (dashed until a photo is added) */
.proof-block {
  display: grid;
  gap: 0.4rem;
}
.proof-upload {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.7rem;
  border: 1.5px dashed #b9c7bb;
  border-radius: 12px;
  background: #fff;
}
.proof-upload.has-photo {
  border-style: solid;
  border-color: #9cc8a8;
  background: #f4faf5;
}
.proof-upload.invalid {
  border-color: #b42318;
}
.proof-preview,
.proof-empty {
  flex-shrink: 0;
  width: 84px;
  height: 84px;
  border-radius: 10px;
}
.proof-preview {
  object-fit: cover;
}
.proof-empty {
  display: grid;
  place-items: center;
  background: #eef4ef;
  font-size: 1.6rem;
}
.proof-actions {
  display: grid;
  justify-items: start;
  gap: 0.3rem;
  min-width: 0;
}
.plant-care-card .upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 1rem;
  border: 1px solid #2d6740;
  border-radius: 999px;
  background: #fff;
  color: #245b34;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}
.plant-care-card .upload-btn:hover {
  background: #e6f1e8;
}
.plant-care-card .upload-btn.disabled {
  border-color: #c9d3cb;
  color: #8b9490;
  cursor: not-allowed;
}
.plant-care-card .upload-btn.disabled:hover {
  background: #fff;
}
/* the hidden input still takes keyboard focus, so show it on the visible button */
.proof-actions:has(input:focus-visible) .upload-btn {
  outline: 2px solid #16a34a;
  outline-offset: 2px;
}
.proof-hint {
  overflow-wrap: anywhere;
}
/* Step 5: note box with a character count */
.note-field textarea {
  width: 100%;
  padding: 0.55rem;
  border: 1px solid #b9c7bb;
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}
.note-count {
  justify-self: end;
}
/* Step 6: footer that stays visible at the bottom of the pop-up while scrolling */
.modal-foot {
  position: sticky;
  bottom: -1.25rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0 -1.25rem -0.25rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid #e7ece7;
  background: #fff;
}
/* "Before you submit" list: full width on top of the footer, amber ○ until done, green ✓ after */
.ready-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ready-list li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  background: #fff3d1;
  color: #795900;
  font-size: 0.85rem;
  font-weight: 600;
}
.ready-list li.done {
  background: #e6f5ea;
  color: #14532d;
}
.ready-list .mark {
  font-weight: 700;
}
/* Opt out: a real button, but outlined and quiet next to the green Submit */
.optout-btn {
  padding: 0.45rem 1rem;
  border: 1px solid #e7c3bd;
  border-radius: 999px;
  background: #fff;
  color: #a22f17;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
}
.optout-btn:hover:not(:disabled) {
  border-color: #a22f17;
  background: #fbe6df;
}
.optout-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.submit-side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-left: auto;
}
.submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  padding-inline: 1.2rem;
}
.visit-page-link {
  justify-self: center;
  color: #245b34;
  font-size: 0.85rem;
}
/* Footer labels: full text normally, short text on phones */
.chip-short { display: none; }
.plant-care-card label {
  display: grid;
  gap: 0.35rem;
  font-weight: 600;
}
.plant-care-card input:not([type='file']) {
  padding: 0.55rem;
  border: 1px solid #b9c7bb;
  border-radius: 7px;
  font: inherit;
}
.visit-form {
  display: grid;
  gap: 0.8rem;
  margin: 1rem 0;
}
.visit-form label {
  display: grid;
  gap: 0.35rem;
  font-weight: 600;
}
.visit-form input:not([type='file']) {
  padding: 0.55rem;
  border: 1px solid #b9c7bb;
  border-radius: 7px;
  font: inherit;
}
.visit-form small {
  color: #68766b;
  font-weight: 400;
}
.visit-form button {
  justify-self: start;
}
.error {
  color: #b42318;
}
/* Care checklist (Carolyn) */
.care-checklist {
  margin: 0;
  padding: 0.5rem 0.65rem;
  border: 1px solid #e2e8e2;
  border-radius: 8px;
  background: #fff;
}
.care-checklist legend {
  float: left;
  width: 100%;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #34463a;
}
.care-checklist legend small {
  margin-left: 0.35rem;
  font-weight: 400;
  color: #68766b;
}
/* Care checklist (Carolyn): grey "(optional)" next to the note label */
.optional {
  font-weight: 400;
  color: #68766b;
}
.plant-care-card .care-checklist .step {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-weight: 400;
  cursor: pointer;
}
.care-checklist .step input {
  width: 16px;
  height: 16px;
  margin-top: 0.2rem;
  accent-color: #2d6740;
}
.mobile-plant-count { display: none; }
@media (max-width: 600px) {
  .visit-card { min-width: 0; padding: 0.85rem; }
  .visit-heading { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 0.5rem 0.75rem; align-items: start; }
  .thumbs { grid-column: 1; grid-row: 1 / span 2; flex-direction: column; gap: 0.4rem; }
  .thumbs img { width: 56px; height: 56px; margin: 0; border-width: 2px; border-radius: 10px; }
  .thumbs img:nth-of-type(n+3) { display: none; }
  .mobile-plant-count { display: block; font-size: 0.7rem; color: var(--muted); text-align: center; }
  .heading-text { grid-column: 2; grid-row: 1; }
  .heading-text h3 { font-size: 1rem; line-height: 1.4; word-break: normal; overflow-wrap: break-word; }
  .visit-heading > .day-badge, .visit-heading > .status { grid-column: 2; grid-row: 2; justify-self: start; }
  .visit-action { min-height: 44px; }
  /* Phones: the pop-up becomes a bottom sheet (full width, slides up from the bottom)
     so the plant details get the screen instead of a floating box with margins */
  .modal-backdrop { padding: 0; place-items: end stretch; }
  .details-modal {
    width: 100%;
    max-height: 92dvh;
    /* bottom padding = room for the fixed footer, so the last content isn't hidden behind it */
    padding: 1rem 1rem calc(7rem + env(safe-area-inset-bottom));
    border: 0;
    border-radius: 20px 20px 0 0;
    animation: sheetUp 0.25s ease-out;
  }
  .modal-heading h3 { font-size: 1.2rem; }
  /* Header stays pinned at the top of the sheet while the details scroll.
     top: -1rem cancels the sheet's top padding so it sits flush with the top edge. */
  .modal-heading {
    position: sticky;
    z-index: 2;
    top: -1rem;
    margin: -1rem -1rem 0.8rem;
    padding: 1rem 1rem 0.7rem;
    border-radius: 20px 20px 0 0;
    background: #fff;
  }
  .modal-close { flex-basis: 44px; width: 44px; height: 44px; font-size: 1.4rem; } /* easy to tap */
  /* Footer pinned to the bottom of the screen. (A sticky footer can't rise above the top
     of its form, so on short phones it was pushed partly off-screen.) Compact: one row of
     short chips, then Opt out + Submit side by side. */
  .modal-foot {
    position: fixed;
    z-index: 2;
    left: 0;
    right: 0;
    bottom: 0;
    min-width: 0;
    gap: 0.5rem;
    margin: 0;
    padding: 0.6rem 1rem calc(0.6rem + env(safe-area-inset-bottom));
    box-shadow: 0 -6px 16px #10231b14;
  }
  /* Short labels so the three chips fit on one line: "○ Opens 10 Nov  ○ 0/1 steps  ○ 0/1 photos" */
  .chip-long { display: none; }
  .chip-short { display: inline; }
  .ready-list { min-width: 0; gap: 0.3rem; }
  .ready-list li { gap: 0.25rem; padding: 0.15rem 0.5rem; font-size: 0.72rem; white-space: nowrap; }
  /* Buttons: small "Opt out" + wide "Submit proof" on one row */
  .optout-btn { flex: 0 0 auto; min-height: 44px; padding-inline: 1rem; font-size: 0.85rem; }
  .submit-side { flex: 1 1 0; margin-left: 0; }
  .submit-btn { width: 100%; min-height: 44px; justify-content: center; padding-inline: 0.5rem; white-space: nowrap; }
  .visit-page-link { padding: 0.25rem 0 0.75rem; text-align: center; }
}
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .details-modal { animation: none; }
}
/* Scrolling inside the pop-up never spills over to the page behind (needed on iPhones too) */
.modal-backdrop, .modal-backdrop [role="dialog"] { overscroll-behavior: contain; }
</style>
