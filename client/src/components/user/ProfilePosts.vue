<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { usePostsStore } from '@/stores/posts'
import { useAuthStore } from '@/stores/auth'
import PostCard from '@/components/post/PostCard.vue'
import '@/assets/community.css'
const store = usePostsStore()
const auth = useAuthStore()
const recent = computed(() => store.posts.slice(0, 6))
onMounted(() => store.fetchPosts())
</script>
<template>
  <section id="profile-posts" class="profile-posts" aria-labelledby="profile-posts-heading">
    <div class="posts-heading"><div><h2 id="profile-posts-heading">My posts</h2><p class="community-muted">Your updates from the community.</p></div><RouterLink to="/community/new" class="btn">＋ Create post</RouterLink></div>
    <p v-if="store.loading" role="status">Loading your posts…</p>
    <div v-else-if="store.error" role="alert"><p>{{ store.error }}</p><button class="btn" @click="store.fetchPosts">Try again</button></div>
    <p v-else-if="!recent.length" class="community-muted">No posts yet. Share your first update with the community.</p>
    <template v-else><p class="community-muted">Swipe to explore · Showing {{ recent.length }} of {{ store.posts.length }}</p><div class="profile-post-track" tabindex="0" aria-label="Recent posts"><PostCard v-for="post in recent" :key="post.postId" :post="post" :author="auth.user" /></div></template>
    <RouterLink to="/my-posts" class="btn">View all posts ↗</RouterLink>
  </section>
</template>
<style scoped>
.profile-posts { border-top: 1px solid var(--color-border); padding-top: 1.8rem; margin-top: 1.5rem; min-width: 0; scroll-margin-top: 1.5rem; }
.posts-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
h2 { font-size: 1.15rem; color: var(--color-heading); font-weight: 600; }
p { font-size: .85rem; }
.profile-post-track { display: flex; gap: 1rem; overflow-x: auto; padding: .5rem 0 1rem; margin-bottom: 1rem; scroll-snap-type: x proximity; }
.profile-post-track > * { flex: 0 0 min(300px, 85%); scroll-snap-align: start; }
</style>
