<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
const props = defineProps({ post: { type: Object, required: true } })
const auth = useAuthStore()
const likes = useLikesStore()
const route = useRoute()
const router = useRouter()
const error = ref('')
const celebrating = ref(false)
const liked = computed(() => likes.states[props.post.postId]?.liked || false)
const count = computed(
  () => likes.states[props.post.postId]?.likedCount ?? props.post.likedCount ?? 0,
)
watch(
  () => auth.isAuthenticated,
  (signedIn) => {
    if (signedIn) likes.fetchLikes()
  },
  { immediate: true },
)
// Guests go through sign-in; authenticated toggles are guarded against duplicate clicks.
async function toggle() {
  error.value = ''
  if (!auth.isAuthenticated) {
    return router.push({ name: 'sign-in', query: { redirect: route.fullPath } })
  }
  if (!likes.loaded) {
    await likes.fetchLikes()
    if (!likes.loaded) {
      error.value = likes.error
      return
    }
  }
  try {
    const wasLiked = liked.value
    await likes.toggle(props.post)
    // Animate only a confirmed new like, not initial loading or a failed request.
    if (!wasLiked && liked.value) {
      celebrating.value = false
      await nextTick()
      celebrating.value = true
    }
  } catch (err) {
    error.value = err.message
  }
}
</script>
<template>
  <span class="post-like-control">
    <button
      type="button"
      class="post-like-button"
      :class="{ liked, celebrating }"
      :aria-pressed="liked"
      :aria-label="`${liked ? 'Unlike' : 'Like'} post: ${post.title || 'Community update'}`"
      :disabled="likes.loading || !!likes.pending[post.postId]"
      @click.stop="toggle"
    >
      <svg @animationend="celebrating = false" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
        />
      </svg>
      <!-- A keyed value triggers Vue's enter/leave classes when the server count changes. -->
      <span class="post-like-count" aria-live="polite"
        ><Transition name="like-count" mode="out-in"
          ><span :key="count" class="post-like-number">{{ count }}</span></Transition
        ></span
      >
    </button>
    <span v-if="error" role="alert" class="post-like-error">{{ error }}</span>
  </span>
</template>
<style scoped>
/* Outlined hearts become solid after the server confirms the user's like. */
.post-like-control {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 100%;
}
.post-like-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 44px;
  min-height: 44px;
  padding: 0.4rem;
  border: 0;
  background: transparent;
  color: var(--muted);
  border-radius: 10px;
  font: inherit;
  cursor: pointer;
}
.post-like-button svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}
.post-like-button.liked {
  color: #bb3450;
}
.post-like-button.liked svg {
  fill: currentColor;
}
/* Pointer and keyboard feedback use the same generous touch target. */
.post-like-button:hover {
  background: #fbeef1;
  color: #bb3450;
}
.post-like-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.post-like-button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.post-like-error {
  font-size: 0.75rem;
  color: var(--danger);
  max-width: 220px;
}
/* A brief scale pulse celebrates successful likes without moving the button. */
.post-like-button.celebrating svg {
  animation: heart-pop 380ms ease;
  transform-origin: center;
}
@keyframes heart-pop {
  0%,
  100% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.3);
  }
  70% {
    transform: scale(0.94);
  }
}
/* Reserve a stable count area; only the number slides inside it. */
.post-like-count {
  display: inline-grid;
  min-width: 2ch;
  overflow: hidden;
  text-align: center;
}
.post-like-number {
  display: inline-block;
}
.like-count-enter-active,
.like-count-leave-active {
  transition:
    transform 120ms ease,
    opacity 120ms ease;
}
.like-count-enter-from {
  transform: translateY(70%);
  opacity: 0;
}
.like-count-leave-to {
  transform: translateY(-70%);
  opacity: 0;
}
/* Keep the same feedback states without motion when requested by the user. */
@media (prefers-reduced-motion: reduce) {
  .post-like-button.celebrating svg {
    animation: none;
  }
  .like-count-enter-active,
  .like-count-leave-active {
    transition: none;
  }
  .like-count-enter-from,
  .like-count-leave-to {
    transform: none;
  }
}
</style>
