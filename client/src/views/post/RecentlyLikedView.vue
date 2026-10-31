<script setup>
import { onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useLikesStore } from '@/stores/likes'
import PostCard from '@/components/post/PostCard.vue'
import '@/assets/community.css'
const likes = useLikesStore()
const router = useRouter()
onMounted(() => likes.fetchLikes(true))
function goBack() {
  if (router.options.history.state.back) router.back()
  else router.replace('/community')
}
</script>
<template>
  <main class="community-page">
    <button type="button" class="community-back community-back-button" @click="goBack">
      ← Back
    </button>
    <header class="community-heading">
      <div>
        <p class="community-eyebrow">A LITTLE COMMUNITY LOVE</p>
        <h1>Recently liked<span>.</span></h1>
        <p class="community-muted">Your liked posts, with the most recent likes first.</p>
      </div>
    </header>
    <p v-if="likes.loading" class="community-state" role="status">Loading liked posts…</p>
    <div v-else-if="likes.error" class="community-panel community-state" role="alert">
      <p>{{ likes.error }}</p>
      <button class="btn" @click="likes.fetchLikes(true)">Try again</button>
    </div>
    <div v-else-if="!likes.posts.length" class="community-panel community-state">
      <h2>No liked posts yet</h2>
      <p class="community-muted">Tap a heart on any post to save it here.</p>
      <RouterLink to="/community" class="btn btn-primary">Explore the community</RouterLink>
    </div>
    <div v-else class="community-posts">
      <PostCard
        v-for="post in likes.posts"
        :key="post.postId"
        :post="post"
        :author="{ userName: post.creatorName, photoUrl: post.creatorPhoto }"
      />
    </div>
  </main>
</template>
