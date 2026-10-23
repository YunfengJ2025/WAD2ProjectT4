<script setup>
import { computed, ref, watch } from 'vue'
import ReviewCard from '@/components/review/ReviewCard.vue'
import ReviewForm from '@/components/review/ReviewForm.vue'
import { useToast } from '@/composables/useToast'

// Frontend preview fixtures only. No sample data is sent to the review API.
// Replace these targets with completed visits and actual posts when those modules are ready.
const targets = [
  {
    key: 'visit-101',
    type: 'VISIT',
    visitId: 101,
    receiverId: 2,
    creatorId: 1,
    creatorRole: 'Request maker',
    receiverName: 'Wei Ming',
    receiverRole: 'Sitter',
    title: 'Weekend watering · Bishan',
  },
  {
    key: 'visit-102',
    type: 'VISIT',
    visitId: 102,
    receiverId: 3,
    creatorId: 1,
    creatorRole: 'Sitter',
    receiverName: 'Jamie Lim',
    receiverRole: 'Request maker',
    title: 'Balcony plant care · Tampines',
  },
  { key: 'visit-101-owner', type: 'VISIT', visitId: 101, creatorId: 2, receiverId: 1, creatorRole: 'Sitter', receiverName: 'You', receiverRole: 'Request maker', title: 'Weekend watering · Bishan' },
  { key: 'post-201', type: 'POST', postId: 201, receiverId: 4, title: 'A new leaf on my monstera' },
]
const reviews = ref([
  {
    reviewId: 1,
    type: 'VISIT',
    visitId: 101,
    creatorId: 5,
    creatorName: 'Cheryl Tan',
    receiverId: 2,
    creatorRole: 'Request maker',
    receiverName: 'Wei Ming',
    receiverRole: 'Sitter',
    rating: 5,
    targetTitle: targets[0].title,
    comment:
      'My plants were in such good hands while I was away. Loved the photo updates, and my basil looks happier than ever!',
    createdAt: '2026-10-22T10:00:00+08:00',
  },
  {
    reviewId: 2,
    type: 'POST',
    postId: 201,
    creatorId: 6,
    creatorName: 'Amir Rahman',
    receiverId: 4,
    rating: null,
    targetTitle: 'A new leaf on my monstera',
    comment: 'That new leaf is beautiful! How often do you water it in this weather?',
    createdAt: '2026-10-21T12:00:00+08:00',
  },
  {
    reviewId: 3,
    type: 'VISIT',
    visitId: 102,
    creatorId: 7,
    creatorName: 'Jamie Lim',
    receiverId: 3,
    creatorRole: 'Sitter',
    receiverName: 'Jamie Lim',
    receiverRole: 'Request maker',
    rating: 4,
    targetTitle: targets[1].title,
    comment:
      'Clear care instructions and easy access to the balcony garden. It was a pleasure looking after the plants.',
    createdAt: '2026-10-20T09:00:00+08:00',
  },
  {
    reviewId: 4,
    type: 'REVIEW',
    parentReviewId: 2,
    creatorId: 2,
    creatorName: 'Wei Ming',
    receiverId: 6,
    comment: 'About once a week, after checking that the soil has dried out.',
    createdAt: '2026-10-22T11:00:00+08:00',
  },
])
const filter = ref('ALL')
const search = ref('')
const sort = ref('newest')
const composing = ref(false)
const previewUserId = ref(1)
watch(previewUserId, () => { composing.value = false })
const { show: toast } = useToast()
const topLevel = computed(() => reviews.value.filter((review) => review.type !== 'REVIEW'))
const visits = computed(() => topLevel.value.filter((review) => review.type === 'VISIT'))
const average = computed(() =>
  visits.value.length
    ? (visits.value.reduce((sum, review) => sum + review.rating, 0) / visits.value.length).toFixed(
        1,
      )
    : '—',
)
const availableTargets = computed(() =>
  targets.filter(
    (target) =>
      target.type !== 'VISIT' ||
      (target.creatorId === previewUserId.value && !reviews.value.some(
        (review) =>
          review.type === 'VISIT' && review.creatorId === previewUserId.value && review.visitId === target.visitId,
      )),
  ),
)
const visibleReviews = computed(() =>
  topLevel.value
    .filter(
      (review) =>
        (filter.value === 'ALL' || review.type === filter.value) &&
        `${review.creatorName} ${review.targetTitle} ${review.comment}`
          .toLowerCase()
          .includes(search.value.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort.value === 'newest'
        ? new Date(b.createdAt) - new Date(a.createdAt)
        : new Date(a.createdAt) - new Date(b.createdAt),
    ),
)

function shareReview({ target, rating, comment }) {
  if (!availableTargets.value.includes(target)) return
  reviews.value.unshift({
    reviewId: Date.now(),
    type: target.type,
    visitId: target.visitId ?? null,
    postId: target.postId ?? null,
    receiverId: target.receiverId,
    creatorId: previewUserId.value,
    creatorName: previewUserId.value === 1 ? 'You' : 'Wei Ming',
    creatorRole: target.creatorRole,
    receiverName: target.receiverName,
    receiverRole: target.receiverRole,
    rating,
    comment,
    targetTitle: target.title,
    createdAt: new Date().toISOString(),
  })
  composing.value = false
  filter.value = 'ALL'
  search.value = ''
  sort.value = 'newest'
  toast('Review added to this preview.')
}
function shareReply(parent, comment) {
  if (parent.type !== 'POST') return
  reviews.value.push({
    reviewId: Date.now(),
    type: 'REVIEW',
    parentReviewId: parent.reviewId,
    creatorId: previewUserId.value,
    creatorName: previewUserId.value === 1 ? 'You' : 'Wei Ming',
    receiverId: parent.creatorId,
    comment,
    createdAt: new Date().toISOString(),
  })
  toast('Reply added to this preview.')
}
</script>

<template>
  <main class="reviews-page">
    <div class="preview-note">
      <span class="preview-tag">Preview</span> Sample community reviews. Changes last until you
      leave or refresh this page.
    </div>
    <div class="preview-note">
      <label for="preview-reviewer">Preview as</label>
      <select id="preview-reviewer" v-model.number="previewUserId">
        <option :value="1">You — request maker for Bishan, sitter for Tampines</option>
        <option :value="2">Wei Ming — sitter for Bishan</option>
      </select>
    </div>
    <header class="page-heading">
      <div>
        <p class="eyebrow">GROWING TOGETHER</p>
        <h1>A little care. A lot of gratitude.</h1>
        <p class="subtitle">
          Kind words, helpful feedback, and conversations from our plant community.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :aria-expanded="composing"
        @click="composing = !composing"
      >
        {{ composing ? 'Close form' : '+ Write a review' }}
      </button>
    </header>
    <section class="summary" aria-label="Review overview">
      <div>
        <strong>{{ average }} <span class="gold" aria-hidden="true">★</span></strong
        ><span>Average visit rating</span>
      </div>
      <div>
        <strong>{{ visits.length }}</strong
        ><span>Care visit reviews</span>
      </div>
      <div>
        <strong>{{ topLevel.length - visits.length }}</strong
        ><span>Post comments</span>
      </div>
    </section>
    <ReviewForm
      v-if="composing"
      :targets="availableTargets"
      @submit="shareReview"
      @cancel="composing = false"
    />
    <section class="community" aria-labelledby="community-title">
      <h2 id="community-title">Community voices</h2>
      <div class="toolbar">
        <div class="filters" role="group" aria-label="Filter reviews">
          <button
            v-for="tab in [
              { value: 'ALL', label: 'All' },
              { value: 'VISIT', label: 'Care visits' },
              { value: 'POST', label: 'Post comments' },
            ]"
            :key="tab.value"
            type="button"
            :aria-pressed="filter === tab.value"
            @click="filter = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="search-sort">
          <label class="sr-only" for="review-search">Search reviews</label
          ><input id="review-search" v-model="search" type="search" placeholder="Search reviews…" />
          <label class="sr-only" for="review-sort">Sort reviews</label
          ><select id="review-sort" v-model="sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>
      <p class="result-count" role="status">
        {{ visibleReviews.length }} {{ visibleReviews.length === 1 ? 'review' : 'reviews' }}
      </p>
      <div v-if="visibleReviews.length" class="review-list">
        <ReviewCard
          v-for="review in visibleReviews"
          :key="review.reviewId"
          :review="review"
          :replies="reviews.filter((reply) => reply.parentReviewId === review.reviewId)"
          @reply="shareReply(review, $event)"
        />
      </div>
      <div v-else class="empty">
        <h3>No reviews found</h3>
        <p>Try another search or filter to find a community conversation.</p>
        <button
          type="button"
          class="btn"
          @click="
            search = '',
            filter = 'ALL'
          "
        >
          Clear filters
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.reviews-page {
  max-width: 1000px;
  margin: 2rem auto 4rem;
  color: #243b2c;
  animation: appear 0.4s ease both;
}
.preview-note {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  font-size: 0.82rem;
  color: #607166;
  padding-bottom: 1.5rem;
}
.preview-tag {
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  background: #eef2df;
  color: #58612c;
  font-weight: 700;
}
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
}
.eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  font-weight: 700;
  color: #527e5c;
  margin-bottom: 0.6rem;
}
h1 {
  font-size: clamp(1.9rem, 4vw, 2.8rem);
  letter-spacing: -0.04em;
  color: #224b31;
  margin-bottom: 0.7rem;
}
.subtitle {
  color: #607166;
  max-width: 540px;
  line-height: 1.7;
  margin: 0;
}
.page-heading .btn {
  flex-shrink: 0;
}
.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid #dce7dd;
  border-radius: 20px;
  background: #f8fbf4;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.summary > div {
  display: grid;
  gap: 0.25rem;
  padding: 0 1.5rem;
  border-right: 1px solid #dce7dd;
}
.summary > div:last-child {
  border: 0;
}
.summary strong {
  font-size: 2rem;
  font-family: var(--font-heading);
}
.summary span {
  color: #607166;
  font-size: 0.85rem;
}
.summary .gold {
  color: #a96b08;
  font-size: 1.5rem;
}
.community {
  margin-top: 2.5rem;
}
h2 {
  font-size: 1.4rem;
  margin-bottom: 1.2rem;
}
.toolbar,
.search-sort {
  display: flex;
  gap: 0.6rem;
  justify-content: space-between;
  flex-wrap: wrap;
}
.filters {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: #eaf0e7;
  border-radius: 12px;
}
.filters button {
  background: transparent;
  border: 0;
  color: #526658;
  border-radius: 9px;
  padding: 0.65rem 0.9rem;
  font: inherit;
  font-size: 0.85rem;
}
.filters button[aria-pressed='true'] {
  background: white;
  color: #245d37;
  box-shadow: 0 2px 5px #244d3010;
  font-weight: 600;
}
.search-sort input,
.search-sort select {
  border: 1px solid #ccd9ce;
  border-radius: 10px;
  padding: 0.65rem;
  background: white;
  color: #415c49;
  font: inherit;
  font-size: 0.85rem;
  min-width: 0;
}
.result-count {
  margin: 1rem 0;
  color: #607166;
  font-size: 0.8rem;
}
.review-list {
  display: grid;
  gap: 1rem;
}
.empty {
  text-align: center;
  padding: 3rem 1rem;
  background: white;
  border-radius: 20px;
}
.empty p {
  color: #607166;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid #2f7d4a;
  outline-offset: 3px;
}
@keyframes appear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 650px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .summary {
    padding: 1rem 0.25rem;
  }
  .summary > div {
    padding: 0 0.7rem;
  }
  .summary strong {
    font-size: 1.5rem;
  }
  .summary span {
    font-size: 0.72rem;
  }
  .search-sort {
    width: 100%;
  }
  .search-sort input {
    flex: 1;
    width: 130px;
  }
  .preview-note {
    align-items: flex-start;
  }
}
@media (prefers-reduced-motion: reduce) {
  .reviews-page {
    animation: none;
  }
}
</style>
