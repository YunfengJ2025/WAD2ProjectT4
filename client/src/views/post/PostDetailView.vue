<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { request } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/user/UserAvatar.vue'
import LikeButton from '@/components/post/LikeButton.vue'
import ReviewCard from '@/components/review/ReviewCard.vue'
import '@/assets/community.css'

const route = useRoute()
const router = useRouter()
// Use app navigation history; direct visits fall back to the relevant listing.
function goBack() {
  if (router.options.history.state.back) router.back()
  else router.replace('/community')
}
const auth = useAuthStore()
const post = ref(null)
const reviews = ref([])
const loading = ref(true)
const error = ref('')
const reviewError = ref('')
const comment = ref('')
const saving = ref(false)
const replying = ref(null)
const active = ref(0)
const photoOffset = ref(0)
const photoDragging = ref(false)
let photoGesture = null
// Preserve vertical page scrolling; capture only gestures that are predominantly horizontal.
function startPhotoDrag(event) {
  if (images.value.length < 2 || event.target.closest('button') || event.button > 0) return
  photoGesture = { id: event.pointerId, x: event.clientX, y: event.clientY }
}
function movePhotoDrag(event) {
  if (!photoGesture || photoGesture.id !== event.pointerId) return
  const dx = event.clientX - photoGesture.x
  const dy = event.clientY - photoGesture.y
  if (!photoDragging.value && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { photoGesture = null; return }
  if (Math.abs(dx) > 8) {
    photoDragging.value = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    photoOffset.value = dx * .6
  }
}
function endPhotoDrag(event) {
  if (!photoGesture) return
  const dx = event.clientX - photoGesture.x
  const threshold = Math.min(70, event.currentTarget.clientWidth * .15)
  if (photoDragging.value && Math.abs(dx) > threshold) move(dx < 0 ? 1 : -1)
  cancelPhotoDrag()
}
function cancelPhotoDrag() { photoGesture = null; photoDragging.value = false; photoOffset.value = 0 }
const failedImages = ref(new Set())
const images = computed(() => post.value?.postImages || [])
const comments = computed(() => reviews.value.filter((review) => review.type === 'POST'))
const author = (record) => ({
  userName: record.creatorName || `User #${record.creatorId}`,
  photoUrl: record.creatorPhoto,
})
function move(amount) {
  active.value = (active.value + amount + images.value.length) % images.value.length
}
// Load post comments and their replies through the existing review endpoint.
async function loadReviews() {
  reviewError.value = ''
  try {
    reviews.value = await request(`/review/post/${route.params.postId}`)
  } catch (err) {
    reviewError.value = err.message
  }
}
// Reset detail-page state before loading the selected post and its discussion.
async function load() {
  loading.value = true
  error.value = ''
  post.value = null
  reviews.value = []
  active.value = 0
  failedImages.value = new Set()
  try {
    post.value = await request(`/post/${route.params.postId}`)
    await loadReviews()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
watch(() => route.params.postId, load, { immediate: true })
// Send an authenticated reply; append it only after the server confirms creation.
async function shareReply(review, message) {
  if (replying.value !== null) return
  replying.value = review.reviewId
  reviewError.value = ''
  try {
    const result = await auth.authorizedRequest('/review/me/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentReviewId: review.reviewId, comment: message }),
    })
    reviews.value.push({
      ...result,
      creatorName: auth.user.userName,
      creatorPhotoUrl: auth.user.photoUrl,
    })
  } catch (err) {
    reviewError.value = err.message
  } finally {
    replying.value = null
  }
}
// Keep the draft on failure and insert the new review after a successful request.
async function shareReview() {
  if (saving.value || !comment.value.trim()) return
  saving.value = true
  reviewError.value = ''
  try {
    const review = await auth.authorizedRequest(`/post/${post.value.postId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: comment.value.trim() }),
    })
    reviews.value.unshift(review)
    comment.value = ''
  } catch (err) {
    reviewError.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="community-detail">
    <button type="button" class="community-back community-back-button" @click="goBack">← Back</button>
    <p v-if="loading" role="status" class="community-state">Loading post…</p>
    <div v-else-if="error" role="alert" class="community-panel community-state">
      <h1>Couldn't load this post</h1>
      <p>{{ error }}</p>
      <button class="btn" @click="load">Try again</button>
    </div>
    <article
      v-else-if="post"
      class="community-detail-layout community-panel"
      :class="{ 'community-no-images': !images.length }"
    >
      <section
        v-if="images.length"
        class="community-gallery"
        aria-label="Post photos"
        aria-roledescription="carousel"
        tabindex="0"
        @keydown.left.prevent="move(-1)"
        @keydown.right.prevent="move(1)"
      >
        <div class="community-gallery-stage" :class="{ 'photo-dragging': photoDragging }" @pointerdown="startPhotoDrag" @pointermove="movePhotoDrag" @pointerup="endPhotoDrag" @pointercancel="cancelPhotoDrag" @lostpointercapture="cancelPhotoDrag" @dragstart.prevent>
          <Transition name="post-photo" mode="out-in">
          <img
            v-if="!failedImages.has(active)"
            :key="images[active]"
            class="post-gallery-photo"
            :style="{ transform: `translateX(${photoOffset}px)` }"
            draggable="false"
            :src="images[active]"
            :alt="`Post photo ${active + 1} of ${images.length}`"
            @error="failedImages.add(active)"
          />
          <p v-else :key="`failed-${active}`" class="community-muted">This photo is unavailable.</p>
          </Transition>
          <template v-if="images.length > 1">
            <span class="community-gallery-count" aria-live="polite"
              >{{ active + 1 }} / {{ images.length }}</span
            >
            <button
              class="community-gallery-arrow previous"
              aria-label="Previous photo"
              @click="move(-1)"
            >
              ‹
            </button>
            <button class="community-gallery-arrow next" aria-label="Next photo" @click="move(1)">
              ›
            </button>
          </template>
        </div>
        <div v-if="images.length > 1" class="community-gallery-dots" aria-label="Choose photo">
          <button
            v-for="(image, index) in images"
            :key="index"
            :aria-label="`Show photo ${index + 1}`"
            :aria-pressed="active === index"
            @click="active = index"
          >
            <img :src="image" alt="" />
          </button>
        </div>
      </section>
      <section class="community-detail-discussion">
        <header class="community-author">
          <RouterLink
            :to="`/profile/${post.creatorId}`"
            :aria-label="`View ${author(post).userName}'s profile`"
            ><UserAvatar :user="author(post)" :size="44"
          /></RouterLink>
          <div>
            <RouterLink :to="`/profile/${post.creatorId}`" class="community-author-name">{{
              author(post).userName
            }}</RouterLink>
            <p class="community-muted">Community member</p>
          </div>
        </header>
        <h1 class="community-detail-title">{{ post.title }}</h1>
        <p class="community-content">{{ post.content }}</p>
        <LikeButton :post="post" />
        <section class="community-review-thread" aria-labelledby="post-reviews-heading">
          <h2 id="post-reviews-heading">
            Reviews <span class="community-muted">({{ comments.length }})</span>
          </h2>
          <div v-if="reviewError" role="alert" class="community-error">
            <p>{{ reviewError }}</p>
            <button type="button" class="btn" @click="loadReviews">Reload reviews</button>
          </div>
          <p v-if="!reviews.length && !reviewError" class="community-muted">
            No reviews yet. Start the conversation!
          </p>
          <ReviewCard
            v-for="review in comments"
            :key="review.reviewId"
            source="post"
            :review="review"
            :replies="reviews.filter((reply) => reply.parentReviewId === review.reviewId)"
            :can-reply="auth.isAuthenticated"
            :busy="replying !== null"
            @reply="shareReply(review, $event)"
          />
        </section>
        <form
          v-if="auth.isAuthenticated"
          class="community-review-form"
          @submit.prevent="shareReview"
        >
          <label for="new-review">Add a review</label>
          <textarea
            id="new-review"
            v-model="comment"
            rows="3"
            maxlength="1000"
            required
            placeholder="Share a thought or a little advice…"
            :disabled="saving"
          ></textarea>
          <button class="btn btn-primary" type="submit" :disabled="saving || !comment.trim()">
            {{ saving ? 'Sharing…' : 'Share review' }}
          </button>
        </form>
        <RouterLink
          v-else
          :to="{ name: 'sign-in', query: { redirect: route.fullPath } }"
          class="btn community-signin"
          >Sign in to leave a review</RouterLink
        >
      </section>
    </article>
  </main>
</template>
