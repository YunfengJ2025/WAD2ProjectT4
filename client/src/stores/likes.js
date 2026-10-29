import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'

// Shared state keeps hearts consistent between the feed, profile, details and liked page.
export const useLikesStore = defineStore('likes', () => {
  const auth = useAuthStore()
  const posts = ref([])
  const states = ref({})
  const pending = ref({})
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  let request = null
  let version = 0
  watch(
    () => auth.accessToken,
    () => {
      version++
      posts.value = []
      states.value = {}
      pending.value = {}
      loading.value = false
      loaded.value = false
      request = null
      error.value = ''
    },
    { flush: 'sync' },
  )

  // Deduplicate initial loading so a feed with many cards makes only one request.
  async function fetchLikes(force = false) {
    if (!auth.isAuthenticated || (loaded.value && !force)) return
    if (request) return request
    const current = version
    loading.value = true
    error.value = ''
    request = (async () => {
      try {
        const result = await auth.authorizedRequest('/post/liked/me')
        if (current !== version) return
        posts.value = result
        // Preserve explicit unliked states/counts until a fresh post payload is fetched.
        const next = { ...states.value }
        Object.keys(next).forEach((id) => {
          next[id] = { ...next[id], liked: false }
        })
        result.forEach((post) => {
          next[post.postId] = { liked: true, likedCount: post.likedCount }
        })
        states.value = next
        loaded.value = true
      } catch (err) {
        if (current === version) error.value = err.message
      } finally {
        if (current === version) {
          loading.value = false
          request = null
        }
      }
    })()
    return request
  }

  // Serialize each post's toggle and trust the server's count; failures leave the heart unchanged.
  async function toggle(post) {
    const id = post.postId
    if (pending.value[id] || loading.value) return
    const current = version
    pending.value[id] = true
    const liked = states.value[id]?.liked || false
    try {
      const result = await auth.authorizedRequest(`/post/${id}/like`, {
        method: liked ? 'DELETE' : 'POST',
      })
      if (current !== version) return
      states.value[id] = result
      posts.value = posts.value.filter((item) => item.postId !== id)
      if (result.liked)
        posts.value.unshift({ ...post, ...result, likedAt: new Date().toISOString() })
    } finally {
      if (current === version) pending.value[id] = false
    }
  }
  return { posts, states, pending, loading, loaded, error, fetchLikes, toggle }
})
