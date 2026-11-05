<script setup>
// View: presents one visit's owner/sitter details, plant proofs, and participant reviews.
import Loading from '@/components/Loading.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import StarRating from '@/components/review/StarRating.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import ScrollToTop from '@/components/ScrollToTop.vue'
import plantPlaceholder from '@/assets/plant.png'
import { getRequestSteps } from '@/utils/careSteps'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const visit = ref(null)
const reviews = ref([])
const loading = ref(true)
const error = ref('')
const reviewError = ref('')
const saving = ref(false)
const rating = ref(0)
const comment = ref('')
const activePlantIndex = ref(0)
const failedPlantPhotos = ref(new Set())
const plantItems = computed(() => visit.value?.items || [])
// Photo and care details share one selection, so they always describe the same plant.
const activePlant = computed(() => plantItems.value[activePlantIndex.value])
let swipeStart = null

// Care checklist for the plant on screen: the request's instructions, else the plant's own care notes
// (same steps the sitter ticks). After the visit, show which steps the sitter ticked.
const activeSteps = computed(() => (activePlant.value ? getRequestSteps(activePlant.value) : []))
// Only when ticks were saved (visits finished before the checklist existed have none)
const showTicks = computed(
  () => visit.value?.status === 'completed' && (activePlant.value?.completedSteps || []).length > 0,
)
// Check whether the sitter recorded this care step as completed.
function stepDone(step) {
  return (activePlant.value?.completedSteps || []).includes(step)
}
const doneStepCount = computed(() => activeSteps.value.filter(stepDone).length)

// ---------- make-up visit (owner, missed visit) ----------
const isOwner = computed(() => visit.value?.request?.ownerId === auth.user?.userId)
const canRequestMakeup = computed(
  () =>
    isOwner.value &&
    visit.value?.status === 'missed' &&
    !visit.value?.makeupRequestId &&
    visit.value?.request?.status !== 'cancelled',
)
const makeupBusy = ref(false)
const makeupError = ref('')

// "YYYY-MM-DD" in Singapore time, and that date plus some days
function sgDate(value) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
}
function addDays(day, days) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10)
}
// Same date rule as My Requests: tomorrow, or the day after the original request ends if that is later
const makeupDate = computed(() => {
  const tomorrow = addDays(sgDate(new Date()), 1)
  const afterRequest = visit.value?.request?.endDate ? addDays(sgDate(visit.value.request.endDate), 1) : tomorrow
  return afterRequest > tomorrow ? afterRequest : tomorrow
})

// Ask the server to create a future replacement request for this missed visit.
async function requestMakeup() {
  if (makeupBusy.value || !canRequestMakeup.value) return
  makeupBusy.value = true
  makeupError.value = ''
  try {
    const result = await auth.authorizedRequest(`/care-visits/make-up/${visit.value.visitId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: makeupDate.value }),
    })
    visit.value.makeupRequestId = result.request.requestId
  } catch (err) {
    makeupError.value = err.message
  } finally {
    makeupBusy.value = false
  }
}

// Preserve the previous page and its query tab. Direct links have no app history.
function goBack() {
  if (router.options.history.state.back) {
    router.back()
  } else {
    router.replace('/requests')
  }
}

// Change the active plant shown in the proof gallery and care checklist.
function selectPlant(index) {
  activePlantIndex.value = index
}

// Wrap at either end, like the photo gallery on the post detail page.
function movePlant(direction) {
  const count = plantItems.value.length
  if (count < 2) {
    return
  }
  activePlantIndex.value = (activePlantIndex.value + direction + count) % count
}

// Remember a horizontal pointer gesture so the gallery can respond to swipes.
function startPlantSwipe(event) {
  if (event.button > 0 || event.target.closest('button')) {
    return
  }
  swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

// Ignore vertical gestures so browsing plants does not interrupt page scrolling.
function endPlantSwipe(event) {
  if (!swipeStart || swipeStart.id !== event.pointerId) {
    return
  }
  const dx = event.clientX - swipeStart.x
  const dy = event.clientY - swipeStart.y
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
    movePlant(dx < 0 ? 1 : -1)
  }
  cancelPlantSwipe()
}

// Clear the saved pointer gesture after it ends or is cancelled.
function cancelPlantSwipe() {
  swipeStart = null
}

// Keep the database status unchanged while showing a friendly page label.
const statusLabel = computed(() => {
  if (visit.value?.status === 'accepted') {
    return 'In progress'
  }
  return visit.value?.status?.replaceAll('_', ' ') || ''
})
// Find the current user's review so they cannot submit another one.
const ownReview = computed(() => {
  return reviews.value.find((review) => review.creatorId === auth.user?.userId)
})
// Only participants may review a completed visit, and only once each.
const canReview = computed(() => {
  if (visit.value?.status !== 'completed' || ownReview.value) {
    return false
  }
  return (
    visit.value.request?.ownerId === auth.user?.userId || visit.value.sitterId === auth.user?.userId
  )
})

// Display saved timestamps in the same timezone used for visit scheduling.
function formatDate(value, includeTime = false) {
  if (!value) {
    return 'Not recorded'
  }
  const options = { timeZone: 'Asia/Singapore', dateStyle: 'medium' }
  if (includeTime) {
    options.timeStyle = 'short'
  }
  return new Intl.DateTimeFormat('en-SG', options).format(new Date(value))
}

// Display the owner's full address to visit participants.
function formatOwnerAddress(owner) {
  if (!owner) return ''
  return [
    owner.block ? `Blk ${owner.block}` : '',
    owner.unitNumber,
    owner.postalCode ? `Singapore ${owner.postalCode}` : '',
  ].filter(Boolean).join(', ')
}

// A watcher also reloads the page when navigation changes only the visit ID.
// Cleanup prevents an older response from replacing the next visit's details.
watch(
  () => route.params.visitId,
  async (visitId, previousId, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    loading.value = true
    visit.value = null
    activePlantIndex.value = 0
    failedPlantPhotos.value = new Set()
    reviews.value = []
    error.value = ''
    reviewError.value = ''
    rating.value = 0
    comment.value = ''
    try {
      const data = await auth.authorizedRequest(`/care-visits/${visitId}`)
      if (active) {
        visit.value = data.visit
        reviews.value = data.reviews
      }
    } catch (err) {
      if (active) {
        error.value = err.message
      }
    } finally {
      if (active) {
        loading.value = false
      }
    }
  },
  { immediate: true },
)

// The server checks participation, completion and the one-review-per-user rule.
async function submitReview() {
  if (saving.value || !canReview.value) {
    return
  }
  reviewError.value = ''
  if (!rating.value || !comment.value.trim()) {
    reviewError.value = 'Choose a rating and write a short review.'
    return
  }
  saving.value = true
  const visitId = visit.value.visitId
  try {
    const data = await auth.authorizedRequest(`/care-visits/${visitId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: rating.value, comment: comment.value.trim() }),
    })
    if (visit.value?.visitId === visitId) {
      reviews.value.unshift(data.review)
      // Reflect the new review in its receiver's summary immediately.
      const receiver = [visit.value.owner, visit.value.sitter].find((user) => {
        return user?.userId === data.review.receiverId
      })
      if (receiver) {
        const previousCount = receiver.reviewCount || 0
        const previousTotal = (receiver.averageRating || 0) * previousCount
        receiver.reviewCount = previousCount + 1
        receiver.averageRating = (previousTotal + data.review.rating) / receiver.reviewCount
      }
      comment.value = ''
      rating.value = 0
    }
  } catch (err) {
    if (visit.value?.visitId === visitId) {
      reviewError.value = err.message
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="visit-detail">
    <button type="button" class="back-button" @click="goBack">← Back</button>
    <!-- Show the shared growing tree while retrieving this visit. -->
    <Loading v-if="loading" label="Loading visit details…" />
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else-if="visit">
      <!-- Group the summary and participants in one compact overview. -->
      <section class="panel visit-overview" aria-label="Visit overview">
        <header class="visit-summary">
          <div class="summary-heading">
            <h1>Visit #{{ visit.visitId }}</h1>
            <span class="status">{{ statusLabel }}</span>
          </div>
          <div class="visit-meta">
            <span
              >Scheduled for <strong>{{ formatDate(visit.visitDate) }}</strong></span
            >
            <span class="visit-reward">{{ visit.request?.tokenReward }} tokens</span>
          </div>
          <!-- Missed visit: the owner can post a one-day make-up request (once per missed visit) -->
          <div v-if="visit.status === 'missed' && isOwner" class="makeup-box" role="status">
            <template v-if="visit.makeupRequestId">
              <span>🔁 A make-up visit has been requested for this missed visit.</span>
              <RouterLink :to="{ path: '/requests', query: { tab: 'requests', requestId: visit.makeupRequestId } }">
                View request #{{ visit.makeupRequestId }} →
              </RouterLink>
            </template>
            <template v-else-if="canRequestMakeup">
              <span>⚠ The sitter missed this visit. Post a make-up visit for <strong>{{ formatDate(makeupDate) }}</strong> with the same plants and care details.</span>
              <button type="button" class="makeup-button" :disabled="makeupBusy" @click="requestMakeup">
                {{ makeupBusy ? 'Posting…' : 'Request make-up visit' }}
              </button>
            </template>
            <span v-else>This request was cancelled, so a make-up visit can’t be requested.</span>
            <p v-if="makeupError" class="makeup-error" role="alert">{{ makeupError }}</p>
          </div>
          <div class="visit-description">
            <h2>Description</h2>
            <p class="preserve-lines">{{ visit.request?.note || 'No description provided.' }}</p>
          </div>
        </header>

        <!-- Share one row on wider screens; stack naturally on phones. -->
        <div class="participants-grid">
          <section class="participant-block" aria-labelledby="owner-heading">
            <h2 id="owner-heading" class="participant-label">Owner</h2>
            <!-- Wrap the avatar and name together so both open the public profile. -->
            <div class="participant-row">
              <RouterLink
                v-if="visit.owner"
                class="participant-link"
                :to="{ name: 'public-profile', params: { userId: visit.owner.userId } }"
              >
                <UserAvatar :user="visit.owner" :size="44" />
                <span>{{ visit.owner.userName }}</span>
              </RouterLink>
              <p v-else>Owner unavailable</p>
              <!-- Keep the rating at the right edge of the entire participant row. -->
              <div v-if="visit.owner" class="participant-rating" aria-label="Owner care rating">
                <template v-if="visit.owner.averageRating != null">
                  <strong>{{ visit.owner.averageRating.toFixed(1) }} / 5</strong>
                  <StarRating :model-value="visit.owner.averageRating" readonly />
                  <small
                    >{{ visit.owner.reviewCount }}
                    {{ visit.owner.reviewCount === 1 ? 'review' : 'reviews' }}</small
                  >
                </template>
                <small v-else>No ratings yet</small>
              </div>
            </div>
            <p v-if="visit.owner?.block" class="participant-address">
              <strong>Owner address:</strong> {{ formatOwnerAddress(visit.owner) }}
            </p>
          </section>

          <!-- An accepted visit is the model's equivalent of an in-progress visit. -->
          <section v-if="visit.sitterId" class="participant-block" aria-labelledby="sitter-heading">
            <h2 id="sitter-heading" class="participant-label">Sitter</h2>
            <!-- Use the same public profile link and avatar as the owner. -->
            <div class="participant-row">
              <RouterLink
                v-if="visit.sitter"
                class="participant-link"
                :to="{ name: 'public-profile', params: { userId: visit.sitter.userId } }"
              >
                <UserAvatar :user="visit.sitter" :size="44" />
                <span>{{ visit.sitter.userName }}</span>
              </RouterLink>
              <p v-else>Sitter unavailable</p>
              <div v-if="visit.sitter" class="participant-rating" aria-label="Sitter care rating">
                <template v-if="visit.sitter.averageRating != null">
                  <strong>{{ visit.sitter.averageRating.toFixed(1) }} / 5</strong>
                  <StarRating :model-value="visit.sitter.averageRating" readonly />
                  <small
                    >{{ visit.sitter.reviewCount }}
                    {{ visit.sitter.reviewCount === 1 ? 'review' : 'reviews' }}</small
                  >
                </template>
                <small v-else>No ratings yet</small>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="panel" aria-labelledby="plants-heading">
        <h2 id="plants-heading">Plants</h2>
        <p v-if="!visit.items?.length">No plant details available.</p>
        <!-- Match the post gallery's arrows, thumbnails and keyboard navigation.
             The plant detail page's contained photo frame avoids cropping leaves. -->
        <div v-if="activePlant" class="plant-layout">
          <section
            class="plant-gallery"
            aria-label="Visit plants"
            aria-roledescription="carousel"
            tabindex="0"
            @keydown.left.prevent="movePlant(-1)"
            @keydown.right.prevent="movePlant(1)"
          >
            <div
              class="plant-photo"
              @pointerdown="startPlantSwipe"
              @pointerup="endPlantSwipe"
              @pointercancel="cancelPlantSwipe"
              @lostpointercapture="cancelPlantSwipe"
              @dragstart.prevent
            >
              <img
                :src="
                  failedPlantPhotos.has(activePlantIndex)
                    ? plantPlaceholder
                    : activePlant.plant?.photoUrl || plantPlaceholder
                "
                :alt="activePlant.plant?.plantName || 'Plant photo unavailable'"
                draggable="false"
                @error="failedPlantPhotos.add(activePlantIndex)"
              />
              <template v-if="plantItems.length > 1">
                <span class="photo-count"
                  >{{ activePlantIndex + 1 }} / {{ plantItems.length }}</span
                >
                <button
                  type="button"
                  class="gallery-arrow previous"
                  aria-label="Previous plant"
                  @click="movePlant(-1)"
                >
                  ‹
                </button>
                <button
                  type="button"
                  class="gallery-arrow next"
                  aria-label="Next plant"
                  @click="movePlant(1)"
                >
                  ›
                </button>
              </template>
            </div>
            <div v-if="plantItems.length > 1" class="plant-thumbnails" aria-label="Choose plant">
              <button
                v-for="(item, index) in plantItems"
                :key="item.requestItemId"
                type="button"
                :aria-label="`Show ${item.plant?.plantName || 'plant ' + (index + 1)}`"
                :aria-pressed="activePlantIndex === index"
                @click="selectPlant(index)"
              >
                <img
                  :src="
                    failedPlantPhotos.has(index)
                      ? plantPlaceholder
                      : item.plant?.photoUrl || plantPlaceholder
                  "
                  alt=""
                  @error="failedPlantPhotos.add(index)"
                />
              </button>
            </div>
          </section>
          <article class="plant-info" aria-live="polite" aria-atomic="true">
            <p class="plant-label">Plant {{ activePlantIndex + 1 }} of {{ plantItems.length }}</p>
            <h3>{{ activePlant.plant?.plantName || 'Plant unavailable' }}</h3>
            <dl class="plant-facts">
              <div>
                <dt>Where to find it</dt>
                <dd>{{ activePlant.plant?.plantLocation || 'Location not provided' }}</dd>
              </div>
              <div>
                <dt>Water for this visit</dt>
                <dd>{{ activePlant.amountToWater ?? 0 }} ml</dd>
              </div>
            </dl>
            <!-- Every care step as a checklist; after the visit, ✓ = ticked by the sitter, ○ = not ticked -->
            <h4>
              Care checklist
              <small v-if="showTicks && activeSteps.length">({{ doneStepCount }} of {{ activeSteps.length }} done)</small>
            </h4>
            <ul v-if="activeSteps.length" class="care-steps">
              <li v-for="step in activeSteps" :key="step" :class="{ done: showTicks && stepDone(step), missed: showTicks && !stepDone(step) }">
                <span class="tick" aria-hidden="true">{{ showTicks && !stepDone(step) ? '○' : '✓' }}</span>
                <span>{{ step }}</span>
                <span v-if="showTicks" class="visually-hidden">{{ stepDone(step) ? '(done)' : '(not done)' }}</span>
              </li>
            </ul>
            <p v-else class="no-steps">No care steps for this plant, just water it.</p>
          </article>
        </div>
      </section>

      <!-- Each proof belongs to a plant, so owners can check every plant's care. -->
      <section
        v-if="visit.status === 'completed'"
        class="panel"
        aria-labelledby="completion-heading"
      >
        <h2 id="completion-heading">Completed visit</h2>
        <p>Completed at {{ formatDate(visit.doneAt, true) }} (Singapore time)</p>
        <div class="plant-grid">
          <article v-for="item in visit.items" :key="item.requestItemId">
            <h3>{{ item.plant?.plantName || 'Plant' }}</h3>
            <p class="preserve-lines">{{ item.action }}</p>
            <a v-if="item.proofUrl" :href="item.proofUrl" target="_blank" rel="noopener noreferrer">
              <img
                class="proof"
                :src="item.proofUrl"
                :alt="`Care proof for ${item.plant?.plantName || 'plant'}`"
              />
            </a>
            <p v-else>No photo proof available.</p>
          </article>
        </div>
      </section>

      <section v-if="visit.status === 'completed'" class="panel" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading">Care reviews</h2>
        <p v-if="ownReview" role="status">Your review has been submitted.</p>
        <article v-for="review in reviews" :key="review.reviewId" class="saved-review">
          <strong
            >{{ review.creatorId === visit.request?.ownerId ? 'Owner' : 'Sitter' }} review</strong
          >
          <StarRating :model-value="review.rating" readonly />
          <p class="preserve-lines">{{ review.comment }}</p>
        </article>
        <form v-if="canReview" @submit.prevent="submitReview">
          <h3>Write a care review</h3>
          <fieldset :disabled="saving">
            <StarRating v-model="rating" />
            <label for="care-review">Your review</label>
            <textarea id="care-review" v-model="comment" rows="4" maxlength="1000" required />
            <p v-if="reviewError" role="alert">{{ reviewError }}</p>
            <button class="btn btn-primary" type="submit">
              {{ saving ? 'Submitting…' : 'Submit review' }}
            </button>
          </fieldset>
        </form>
      </section>
    </template>
    <!-- Reuse the site's floating shortcut, shown after scrolling down. -->
    <ScrollToTop />
  </main>
</template>

<style scoped>
/* Page container: center the content and leave room around the page edges. */
.visit-detail {
  max-width: 960px;
  margin: auto;
  padding: 1rem 1rem 3rem;
}
/* Participant identity: style the owner/sitter label and linked avatar/name. */
.participant-label {
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.85rem;
  color: #607166;
}
.participant-link {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  color: #28623a;
  font-weight: 600;
  text-decoration: none;
}
/* Use the full block width so ratings align at the right, even for short names. */
.participant-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0;
}
/* Long usernames: allow text to wrap without pushing the rating outside the card. */
.participant-row .participant-link {
  min-width: 0;
  overflow-wrap: anywhere;
}
/* Rating summary: align the score, stars and review count to the right edge. */
.participant-rating {
  display: grid;
  justify-items: end;
  gap: 0.2rem;
  flex-shrink: 0;
  text-align: right;
}
.participant-rating small {
  color: #607166;
}
/* Narrow phones: let the rating move below the identity while staying right-aligned. */
@media (max-width: 420px) {
  .participant-row {
    flex-wrap: wrap;
  }
  .participant-rating {
    margin-left: auto;
  }
}
/* Profile link feedback: underline on hover and show a visible keyboard focus ring. */
.participant-link:hover span {
  text-decoration: underline;
}
.participant-link:focus-visible {
  outline: 2px solid #28623a;
  outline-offset: 4px;
  border-radius: 4px;
}
/* Shared panels: consistent spacing, border and rounded surface for each section. */
.panel {
  margin-top: 1rem;
  padding: 1.25rem;
  border: 1px solid #dce5dc;
  border-radius: 16px;
  background: #fff;
}
/* A short summary replaces the three separate, full-width opening panels. */
.summary-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}
/* Visit title: scale with the viewport while keeping the overview compact. */
.summary-heading h1 {
  margin: 0;
  font-size: clamp(1.4rem, 4vw, 1.8rem);
  font-weight: 700;
}
/* Schedule and reward: share one row and wrap when horizontal space is limited. */
.visit-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-top: 0.5rem;
  color: #607166;
  font-size: 0.9rem;
}
.visit-reward {
  color: #28623a;
  font-weight: 600;
}
/* Description: separate the note from the metadata without excess paragraph spacing. */
.visit-description {
  margin-top: 1rem;
}
.visit-description h2 {
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
  color: #607166;
}
.visit-description p {
  margin-bottom: 0;
}
/* Participant layout: show owner and sitter side by side, then stack on smaller screens. */
.participants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e4ece5;
}
/* Participant cards: use a soft background to separate identities from the summary. */
.participant-block {
  min-width: 0;
  padding: 0.85rem;
  border-radius: 12px;
  background: #f5f8f5;
}
.participant-block p {
  margin-bottom: 0;
}
.participant-address {
  margin-top: 0.65rem;
  color: #34463a;
  font-size: 0.95rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.participant-rating {
  /* Keep the numeric score beside the stars to reduce the card height. */
  column-gap: 0.35rem;
  grid-template-columns: auto auto;
  align-items: center;
}
.participant-rating small {
  /* Place the review count beneath both the score and stars. */
  grid-column: 1 / -1;
}
/* Narrow phones: reduce panel padding and stack the rating contents for extra room. */
@media (max-width: 420px) {
  .panel {
    padding: 1rem;
  }
  .participant-rating {
    grid-template-columns: auto;
  }
}
/* Status badge: distinguish the visit state with a compact green pill. */
.status {
  display: inline-block;
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  background: #e7f3e9;
  color: #28623a;
  text-transform: capitalize;
}
/* Shared headings: keep section titles smaller than the visit title. */
h1 {
  margin-top: 0.75rem;
}
h2 {
  font-size: 1.35rem;
}
h3 {
  font-size: 1.05rem;
}
/* Completion proofs: distribute plant proof cards across the available width. */
.plant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 1rem;
}
/* A full photo and its facts share a row on desktop and stack on phones. */
/* Photo column stays a sensible size; details and checklist take the rest */
.plant-layout {
  display: grid;
  grid-template-columns: minmax(220px, 340px) minmax(0, 1fr);
  align-items: start;
  gap: 1.75rem;
}
/* Carousel columns: allow gallery and detail content to shrink inside the grid. */
.plant-gallery,
.plant-info {
  min-width: 0;
}
/* Photo frame: preserve a 4:3 area and allow vertical scrolling during touch gestures. */
.plant-photo {
  position: relative;
  aspect-ratio: 4 / 5; /* portrait frame: most plant photos are tall, so less empty space */
  border-radius: 12px;
  overflow: hidden;
  background: #f0f6f1;
  touch-action: pan-y;
}
/* Plant image: show the entire photo inside the frame without cropping. */
/* Plant image: fill the frame (no grey bars at the sides) */
.plant-photo > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* Carousel arrows: center circular controls vertically over the photo edges. */
.gallery-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border: 1px solid #dce5dc;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  background: #fff;
  color: #28623a;
  font-size: 1.5rem;
}
.previous {
  left: 0.5rem;
}
.next {
  right: 0.5rem;
}
/* Photo counter: display the selected plant number at the top-right of the frame. */
.photo-count {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  background: #fff;
}
/* Thumbnail strip: allow horizontal scrolling when there are many plants. */
.plant-thumbnails {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 0;
}
/* Thumbnail controls: keep touch targets equal in size and reserve a selection border. */
.plant-thumbnails button {
  flex: 0 0 56px;
  height: 56px;
  padding: 3px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: #f0f6f1;
}
/* Selected thumbnail: use the same active state announced to assistive technology. */
.plant-thumbnails button[aria-pressed='true'] {
  border-color: #28623a;
}
/* Thumbnail images: preserve the whole plant within each small preview. */
.plant-thumbnails img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
/* Plant details: establish the name, instruction heading and muted fact labels. */
.plant-info h3 {
  font-size: 1.5rem;
  overflow-wrap: anywhere;
}
.plant-info h4 {
  font-size: 1rem;
}
.plant-label,
.plant-facts dt {
  color: #607166;
  font-size: 0.8rem;
}
/* Plant facts: display location and visit watering amount in two readable columns. */
.plant-facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1rem 0;
}
.plant-facts dd {
  margin: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
/* Care checklist: one row per step in a soft box */
.plant-info h4 small {
  color: #607166;
  font-size: 0.85rem;
  font-weight: 400;
}
.care-steps {
  display: grid;
  gap: 0.4rem;
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
}
.care-steps li {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  background: #f4f8f5;
  color: #1f2d24;
  overflow-wrap: anywhere;
}
.tick {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 1.3rem;
  height: 1.3rem;
  margin-top: 0.1rem;
  border-radius: 6px;
  background: #daf2e3;
  color: #0e6138;
  font-size: 0.8rem;
  font-weight: 700;
}
.care-steps li.missed {
  background: #fbf6ea;
  color: #5e5440;
}
.care-steps li.missed .tick {
  background: #fff3d1;
  color: #795900;
}
.no-steps {
  color: #607166;
  font-style: italic;
}
/* Missed visit: make-up box under the date */
.makeup-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
  margin-top: 0.9rem;
  padding: 0.75rem 1rem;
  border: 1px solid #f3d9a4;
  border-radius: 12px;
  background: #fff8e8;
  color: #5e4a14;
}
.makeup-box a {
  color: #0e6138;
  font-weight: 600;
}
.makeup-button {
  padding: 0.5rem 1rem;
  border: 0;
  border-radius: 999px;
  background: #14804a;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.makeup-button:disabled {
  opacity: 0.6;
  cursor: default;
}
.makeup-error {
  width: 100%;
  margin: 0;
  color: #a22f17;
}
/* Back navigation: style the history button as a lightweight text action. */
.back-button {
  border: 0;
  background: transparent;
  color: #28623a;
  padding: 0.25rem 0;
  font-weight: 600;
}
/* Mobile carousel: place the plant details below the photo instead of beside it. */
@media (max-width: 640px) {
  .plant-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* Proof photos: show the full image while limiting its height in the completion section. */
.proof {
  width: 100%;
  max-height: 360px;
  object-fit: contain;
}
/* User-written text: retain line breaks and wrap long words to prevent overflow. */
.preserve-lines {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
/* Published reviews: separate each entry with spacing and a subtle divider. */
.saved-review {
  padding: 1rem 0;
  border-bottom: 1px solid #dce5dc;
}
/* Review form: space it from saved reviews and remove the fieldset's default border. */
form {
  margin-top: 1.5rem;
}
fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
/* Review input: use full-width labels and textareas with consistent spacing. */
label,
textarea {
  display: block;
  width: 100%;
  margin-bottom: 0.75rem;
}
textarea {
  border: 1px solid #b8c9bc;
  border-radius: 8px;
  padding: 0.75rem;
}
</style>
