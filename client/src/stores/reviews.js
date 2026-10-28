import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

export const useReviewsStore = defineStore('reviews', () => {
  const auth = useAuthStore()
  const reviews = ref([])
  const loading = ref(false)
  const error = ref('')
  let version = 0
  watch(() => auth.accessToken, () => {
    version++
    reviews.value = []
    loading.value = false
    error.value = ''
  }, { flush: 'sync' })

  async function fetchReviews() {
    const current = ++version
    loading.value = true
    error.value = ''
    try {
      const data = await auth.authorizedRequest('/review/me')
      if (current === version) reviews.value = data.reviews
    } catch (err) {
      if (current === version) error.value = err.message
    } finally {
      if (current === version) loading.value = false
    }
  }

  async function reply(parent, comment) {
    if (parent.type !== 'POST') throw new Error('Only post comments accept replies.')
    const token = auth.accessToken
    const data = await auth.authorizedRequest('/review/me/replies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentReviewId: parent.reviewId, comment }),
    })
    if (auth.accessToken !== token) throw new Error('Your session changed. Please sign in again.')
    reviews.value.push({ ...data, creatorName: auth.user.userName, receiverName: parent.creatorName })
  }
  return { reviews, loading, error, fetchReviews, reply }
})
