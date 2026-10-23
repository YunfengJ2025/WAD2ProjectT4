<script setup>
import { ref } from 'vue'
import StarRating from './StarRating.vue'
const props = defineProps({
  review: { type: Object, required: true },
  replies: { type: Array, default: () => [] },
})
const emit = defineEmits(['reply'])
const replying = ref(false)
const message = ref('')
function submitReply() {
  if (props.review.type !== 'POST' || !message.value.trim()) return
  emit('reply', message.value.trim())
  message.value = ''
  replying.value = false
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
      <span class="avatar" aria-hidden="true">{{ review.creatorName.slice(0, 1) }}</span>
      <div class="identity">
        <h3>{{ review.creatorName }}</h3>
        <time :datetime="review.createdAt">{{ dateLabel(review.createdAt) }}</time>
      </div>
      <span class="kind">{{ review.type === 'VISIT' ? 'Care visit' : 'Post comment' }}</span>
    </header>
    <p class="target">{{ review.targetTitle }}</p>
    <p v-if="review.type === 'VISIT'" class="target">{{ review.creatorRole }} → {{ review.receiverName }} ({{ review.receiverRole }})</p>
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
        <strong>{{ reply.creatorName }}</strong>
        <p>{{ reply.comment }}</p>
      </div>
    </div>
    <form v-if="review.type === 'POST' && replying" class="reply-form" @submit.prevent="submitReply">
      <label :for="`reply-${review.reviewId}`">Your reply</label>
      <textarea
        :id="`reply-${review.reviewId}`"
        v-model="message"
        required
        maxlength="1000"
        rows="2"
      />
      <button type="submit" class="btn btn-primary btn-sm" :disabled="!message.trim()">
        Share reply
      </button>
    </form>
  </article>
</template>

<style scoped>
.review-card {
  padding: 1.5rem;
  background: #fff;
  border: 1px solid #dce7dd;
  border-radius: 20px;
  box-shadow: 0 4px 18px #244d3010;
}
header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #e5f1e3;
  color: #346346;
  font-weight: 700;
}
.identity {
  flex: 1;
}
h3 {
  margin: 0;
  font-size: 1rem;
}
time {
  font-size: 0.8rem;
  color: #69786e;
}
.kind {
  font-size: 0.75rem;
  border-radius: 30px;
  background: #f0f5ed;
  color: #426248;
  padding: 0.35rem 0.65rem;
}
.target {
  font-size: 0.85rem;
  color: #526a59;
  margin: 1rem 0 0.35rem;
}
.comment,
.reply p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.7;
  margin: 0.5rem 0;
}
.reply-button {
  border: 0;
  background: transparent;
  padding: 0.3rem 0;
  color: #2f7d4a;
  font-weight: 600;
}
.replies {
  margin-top: 0.75rem;
  border-left: 2px solid #dce7dd;
  padding-left: 1rem;
}
.reply {
  padding: 0.5rem 0;
  font-size: 0.9rem;
}
.reply-form {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
  justify-items: start;
}
textarea {
  width: 100%;
  border: 1px solid #b8c9bc;
  border-radius: 8px;
  padding: 0.6rem;
  resize: vertical;
}
</style>
