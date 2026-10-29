<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { usePostsStore } from '@/stores/posts'
import { useAuthStore } from '@/stores/auth'
import PostCard from '@/components/post/PostCard.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import '@/assets/community.css'
const store = usePostsStore()
const router = useRouter()
// Use app navigation history; direct visits fall back to the relevant listing.
function goBack() {
  if (router.options.history.state.back) router.back()
  else router.replace('/profile#profile-posts')
}
const auth = useAuthStore()
const selected = ref(null)
const deleting = ref(false)
const error = ref('')
onMounted(() => store.fetchPosts())
// Delete only after confirmation; keep errors visible so the user can retry.
async function remove() {
  if (deleting.value || !selected.value) return
  deleting.value = true
  error.value = ''
  try {
    await store.removePost(selected.value.postId)
    selected.value = null
  } catch (err) {
    error.value = err.message
  } finally {
    deleting.value = false
  }
}
</script>
<template>
  <main class="community-page my-posts-page">
    <button type="button" class="community-back community-back-button" @click="goBack">← Back</button>
    <header class="community-heading">
      <div>
        <p class="community-eyebrow">YOUR COMMUNITY UPDATES</p>
        <h1>My posts<span>.</span></h1>
        <p class="community-muted">
          Edit your updates or remove posts you no longer want to share.
        </p>
      </div>
      <RouterLink to="/community/new" class="community-plus" aria-label="Create a post"
        >+</RouterLink
      >
    </header>
    <p v-if="store.loading" role="status">Loading your posts…</p>
    <div v-else-if="store.error" role="alert">
      <p>{{ store.error }}</p>
      <button class="btn" @click="store.fetchPosts">Try again</button>
    </div>
    <p v-else-if="!store.posts.length" class="community-panel community-state">
      You haven't shared any posts yet.
    </p>
    <div v-else class="community-posts">
      <div v-for="post in store.posts" :key="post.postId" class="managed-post">
        <PostCard :post="post" :author="auth.user" />
        <div class="post-actions">
          <RouterLink
            :to="`/community/${post.postId}/edit`"
            class="btn post-action post-action-edit"
            ><span aria-hidden="true">✎</span> Edit post</RouterLink
          >
          <button
            class="btn post-action post-action-remove"
            :aria-label="`Remove post: ${post.title}`"
            :disabled="deleting"
            @click="((selected = post), (error = ''))"
          >
            <span aria-hidden="true">×</span> Remove
          </button>
        </div>
      </div>
    </div>
    <ConfirmDialog
      v-if="selected"
      :open="true"
      title="Remove this post?"
      :message="`Remove “${selected.title}” and its reviews and likes? This cannot be undone.${error ? ' ' + error : ''}`"
      confirm-label="Remove post"
      :busy="deleting"
      busy-label="Removing…"
      @confirm="remove"
      @cancel="selected = null"
    />
    <p v-if="error" class="community-error" role="alert">{{ error }}</p>
  </main>
</template>
<style scoped>
/* The management page uses the same grid as the community with a compact action row. */
.managed-post {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.85rem;
}
/* Let the card fill its grid cell; actions stay aligned even with long post titles. */
.managed-post > :deep(.post-card) {
  flex: 1;
}
/* A pale action tray separates post navigation from owner-only edit/delete controls. */
.post-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
  padding: 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
  justify-content: center;           /* Centers the columns inside the container */
  align-items: center;               /* Vertically aligns the buttons */
}

/* Give both actions a generous target and matching height for mouse and touch users. */
.post-action {
  min-height: 44px;
  border-radius: 10px;
  font-size: 0.85rem;
  gap: 0.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}
/* Editing uses the app's green palette as the primary management action. */
.post-action-edit {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: #bfd8c5;
}
/* Removal uses a quiet red outline so it remains distinct from editing. */
.post-action-remove {
  color: var(--danger);
  background: #fff;
  border-color: #eac9c5;
}
/* Hover reinforces each action's meaning without moving the surrounding card. */
.post-action-edit:hover {
  color: var(--accent-hover);
  background: #d4e9d9;
  border-color: var(--accent);
}
.post-action-remove:hover:not(:disabled) {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: var(--danger);
}
/* Disabled removal cannot appear interactive while a delete request is pending. */
.post-action:disabled {
  opacity: 0.55;
  cursor: wait;
}
/* Keep state changes immediate when the user prefers reduced motion. */
@media (prefers-reduced-motion: reduce) {
  .post-action {
    transition: none;
  }
}
</style>
