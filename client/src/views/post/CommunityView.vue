<script setup>
import ScrollToTop from '@/components/ScrollToTop.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { request } from '@/api/http'
import { useLikesStore } from '@/stores/likes'
import { useAuthStore } from '@/stores/auth'
import PostCard from '@/components/post/PostCard.vue'
import CommunityPodium from '@/components/dashboard/CommunityPodium.vue'
import '@/assets/community.css'

const auth = useAuthStore()
const likes = useLikesStore()
const search = ref('')
const filter = ref('all')
const filters = [
  { value: 'all', label: 'All posts' },
  { value: 'mine', label: 'My posts' },
  { value: 'liked', label: 'Liked' },
]
// computed caches the filtered list and refreshes it when search, posts or likes change.
const visiblePosts = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return posts.value.filter((post) => {
    const matchesText = [post.title, post.content].some((text) =>
      String(text || '')
        .toLocaleLowerCase()
        .includes(query),
    )
    const matchesFilter =
      filter.value === 'all' ||
      (filter.value === 'mine'
        ? post.creatorId === auth.user?.userId
        : !!likes.states[post.postId]?.liked)
    return matchesText && matchesFilter
  })
})
// Load private liked state only when needed; signing out restores the public filter.
watch(filter, (value) => {
  if (value === 'liked') likes.fetchLikes()
})
watch(
  () => auth.isAuthenticated,
  (signedIn) => {
    if (!signedIn) filter.value = 'all'
  },
)
function clearFilters() {
  search.value = ''
  filter.value = 'all'
}
const posts = ref([])
const leaders = ref([])
const loading = ref(true)
const error = ref('')

// Use the current profile for the signed-in author and server-provided details for other users.

function author(post) {
  if (auth.user?.userId === post.creatorId) return auth.user
  return { userName: post.creatorName || `User #${post.creatorId}`, photoUrl: post.creatorPhoto }
}

// Fetch top leaders for the community podium
async function loadLeaders() {
  try {
    const res = await axios.get('http://localhost:8000/api/leaderboard')
    if (res.data && res.data.leaderboard) {
      leaders.value = res.data.leaderboard.slice(0, 3)
    }
  } catch (err) {
    console.error('Failed to load leaderboard for community podium:', err)
  }
}

// Fetch the public feed and sort by the generated ID so the newest posts appear first.

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

onMounted(() => {
  loadPosts()
  loadLeaders()
})
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

    <!-- Top 3 Caregivers Podium in Community -->
    <CommunityPodium :leaders="leaders" />

    <section class="community-feed" aria-labelledby="feed-title" :aria-busy="loading">
      <div class="community-feed-heading">
        <h2 id="feed-title">From the community</h2>
        <span class="community-muted">Newest first</span>
      </div>
      <div class="community-tools">
        <div class="community-search">
          <label for="community-search">Search posts</label
          ><input
            id="community-search"
            v-model="search"
            type="search"
            placeholder="Search titles or post content…"
          />
        </div>
        <div class="community-filters" role="group" aria-label="Filter posts">
          <button
            v-for="option in filters"
            :key="option.value"
            type="button"
            :aria-pressed="filter === option.value"
            :disabled="option.value !== 'all' && !auth.isAuthenticated"
            :title="
              option.value !== 'all' && !auth.isAuthenticated
                ? 'Sign in to use this filter'
                : undefined
            "
            @click="filter = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <p v-if="!auth.isAuthenticated" class="community-muted">
        Sign in to filter your own or liked posts.
      </p>
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
      <p v-else-if="filter === 'liked' && likes.loading" class="community-state" role="status">
        Loading your liked posts…
      </p>
      <div v-else-if="filter === 'liked' && likes.error" class="community-state" role="alert">
        <p>{{ likes.error }}</p>
        <button type="button" class="btn" @click="likes.fetchLikes(true)">Try again</button>
      </div>
      <template v-else>
        <div class="community-results">
          <p role="status" class="community-muted">
            {{ visiblePosts.length }} {{ visiblePosts.length === 1 ? 'post' : 'posts' }}
          </p>
          <button
            v-if="search || filter !== 'all'"
            type="button"
            class="community-clear"
            @click="clearFilters"
          >
            Clear filters
          </button>
        </div>
        <!-- Stable post IDs let TransitionGroup animate cards when their grid positions change. -->
        <!-- appear runs the initial entrance; filter changes keep their existing short transition. -->
        <TransitionGroup
          name="community-filter"
          tag="div"
          class="community-posts"
          appear
          appear-active-class="community-card-arrive"
          appear-from-class="community-card-arrive-from"
          appear-to-class="community-card-arrive-to"
        >
          <PostCard
            v-for="(post, index) in visiblePosts"
            :key="post.postId"
            :post="post"
            :author="author(post)"
            :style="{ '--card-entrance-delay': `${Math.min(index, 5) * 55}ms` }"
          />
        </TransitionGroup>
        <div v-if="!visiblePosts.length" class="community-panel community-state">
          <h2>No matching posts</h2>
          <p class="community-muted">Try another search or filter.</p>
          <button type="button" class="btn" @click="clearFilters">Show all posts</button>
        </div>
      </template>
    </section>
    <ScrollToTop />
  </main>
</template>
