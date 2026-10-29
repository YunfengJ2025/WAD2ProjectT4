<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { request } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import PostCard from '@/components/post/PostCard.vue'
import '@/assets/community.css'

const auth = useAuthStore()
const posts = ref([])
const loading = ref(true)
const error = ref('')

function author(post) {
  if (auth.user?.userId === post.creatorId) return auth.user
  return { userName: post.creatorName || `User #${post.creatorId}`, photoUrl: post.creatorPhoto }
}

async function loadPosts() {
  loading.value = true
  error.value = ''
  try {
    const data = await request('/post')
    posts.value = [...data].sort((a, b) => b.postId - a.postId)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
onMounted(loadPosts)
</script>

<template>
  <main class="community-page">
    <header class="community-heading">
      <div>
        <p class="community-eyebrow">GROW TOGETHER</p>
        <h1>Community<span>.</span></h1>
        <p class="community-muted">Little wins, leafy updates, and advice from your neighbours.</p>
      </div>
      <RouterLink
        to="/community/new"
        class="community-plus"
        aria-label="Create a post"
        title="Create a post"
        >+</RouterLink
      >
    </header>

    <section class="community-feed" aria-labelledby="feed-title" :aria-busy="loading">
      <div class="community-feed-heading">
        <h2 id="feed-title">From the community</h2>
        <span class="community-muted">Newest first</span>
      </div>
      <p v-if="loading" class="community-state" role="status">Loading community posts…</p>
      <div v-else-if="error" class="community-panel community-state" role="alert">
        <h2>Couldn’t load posts</h2>
        <p>{{ error }}</p>
        <button class="btn" type="button" @click="loadPosts">Try again</button>
      </div>
      <div v-else-if="!posts.length" class="community-panel community-state">
        <span class="community-sprout" aria-hidden="true">❧</span>
        <h2>Every community starts with a hello</h2>
        <p class="community-muted">
          Share your first plant update and get the conversation growing.
        </p>
        <RouterLink to="/community/new" class="btn btn-primary">Create the first post</RouterLink>
      </div>
      <div v-else class="community-posts">
        <PostCard v-for="post in posts" :key="post.postId" :post="post" :author="author(post)" />
      </div>
    </section>
  </main>
</template>
