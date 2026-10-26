<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useReviewsStore } from '@/stores/reviews'
import StarRating from '@/components/review/StarRating.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'

const auth = useAuthStore()
const store = useReviewsStore()
const track = ref(null)
const dragging = ref(false)
let drag = null

watch(
  () => auth.user?.userId,
  (id) => {
    if (id) store.fetchReviews()
  },
  { immediate: true },
)

const received = computed(() =>
  store.reviews
    .filter((review) => review.receiverId === auth.user?.userId)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
)
const recent = computed(() => received.value.slice(0, 6))

function dateLabel(value) {
  return new Date(value).toLocaleDateString('en-SG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  })
}

function startDrag(event) {
  // Touch screens use native scrolling; add click-and-drag for a mouse.
  if (event.pointerType !== 'mouse' || event.button !== 0) return
  if (event.target.closest('a')) return
  drag = { id: event.pointerId, x: event.clientX, scroll: track.value.scrollLeft }
  track.value.setPointerCapture(event.pointerId)
}
function moveDrag(event) {
  if (!drag || drag.id !== event.pointerId) return
  if (Math.abs(event.clientX - drag.x) > 4) dragging.value = true
  if (dragging.value) track.value.scrollLeft = drag.scroll - (event.clientX - drag.x)
}
function stopDrag() {
  drag = null
  dragging.value = false
}
function scroll(direction) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  track.value?.scrollBy({
    left: direction * track.value.clientWidth * 0.85,
    behavior: reducedMotion ? 'instant' : 'smooth',
  })
}
</script>

<template>
  <section id="profile-reviews" class="profile-reviews" aria-labelledby="profile-reviews-heading">
    <div class="reviews-heading">
      <div>
        <h2 id="profile-reviews-heading">My reviews</h2>
        <p>Kind words and feedback from your neighbours.</p>
      </div>
      <div
        v-if="!store.loading && !store.error && recent.length > 1"
        class="scroll-buttons"
        aria-label="Browse recent reviews"
      >
        <button type="button" aria-label="Previous reviews" @click="scroll(-1)">←</button>
        <button type="button" aria-label="Next reviews" @click="scroll(1)">→</button>
      </div>
    </div>

    <p v-if="store.loading" class="review-state" role="status">Loading your reviews…</p>
    <div v-else-if="store.error" class="review-state" role="alert">
      <p>{{ store.error }}</p>
      <button type="button" class="retry-button" @click="store.fetchReviews()">Try again</button>
    </div>
    <p v-else-if="!recent.length" class="review-state">
      No reviews received yet. Feedback from your neighbours will appear here.
    </p>
    <template v-else>
      <p id="reviews-scroll-hint" class="scroll-hint">
        Drag or swipe to explore · Showing {{ recent.length }} of {{ received.length }}
      </p>
      <ul
        ref="track"
        class="reviews-track"
        :class="{ dragging }"
        tabindex="0"
        aria-label="Recent reviews"
        aria-describedby="reviews-scroll-hint"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="stopDrag"
        @pointercancel="stopDrag"
        @lostpointercapture="stopDrag"
        @keydown.left.prevent="scroll(-1)"
        @keydown.right.prevent="scroll(1)"
      >
        <li v-for="review in recent" :key="review.reviewId" class="review-preview">
          <header>
            <RouterLink
              v-if="review.creatorId"
              :to="`/profile/${review.creatorId}`"
              :aria-label="`View ${review.creatorName || 'neighbour'}'s profile`"
            >
              <UserAvatar
                :user="{
                  userName: review.creatorName || 'Neighbour',
                  photoUrl: review.creatorPhotoUrl,
                }"
                :size="40"
              />
            </RouterLink>
            <UserAvatar
              v-else
              :user="{
                userName: review.creatorName || 'Neighbour',
                photoUrl: review.creatorPhotoUrl,
              }"
              :size="40"
            />
            <div>
              <h3>{{ review.creatorName || 'Neighbour' }}</h3>
              <time :datetime="review.createdAt">{{ dateLabel(review.createdAt) }}</time>
            </div>
          </header>
          <span class="review-kind">{{
            review.type === 'VISIT'
              ? 'Care visit'
              : review.type === 'POST'
                ? 'Post comment'
                : 'Reply'
          }}</span>
          <StarRating
            v-if="review.type === 'VISIT' && Number.isFinite(review.rating)"
            :model-value="review.rating"
            readonly
          />
          <p class="review-comment">{{ review.comment }}</p>
        </li>
      </ul>
    </template>
    <RouterLink class="btn all-reviews" to="/reviews"
      >View all reviews <span aria-hidden="true">↗</span></RouterLink
    >
  </section>
</template>

<style scoped>
.profile-reviews {
  border-top: 1px solid var(--color-border);
  padding-top: 1.8rem;
  margin-top: 1.5rem;
  min-width: 0;
  scroll-margin-top: 1.5rem;
}
.reviews-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
h2 {
  font-size: 1.15rem;
  color: var(--color-heading);
  font-weight: 600;
  margin: 0;
}
.reviews-heading p,
.scroll-hint {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0.4rem 0 0;
}
.scroll-buttons {
  display: flex;
  gap: 0.5rem;
}
.scroll-buttons button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--color-border-hover);
  color: var(--color-heading);
  background: var(--surface);
}
.scroll-buttons button:hover {
  background: var(--accent-soft);
}
.scroll-hint {
  margin-top: 1.25rem;
  font-size: 0.7rem;
}
.reviews-track {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 0.6rem 0 1rem;
  margin: 0.5rem 0 1.25rem;
  list-style: none;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  scrollbar-color: var(--accent) var(--accent-soft);
  cursor: grab;
  user-select: none;
}
.reviews-track.dragging {
  cursor: grabbing;
  scroll-snap-type: none;
}
.review-preview {
  flex: 0 0 min(310px, 86%);
  min-width: 0;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--surface);
  scroll-snap-align: start;
}
.review-preview header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
h3 {
  font-size: 0.88rem;
  font-weight: 600;
  margin: 0 0 0.2rem;
  color: var(--color-heading);
  overflow-wrap: anywhere;
}
time {
  font-size: 0.7rem;
  color: var(--muted);
}
.review-kind {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--muted);
  font-size: 0.7rem;
}
.review-comment {
  font-size: 0.85rem;
  line-height: 1.75;
  margin: 0.75rem 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.review-state {
  margin: 1.5rem 0;
  font-size: 0.85rem;
  color: var(--muted);
}
.review-state p {
  margin-bottom: 0.5rem;
}
.retry-button {
  border: 0;
  background: none;
  text-decoration: underline;
  color: var(--accent);
  padding: 0;
}
.all-reviews {
  font-size: 0.82rem;
  gap: 1rem;
  margin-top: 0.25rem;
}
button:focus-visible,
a:focus-visible,
.reviews-track:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
</style>
