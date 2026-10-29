<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
const props = defineProps({ post: { type: Object, required: true } })
const auth = useAuthStore()
const likes = useLikesStore()
const route = useRoute()
const router = useRouter()
const error = ref('')
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
    await likes.toggle(props.post)
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
      :class="{ liked }"
      :aria-pressed="liked"
      :aria-label="`${liked ? 'Unlike' : 'Like'} post: ${post.title || 'Community update'}`"
      :disabled="likes.loading || !!likes.pending[post.postId]"
      @click.stop="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
        />
      </svg>
      <span>{{ count }}</span>
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
</style>
