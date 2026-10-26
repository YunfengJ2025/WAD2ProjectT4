<script setup>
import { ref, watch } from 'vue'
import StarRating from './StarRating.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import '@/assets/reviews.css'
const props = defineProps({
  review: { type: Object, required: true },
  replies: { type: Array, default: () => [] },
  busy: Boolean,
})
const emit = defineEmits(['reply'])
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
  if (props.busy || props.review.type !== 'POST' || !message.value.trim()) return
  emit('reply', message.value.trim())
}
function dateLabel(value) {
  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(value))
}
</script>

<template>
  <article class="review-card">
    <header>
      <!-- Match the profile/navbar avatar, including its missing-image fallback. -->
      <UserAvatar
        :user="{ userName: review.creatorName, photoUrl: review.creatorPhotoUrl }"
        :size="42"
      />
      <div class="identity">
        <h3>{{ review.creatorName }}</h3>
        <time :datetime="review.createdAt">{{ dateLabel(review.createdAt) }}</time>
      </div>
      <span class="kind">{{
        review.type === 'VISIT' ? 'Care visit' : review.type === 'POST' ? 'Post comment' : 'Reply'
      }}</span>
    </header>
    <p class="target">{{ review.targetTitle }}</p>
    <p v-if="review.type === 'VISIT'" class="target">
      Review of {{ review.receiverName
      }}<template v-if="review.receiverRole"> ({{ review.receiverRole }})</template>
    </p>
    <StarRating v-if="review.type === 'VISIT'" :model-value="review.rating" readonly />
    <p class="comment">{{ review.comment }}</p>
    <button
      v-if="review.type === 'POST'"
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
          <UserAvatar
            :user="{ userName: reply.creatorName, photoUrl: reply.creatorPhotoUrl }"
            :size="28"
          />
          <strong>{{ reply.creatorName }}</strong>
        </div>
        <p>{{ reply.comment }}</p>
      </div>
    </div>
    <form
      v-if="review.type === 'POST' && replying"
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
