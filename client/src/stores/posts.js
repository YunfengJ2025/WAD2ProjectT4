import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
export const usePostsStore = defineStore('my-posts', () => {
  const auth = useAuthStore()
  const posts = ref([])
  const loading = ref(false)
  const error = ref('')
  // Clear the previous account's posts when the signed-in user changes.
  watch(
    () => auth.user?.userId,
    () => {
      posts.value = []
      error.value = ''
    },
  )
  // Fetch posts scoped to the current session and discard results from a changed account.
  async function fetchPosts() {
    const userId = auth.user?.userId
    loading.value = true
    error.value = ''
    try {
      const result = await auth.authorizedRequest('/post/me')
      if (auth.user?.userId === userId) posts.value = result
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }
  // Remove the card from local state only after the authenticated delete succeeds.
  async function removePost(postId) {
    await auth.authorizedRequest(`/post/${postId}`, { method: 'DELETE' })
    posts.value = posts.value.filter((post) => post.postId !== postId)
  }
  return { posts, loading, error, fetchPosts, removePost }
})
