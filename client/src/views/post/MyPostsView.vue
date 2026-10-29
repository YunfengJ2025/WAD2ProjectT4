<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { usePostsStore } from '@/stores/posts'
import { useAuthStore } from '@/stores/auth'
import PostCard from '@/components/post/PostCard.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import '@/assets/community.css'
const store = usePostsStore()
const auth = useAuthStore()
const selected = ref(null)
const deleting = ref(false)
const error = ref('')
onMounted(() => store.fetchPosts())
async function remove() {
  if (deleting.value || !selected.value) return
  deleting.value = true
  error.value = ''
  try { await store.removePost(selected.value.postId); selected.value = null }
  catch (err) { error.value = err.message }
  finally { deleting.value = false }
}
</script>
<template>
  <main class="community-page">
    <RouterLink to="/profile#profile-posts" class="community-back">← Back to profile</RouterLink>
    <header class="community-heading"><div><p class="community-eyebrow">YOUR COMMUNITY UPDATES</p><h1>My posts<span>.</span></h1><p class="community-muted">Edit your updates or remove posts you no longer want to share.</p></div><RouterLink to="/community/new" class="community-plus" aria-label="Create a post">+</RouterLink></header>
    <p v-if="store.loading" role="status">Loading your posts…</p>
    <div v-else-if="store.error" role="alert"><p>{{ store.error }}</p><button class="btn" @click="store.fetchPosts">Try again</button></div>
    <p v-else-if="!store.posts.length" class="community-panel community-state">You haven’t shared any posts yet.</p>
    <div v-else class="community-posts"><div v-for="post in store.posts" :key="post.postId" class="managed-post"><PostCard :post="post" :author="auth.user" /><div class="post-actions"><RouterLink :to="`/community/${post.postId}/edit`" class="btn">Edit post</RouterLink><button class="btn btn-danger" :disabled="deleting" @click="selected = post; error = ''">Remove</button></div></div></div>
    <ConfirmDialog v-if="selected" :open="true" title="Remove this post?" :message="`Remove “${selected.title}” and its reviews and likes? This cannot be undone.${error ? ' ' + error : ''}`" confirm-label="Remove post" :busy="deleting" busy-label="Removing…" @confirm="remove" @cancel="selected = null" />
    <p v-if="error" class="community-error" role="alert">{{ error }}</p>
  </main>
</template>
<style scoped>
.managed-post { display: flex; flex-direction: column; min-width: 0; gap: .75rem; }
.post-actions { display: flex; gap: .5rem; justify-content: flex-end; }
</style>
