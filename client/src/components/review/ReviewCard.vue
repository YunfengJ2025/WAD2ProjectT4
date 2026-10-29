<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import StarRating from './StarRating.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import '@/assets/reviews.css'
const props = defineProps({
  review: { type: Object, required: true },
  replies: { type: Array, default: () => [] },
  source: { type: String, default: 'reviews', validator: value => ['profile', 'reviews', 'post'].includes(value) },
  canReply: { type: Boolean, default: true },
  busy: Boolean,
})
const emit = defineEmits(['reply'])
const router = useRouter()
const postLink = computed(() => props.source !== 'post' && props.review.postId ? '/community/' + props.review.postId : null)
function openPost(event) {
  if (!postLink.value || event.target.closest('a, button, textarea, input')) return
  router.push(postLink.value)
}
function keyOpen(event) {
  if (event.target !== event.currentTarget) return
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPost(event) }
}
const replying = ref(false)
const message = ref('')
watch(
  () => props.replies.length,
  (length, previous) => {
    if (length > previous) {
      message.value = ''
      replying.value = false
    }
  },
)
function submitReply() {
  if (props.source !== 'post' || !props.canReply || props.busy || props.review.type !== 'POST' || !message.value.trim()) return
  emit('reply', message.value.trim())
}
function dateLabel(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return ''
  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(value))
}
</script>

<template>
  <article class="review-card" :class="{ 'review-card-post': source === 'post', 'review-card-linked': postLink }" :role="postLink ? 'link' : undefined" :tabindex="postLink ? 0 : undefined" :aria-label="postLink ? 'View post for this review' : undefined" @click="openPost" @keydown="keyOpen">
    <header>
      <!-- Match the profile/navbar avatar, including its missing-image fallback. -->
      <RouterLink
        v-if="review.creatorId"
        :to="`/profile/${review.creatorId}`"
        :aria-label="`View ${review.creatorName}'s profile`"
      >
        <UserAvatar
          :user="{ userName: review.creatorName, photoUrl: review.creatorPhotoUrl || review.creatorPhoto }"
          :size="42"
        />
      </RouterLink>
      <UserAvatar
        v-else
        :user="{ userName: review.creatorName, photoUrl: review.creatorPhotoUrl || review.creatorPhoto }"
        :size="42"
      />
      <div class="identity">
        <h3>{{ review.creatorName }}</h3>
        <time :datetime="review.createdAt">{{ dateLabel(review.createdAt) }}</time>
      </div>
      <span v-if="source !== 'post'" class="kind">{{
        review.type === 'VISIT' ? 'Care visit' : review.type === 'POST' ? 'Post comment' : 'Reply'
      }}</span>
    </header>
    <p v-if="source !== 'post'" class="target">{{ review.targetTitle }}</p>
    <p v-if="review.type === 'VISIT'" class="target">
      Review of {{ review.receiverName
      }}<template v-if="review.receiverRole"> ({{ review.receiverRole }})</template>
    </p>
    <StarRating v-if="review.type === 'VISIT'" :model-value="review.rating" readonly />
    <p class="comment">{{ review.comment }}</p>
    <button
      v-if="source === 'post' && canReply && review.type === 'POST'"
      type="button"
      class="reply-button"
      :aria-expanded="replying"
      @click="replying = !replying"
    >
      {{ replying ? 'Cancel reply' : 'Reply' }}
    </button>
    <div v-if="review.type === 'POST' && replies.length" class="replies">
      <div v-for="reply in replies" :key="reply.reviewId" class="reply">
        <div class="d-flex align-items-center gap-2">
          <RouterLink
            v-if="reply.creatorId"
            :to="`/profile/${reply.creatorId}`"
            :aria-label="`View ${reply.creatorName}'s profile`"
          >
            <UserAvatar
              :user="{ userName: reply.creatorName, photoUrl: reply.creatorPhotoUrl || reply.creatorPhoto }"
              :size="28"
            />
          </RouterLink>
          <UserAvatar
            v-else
            :user="{ userName: reply.creatorName, photoUrl: reply.creatorPhotoUrl || reply.creatorPhoto }"
            :size="28"
          />
          <strong>{{ reply.creatorName }}</strong>
        </div>
        <p>{{ reply.comment }}</p>
      </div>
    </div>
    <form
      v-if="source === 'post' && canReply && review.type === 'POST' && replying"
      class="reply-form"
      @submit.prevent="submitReply"
    >
      <label :for="`reply-${review.reviewId}`">Your reply</label>
      <textarea
        :id="`reply-${review.reviewId}`"
        v-model="message"
        required
        maxlength="1000"
        rows="2"
      />
      <button type="submit" class="btn btn-primary btn-sm" :disabled="busy || !message.trim()">
        {{ busy ? 'Sharing…' : 'Share reply' }}
      </button>
    </form>
  </article>
</template>
