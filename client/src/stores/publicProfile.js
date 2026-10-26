import { ref } from 'vue'
import { defineStore } from 'pinia'
import { request } from '@/api/http'

export const usePublicProfileStore = defineStore('public-profile', () => {
  const profile = ref(null)
  const loading = ref(false)
  const error = ref('')
  let version = 0
  async function fetchProfile(id) {
    const current = ++version
    profile.value = null
    error.value = ''
    loading.value = true
    try {
      const data = await request(`/user/${encodeURIComponent(id)}/profile`)
      if (current === version) profile.value = data
    } catch (err) {
      if (current === version) error.value = err.message
    } finally {
      if (current === version) loading.value = false
    }
  }
  return { profile, loading, error, fetchProfile }
})
