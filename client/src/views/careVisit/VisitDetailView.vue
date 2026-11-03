<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import StarRating from '@/components/review/StarRating.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import plantPlaceholder from '@/assets/plant.png'

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

// Preserve the previous page and its query tab. Direct links have no app history.
function goBack() {
  if (router.options.history.state.back) {
    router.back()
  } else {
    router.replace('/requests')
  }
}

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
const ownReview = computed(() => {
  return reviews.value.find((review) => review.creatorId === auth.user?.userId)
})
const canReview = computed(() => {
  if (visit.value?.status !== 'completed' || ownReview.value) {
    return false
  }
  return visit.value.request?.ownerId === auth.user?.userId ||
    visit.value.sitterId === auth.user?.userId
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

// A watcher also reloads the page when navigation changes only the visit ID.
// Cleanup prevents an older response from replacing the next visit's details.
watch(() => route.params.visitId, async (visitId, previousId, onCleanup) => {
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
}, { immediate: true })

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
    <p v-if="loading" role="status">Loading visit details…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else-if="visit">
      <header class="panel">
        <span class="status">{{ statusLabel }}</span>
        <h1>Visit #{{ visit.visitId }}</h1>
        <p>Scheduled for {{ formatDate(visit.visitDate) }}</p>
        <p>{{ visit.request?.tokenReward }} tokens</p>
      </header>

      <!-- The original care details remain visible through every visit status. -->
      <section class="panel" aria-labelledby="details-heading">
        <h2 id="details-heading">Visit details</h2>
        <p class="participant-label">Owner</p>
        <!-- Wrap the avatar and name together so both open the public profile. -->
        <div class="participant-row">
        <RouterLink v-if="visit.owner" class="participant-link"
          :to="{ name: 'public-profile', params: { userId: visit.owner.userId } }">
          <UserAvatar :user="visit.owner" :size="44" />
          <span>{{ visit.owner.userName }}</span>
        </RouterLink>
        <p v-else>Owner unavailable</p>
        <!-- Keep the rating at the right edge of the entire participant row. -->
        <div v-if="visit.owner" class="participant-rating" aria-label="Owner care rating">
          <template v-if="visit.owner.averageRating != null">
            <strong>{{ visit.owner.averageRating.toFixed(1) }} / 5</strong>
            <StarRating :model-value="visit.owner.averageRating" readonly />
            <small>{{ visit.owner.reviewCount }} {{ visit.owner.reviewCount === 1 ? 'review' : 'reviews' }}</small>
          </template>
          <small v-else>No ratings yet</small>
        </div>
        </div>
        <h3>Description</h3>
        <p class="preserve-lines">{{ visit.request?.note || 'No description provided.' }}</p>
      </section>

      <!-- An accepted visit is the model's equivalent of an in-progress visit. -->
      <section v-if="visit.sitterId" class="panel" aria-labelledby="sitter-heading">
        <h2 id="sitter-heading">Sitter</h2>
        <!-- Use the same public profile link and avatar as the owner. -->
        <div class="participant-row">
        <RouterLink v-if="visit.sitter" class="participant-link"
          :to="{ name: 'public-profile', params: { userId: visit.sitter.userId } }">
          <UserAvatar :user="visit.sitter" :size="44" />
          <span>{{ visit.sitter.userName }}</span>
        </RouterLink>
        <p v-else>Sitter unavailable</p>
        <div v-if="visit.sitter" class="participant-rating" aria-label="Sitter care rating">
          <template v-if="visit.sitter.averageRating != null">
            <strong>{{ visit.sitter.averageRating.toFixed(1) }} / 5</strong>
            <StarRating :model-value="visit.sitter.averageRating" readonly />
            <small>{{ visit.sitter.reviewCount }} {{ visit.sitter.reviewCount === 1 ? 'review' : 'reviews' }}</small>
          </template>
          <small v-else>No ratings yet</small>
        </div>
        </div>
      </section>

      <section class="panel" aria-labelledby="plants-heading">
        <h2 id="plants-heading">Plants</h2>
        <p v-if="!visit.items?.length">No plant details available.</p>
        <!-- Match the post gallery's arrows, thumbnails and keyboard navigation.
             The plant detail page's contained photo frame avoids cropping leaves. -->
        <div v-if="activePlant" class="plant-layout">
          <section class="plant-gallery" aria-label="Visit plants" aria-roledescription="carousel"
            tabindex="0" @keydown.left.prevent="movePlant(-1)" @keydown.right.prevent="movePlant(1)">
            <div class="plant-photo" @pointerdown="startPlantSwipe" @pointerup="endPlantSwipe"
              @pointercancel="cancelPlantSwipe" @lostpointercapture="cancelPlantSwipe" @dragstart.prevent>
              <img
                :src="failedPlantPhotos.has(activePlantIndex) ? plantPlaceholder : activePlant.plant?.photoUrl || plantPlaceholder"
                :alt="activePlant.plant?.plantName || 'Plant photo unavailable'"
                draggable="false"
                @error="failedPlantPhotos.add(activePlantIndex)"
              />
              <template v-if="plantItems.length > 1">
                <span class="photo-count">{{ activePlantIndex + 1 }} / {{ plantItems.length }}</span>
                <button type="button" class="gallery-arrow previous" aria-label="Previous plant" @click="movePlant(-1)">‹</button>
                <button type="button" class="gallery-arrow next" aria-label="Next plant" @click="movePlant(1)">›</button>
              </template>
            </div>
            <div v-if="plantItems.length > 1" class="plant-thumbnails" aria-label="Choose plant">
              <button v-for="(item, index) in plantItems" :key="item.requestItemId" type="button"
                :aria-label="`Show ${item.plant?.plantName || 'plant ' + (index + 1)}`"
                :aria-pressed="activePlantIndex === index" @click="selectPlant(index)">
                <img :src="failedPlantPhotos.has(index) ? plantPlaceholder : item.plant?.photoUrl || plantPlaceholder"
                  alt="" @error="failedPlantPhotos.add(index)" />
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
            <h4>Care instructions</h4>
            <p class="preserve-lines">{{ activePlant.careInstructions || 'No additional instructions.' }}</p>
          </article>
        </div>
      </section>

      <!-- Each proof belongs to a plant, so owners can check every plant's care. -->
      <section v-if="visit.status === 'completed'" class="panel" aria-labelledby="completion-heading">
        <h2 id="completion-heading">Completed visit</h2>
        <p>Completed at {{ formatDate(visit.doneAt, true) }} (Singapore time)</p>
        <div class="plant-grid">
          <article v-for="item in visit.items" :key="item.requestItemId">
            <h3>{{ item.plant?.plantName || 'Plant' }}</h3>
            <p class="preserve-lines">{{ item.action }}</p>
            <a v-if="item.proofUrl" :href="item.proofUrl" target="_blank" rel="noopener noreferrer">
              <img class="proof" :src="item.proofUrl" :alt="`Care proof for ${item.plant?.plantName || 'plant'}`" />
            </a>
            <p v-else>No photo proof available.</p>
          </article>
        </div>
      </section>

      <section v-if="visit.status === 'completed'" class="panel" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading">Care reviews</h2>
        <p v-if="ownReview" role="status">Your review has been submitted.</p>
        <article v-for="review in reviews" :key="review.reviewId" class="saved-review">
          <strong>{{ review.creatorId === visit.request?.ownerId ? 'Owner' : 'Sitter' }} review</strong>
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
            <button class="btn btn-primary" type="submit">{{ saving ? 'Submitting…' : 'Submit review' }}</button>
          </fieldset>
        </form>
      </section>
    </template>
  </main>
</template>

<style scoped>
.visit-detail {
  max-width: 960px;
  margin: auto;
  padding: 1rem 1rem 3rem;
}
.participant-label {
  margin-bottom: 0.5rem;
  font-weight: 600;
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
  margin-bottom: 1rem;
}
.participant-row .participant-link {
  min-width: 0;
  overflow-wrap: anywhere;
}
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
@media (max-width: 420px) {
  .participant-row {
    flex-wrap: wrap;
  }
  .participant-rating {
    margin-left: auto;
  }
}
.participant-link:hover span {
  text-decoration: underline;
}
.participant-link:focus-visible {
  outline: 2px solid #28623a;
  outline-offset: 4px;
  border-radius: 4px;
}
.panel {
  margin-top: 1rem;
  padding: 1.5rem;
  border: 1px solid #dce5dc;
  border-radius: 16px;
  background: #fff;
}
.status {
  display: inline-block;
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  background: #e7f3e9;
  color: #28623a;
  text-transform: capitalize;
}
h1 { margin-top: 0.75rem; }
h2 { font-size: 1.35rem; }
h3 { font-size: 1.05rem; }
.plant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 1rem;
}
/* A full photo and its facts share a row on desktop and stack on phones. */
.plant-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.5rem; }
.plant-gallery, .plant-info { min-width: 0; }
.plant-photo {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: #f0f6f1;
  touch-action: pan-y;
}
.plant-photo > img { width: 100%; height: 100%; object-fit: contain; }
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
.previous { left: 0.5rem; }
.next { right: 0.5rem; }
.photo-count { position: absolute; top: 0.5rem; right: 0.5rem; padding: 0.2rem 0.6rem; border-radius: 20px; background: #fff; }
.plant-thumbnails { display: flex; gap: 0.5rem; overflow-x: auto; padding: 0.5rem 0; }
.plant-thumbnails button { flex: 0 0 56px; height: 56px; padding: 3px; border: 2px solid transparent; border-radius: 8px; background: #f0f6f1; }
.plant-thumbnails button[aria-pressed='true'] { border-color: #28623a; }
.plant-thumbnails img { width: 100%; height: 100%; object-fit: contain; }
.plant-info h3 { font-size: 1.5rem; overflow-wrap: anywhere; }
.plant-info h4 { font-size: 1rem; }
.plant-label, .plant-facts dt { color: #607166; font-size: 0.8rem; }
.plant-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
.plant-facts dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.back-button { border: 0; background: transparent; color: #28623a; padding: 0.25rem 0; font-weight: 600; }
@media (max-width: 640px) {
  .plant-layout { grid-template-columns: minmax(0, 1fr); }
}
.proof { width: 100%; max-height: 360px; object-fit: contain; }
.preserve-lines { white-space: pre-wrap; overflow-wrap: anywhere; }
.saved-review { padding: 1rem 0; border-bottom: 1px solid #dce5dc; }
form { margin-top: 1.5rem; }
fieldset { border: 0; padding: 0; min-width: 0; }
label, textarea { display: block; width: 100%; margin-bottom: 0.75rem; }
textarea { border: 1px solid #b8c9bc; border-radius: 8px; padding: 0.75rem; }
</style>
