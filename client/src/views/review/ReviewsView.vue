<script setup>
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useReviewsStore } from '@/stores/reviews'
import ReviewCard from '@/components/review/ReviewCard.vue'
import StarRating from '@/components/review/StarRating.vue'
import '@/assets/reviews.css'

const auth = useAuthStore()
const store = useReviewsStore()
const direction = ref('received')
const filter = ref('ALL')
const search = ref('')
const sort = ref('newest')
const busy = ref(null)
const replyError = ref('')
watch(
  () => auth.user?.userId,
  (id) => {
    direction.value = 'received'
    filter.value = 'ALL'
    search.value = ''
    replyError.value = ''
    if (id) store.fetchReviews()
  },
  { immediate: true },
)
// Keep summary ratings independent of the active direction, type, and search filters.
const received = computed(() =>
  store.reviews.filter((item) => item.receiverId === auth.user?.userId),
)
const written = computed(() => store.reviews.filter((item) => item.creatorId === auth.user?.userId))
const ratings = computed(() =>
  received.value.filter((item) => item.type === 'VISIT' && Number.isFinite(item.rating)),
)
const average = computed(() =>
  ratings.value.length
    ? (ratings.value.reduce((sum, item) => sum + item.rating, 0) / ratings.value.length).toFixed(1)
    : '—',
)
// Counts follow the direction tab, but not the search query, so categories stay discoverable.
const directionReviews = computed(() =>
  direction.value === 'received' ? received.value : written.value,
)
const typeOptions = computed(() =>
  [
    { value: 'ALL', label: 'All', icon: '◉' },
    { value: 'VISIT', label: 'Care visits', icon: '✦' },
    { value: 'POST', label: 'Post comments', icon: '☷' },
    { value: 'REVIEW', label: 'Replies', icon: '↳' },
  ].map((tab) => ({
    ...tab,
    count: directionReviews.value.filter((item) => tab.value === 'ALL' || item.type === tab.value)
      .length,
  })),
)
const hasFilters = computed(() => !!search.value.trim() || filter.value !== 'ALL')
function clearFilters() {
  search.value = ''
  filter.value = 'ALL'
}
const visibleReviews = computed(() =>
  directionReviews.value
    .filter(
      (item) =>
        (filter.value === 'ALL' || item.type === filter.value) &&
        [item.creatorName, item.receiverName, item.comment, item.visitId, item.postId]
          .join(' ')
          .toLowerCase()
          .includes(search.value.trim().toLowerCase()),
    )
    .slice()
    .sort((a, b) =>
      sort.value === 'newest'
        ? new Date(b.createdAt) - new Date(a.createdAt)
        : new Date(a.createdAt) - new Date(b.createdAt),
    ),
)
function displayReview(review) {
  return {
    ...review,
    // Use the live Pinia profile for our own entries after a profile-photo change.
    creatorPhotoUrl:
      review.creatorId === auth.user?.userId ? auth.user.photoUrl || '' : review.creatorPhotoUrl,
    targetTitle:
      review.type === 'VISIT'
        ? 'Care visit #' + review.visitId
        : review.type === 'POST'
          ? 'Post #' + review.postId
          : 'Reply to comment #' + review.parentReviewId,
  }
}
async function shareReply(review, comment) {
  if (busy.value !== null) return
  busy.value = review.reviewId
  replyError.value = ''
  try {
    await store.reply(review, comment)
  } catch (err) {
    replyError.value = err.message
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <main class="reviews-page container-fluid px-0">
    <header
      class="page-heading d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3"
    >
      <div>
        <p class="review-eyebrow">YOUR COMMUNITY PROFILE</p>
        <h1>My reviews &amp; ratings<span class="review-heading-dot">.</span></h1>
        <p class="review-muted mb-0">
          A little feedback helps our plant community grow. Here’s yours.
        </p>
      </div>
      <button
        type="button"
        class="btn review-outline-button align-self-start"
        :disabled="store.loading"
        @click="store.fetchReviews()"
      >
        <span aria-hidden="true" :class="{ 'review-spin': store.loading }">↻</span>
        {{ store.loading ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>
    <p v-if="!auth.user">Sign in to see your reviews.</p>
    <template v-else>
      <!-- Bootstrap columns stack the rating card on phones and share a row on larger screens. -->
      <section class="row g-3 mb-4" aria-label="Review overview">
        <div class="col-12 col-md-6">
          <div class="review-surface review-rating-summary h-100">
            <p class="review-eyebrow mb-2">A LITTLE COMMUNITY LOVE</p>
            <div class="d-flex align-items-center flex-wrap gap-3">
              <strong class="review-average" data-testid="average-rating">{{
                store.loading || store.error ? '—' : average
              }}</strong>
              <div v-if="!store.loading && !store.error && ratings.length">
                <StarRating :model-value="Number(average)" readonly />
                <p class="review-muted small mb-0">
                  out of 5 · {{ ratings.length }} visit
                  {{ ratings.length === 1 ? 'review' : 'reviews' }}
                </p>
              </div>
              <p v-else class="review-muted mb-0">
                {{ store.loading ? 'Loading your rating…' : 'No rating to show yet' }}
              </p>
            </div>
            <p class="review-muted small mt-3 mb-0">Based on care visit reviews you received.</p>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="review-surface review-stat h-100">
            <span class="review-stat-icon" aria-hidden="true">✦</span
            ><strong>{{ store.loading || store.error ? '—' : ratings.length }}</strong
            ><span class="review-muted small">Visit reviews received</span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="review-surface review-stat h-100">
            <span class="review-stat-icon review-stat-icon-amber" aria-hidden="true">✎</span
            ><strong>{{ store.loading || store.error ? '—' : written.length }}</strong
            ><span class="review-muted small">Reviews &amp; replies written</span>
          </div>
        </div>
      </section>
      <section class="review-surface review-panel" aria-labelledby="reviews-heading">
        <div
          class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4"
        >
          <div>
            <p class="review-eyebrow mb-1">THE CONVERSATION</p>
            <h2 id="reviews-heading" class="mb-0">Your reviews</h2>
          </div>
          <div class="review-direction" role="group" aria-label="Review direction">
            <button
              type="button"
              :aria-pressed="direction === 'received'"
              @click="direction = 'received'"
            >
              About me
            </button>
            <button
              type="button"
              :aria-pressed="direction === 'written'"
              @click="direction = 'written'"
            >
              Written by me
            </button>
          </div>
        </div>
        <!-- Native buttons retain keyboard activation; aria-pressed announces the selected filter. -->
        <div class="review-type-bar" role="group" aria-label="Filter reviews">
          <button
            v-for="tab in typeOptions"
            :key="tab.value"
            type="button"
            class="review-type-button"
            :aria-pressed="filter === tab.value"
            :aria-label="tab.label"
            @click="filter = tab.value"
          >
            <span class="review-type-icon" aria-hidden="true">{{ tab.icon }}</span
            ><span>{{ tab.label }}</span
            ><span class="review-count" aria-hidden="true">{{
              store.loading || store.error ? '—' : tab.count
            }}</span>
          </button>
        </div>
        <div class="row g-2 align-items-center my-3">
          <div class="col-12 col-sm-8">
            <div class="review-search">
              <span aria-hidden="true">⌕</span
              ><label class="visually-hidden" for="review-search">Search reviews</label
              ><input
                id="review-search"
                v-model="search"
                class="form-control"
                type="search"
                placeholder="Search names, reviews or posts…"
              />
            </div>
          </div>
          <div class="col-12 col-sm-4">
            <label class="visually-hidden" for="review-sort">Sort reviews</label
            ><select id="review-sort" v-model="sort" class="form-select">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
        <p v-if="store.loading" role="status" class="review-state">
          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading your
          reviews…
        </p>
        <div v-else-if="store.error" role="alert" class="review-state">
          <h3>Couldn’t load your reviews</h3>
          <p class="review-muted">{{ store.error }}</p>
          <button type="button" class="btn review-outline-button" @click="store.fetchReviews()">
            Try again
          </button>
        </div>
        <template v-else>
          <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
            <p class="review-muted small mb-0" role="status">
              {{ visibleReviews.length }} {{ visibleReviews.length === 1 ? 'review' : 'reviews' }}
              {{ direction === 'received' ? 'about you' : 'written by you' }}
            </p>
            <button
              v-if="hasFilters"
              type="button"
              class="review-text-button"
              @click="clearFilters"
            >
              Clear filters
            </button>
          </div>
          <p v-if="replyError" role="alert" class="alert alert-danger">{{ replyError }}</p>
          <!-- A keyed list keeps each reply draft attached to its review after sorting/filtering. -->
          <div v-if="visibleReviews.length" class="review-list">
            <ReviewCard
              v-for="review in visibleReviews"
              :key="review.reviewId"
              :review="displayReview(review)"
              :busy="busy !== null"
              :replies="
                store.reviews
                  .filter(
                    (reply) => reply.type === 'REVIEW' && reply.parentReviewId === review.reviewId,
                  )
                  .map(displayReview)
              "
              @reply="shareReply(review, $event)"
            />
          </div>
          <div v-else class="review-state">
            <span class="review-empty-icon" aria-hidden="true">❧</span>
            <h3>
              {{
                hasFilters
                  ? 'No matching reviews'
                  : direction === 'received'
                    ? 'Your story is still growing'
                    : 'Your words can make someone’s day'
              }}
            </h3>
            <p class="review-muted">
              {{
                hasFilters
                  ? 'Try a different search or review type.'
                  : direction === 'received'
                    ? 'Care visit reviews and comments on your posts will appear here.'
                    : 'Your care visit reviews, post comments, and replies will appear here.'
              }}
            </p>
            <button
              v-if="hasFilters"
              type="button"
              class="btn review-outline-button"
              @click="clearFilters"
            >
              Clear filters
            </button>
          </div>
        </template>
      </section>
    </template>
  </main>
</template>
