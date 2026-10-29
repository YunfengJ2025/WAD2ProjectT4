<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useReviewsStore } from '@/stores/reviews'
import ReviewCard from '@/components/review/ReviewCard.vue'

import { useDragScroll } from '@/composables/useDragScroll'
const auth = useAuthStore()
const store = useReviewsStore()
const track = ref(null)
const { dragging, startDrag, moveDrag, stopDrag, captureClick } = useDragScroll(track)

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
        @click.capture="captureClick"
        @dragstart.prevent
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="stopDrag"
        @pointercancel="stopDrag"
        @lostpointercapture="stopDrag"
        @keydown.left.prevent="scroll(-1)"
        @keydown.right.prevent="scroll(1)"
      >
        <li v-for="review in recent" :key="review.reviewId" class="review-preview">
          <ReviewCard
            source="profile"
            :review="{
              ...review,
              postId:
                review.postId ||
                store.reviews.find((parent) => parent.reviewId === review.parentReviewId)?.postId,
              creatorPhotoUrl:
                review.creatorId === auth.user?.userId
                  ? auth.user.photoUrl
                  : review.creatorPhotoUrl,
              targetTitle:
                review.type === 'VISIT'
                  ? 'Care visit #' + review.visitId
                  : review.type === 'POST'
                    ? 'Post #' + review.postId
                    : 'Reply to comment #' + review.parentReviewId,
            }"
            :replies="store.reviews.filter((reply) => reply.parentReviewId === review.reviewId)"
          />
        </li>
      </ul>
    </template>
    <RouterLink class="btn all-reviews" to="/reviews"
      >View all reviews <span aria-hidden="true">↗</span></RouterLink
    >
  </section>
</template>

<style scoped>
/* Constrain the section width and separate it from surrounding content. */

.profile-reviews {
  border-top: 1px solid var(--color-border);
  padding-top: 1.8rem;
  margin-top: 1.5rem;
  min-width: 0;
  scroll-margin-top: 1.5rem;
}
/* Set typography, spacing and alignment for this component element. */
.reviews-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
/* Set typography, spacing and alignment for this component element. */
h2 {
  font-size: 1.15rem;
  color: var(--color-heading);
  font-weight: 600;
  margin: 0;
}
/* Set typography, spacing and alignment for this component element. */
.reviews-heading p,
/* Support horizontal browsing and visible scroll controls for profile reviews. */
.scroll-hint {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0.4rem 0 0;
}
/* Support horizontal browsing and visible scroll controls for profile reviews. */
.scroll-buttons {
  display: flex;
  gap: 0.5rem;
}
/* Support horizontal browsing and visible scroll controls for profile reviews. */
.scroll-buttons button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--color-border-hover);
  color: var(--color-heading);
  background: var(--surface);
}
/* Highlight the control under the pointer without changing its layout. */
.scroll-buttons button:hover {
  background: var(--accent-soft);
}
/* Support horizontal browsing and visible scroll controls for profile reviews. */
.scroll-hint {
  margin-top: 1.25rem;
  font-size: 0.7rem;
}
/* Support horizontal browsing and visible scroll controls for profile reviews. */
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
/* Support horizontal browsing and visible scroll controls for profile reviews. */
.reviews-track.dragging {
  cursor: grabbing;
  scroll-snap-type: none;
}
/* Lay out a single profile review without adding a second card border or padding. */
.review-preview {
  flex: 0 0 min(340px, 86%);
  min-width: 0;
  scroll-snap-align: start;
}
/* Lay out a single profile review without adding a second card border or padding. */
.review-preview > :deep(.review-card) {
  height: 100%;
  box-sizing: border-box;
}
/* Lay out a single profile review without adding a second card border or padding. */
.review-preview :deep(.review-card header) {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
}
/* Lay out a single profile review without adding a second card border or padding. */
.review-preview :deep(.review-card .identity) {
  min-width: 0;
}
/* Lay out a single profile review without adding a second card border or padding. */
.review-preview :deep(.review-card time) {
  white-space: nowrap;
}
/* Lay out a single profile review without adding a second card border or padding. */
.review-preview :deep(.review-card .kind) {
  grid-column: 1 / -1;
  justify-self: start;
}
/* Lay out a single profile review without adding a second card border or padding. */
.review-preview :deep(.review-card header > a) {
  padding: 0;
  line-height: 1;
}
/* Lay out a single profile review without adding a second card border or padding. */
.review-preview header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
/* Set typography, spacing and alignment for this component element. */
h3 {
  font-size: 0.88rem;
  font-weight: 600;
  margin: 0 0 0.2rem;
  color: var(--color-heading);
  overflow-wrap: anywhere;
}
/* Set typography, spacing and alignment for this component element. */
time {
  font-size: 0.7rem;
  color: var(--muted);
}
/* Set typography, spacing and alignment for this component element. */
.review-kind {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--muted);
  font-size: 0.7rem;
}
/* Set typography, spacing and alignment for this component element. */
.review-comment {
  font-size: 0.85rem;
  line-height: 1.75;
  margin: 0.75rem 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
/* Give loading, empty and error feedback clear spacing and readable emphasis. */
.review-state {
  margin: 1.5rem 0;
  font-size: 0.85rem;
  color: var(--muted);
}
/* Give loading, empty and error feedback clear spacing and readable emphasis. */
.review-state p {
  margin-bottom: 0.5rem;
}
/* Style navigation and action controls consistently with the surrounding panel. */
.retry-button {
  border: 0;
  background: none;
  text-decoration: underline;
  color: var(--accent);
  padding: 0;
}
/* Style navigation and action controls consistently with the surrounding panel. */
.all-reviews {
  font-size: 0.82rem;
  gap: 1rem;
  margin-top: 0.25rem;
}
/* Keep keyboard focus visible for accessible navigation. */
button:focus-visible,
/* Keep keyboard focus visible for accessible navigation. */
a:focus-visible,
/* Keep keyboard focus visible for accessible navigation. */
.reviews-track:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
</style>
