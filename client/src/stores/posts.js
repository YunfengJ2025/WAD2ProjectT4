import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
export const usePostsStore = defineStore('my-posts', () => {
  const auth = useAuthStore()
  const posts = ref([])
  const loading = ref(false)
  const error = ref('')
  watch(() => auth.user?.userId, () => { posts.value = []; error.value = '' })
  async function fetchPosts() {
    const userId = auth.user?.userId
    loading.value = true
    error.value = ''
    try {
      const result = await auth.authorizedRequest('/post/me')
      if (auth.user?.userId === userId) posts.value = result
    } catch (err) { error.value = err.message }
    finally { loading.value = false }
  }
  async function removePost(postId) {
    await auth.authorizedRequest(`/post/${postId}`, { method: 'DELETE' })
    posts.value = posts.value.filter(post => post.postId !== postId)
  }
  return { posts, loading, error, fetchPosts, removePost }
})
