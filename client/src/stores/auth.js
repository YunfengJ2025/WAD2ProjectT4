import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { request } from '@/api/http'

const TOKEN_KEY = 'leaf-access-token'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(sessionStorage.getItem(TOKEN_KEY) || '')
  const user = ref(null)
  const submitting = ref(false)
  const error = ref('')
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
  let restoring

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY)
    accessToken.value = ''
    user.value = null
  }

  async function authorizedRequest(url, options = {}) {
    const token = accessToken.value
    if (!token) throw Object.assign(new Error('Please sign in first'), { status: 401, errors: {} })
    try {
      return await request(url, { ...options, token })
    } catch (err) {
      if (err.status === 401 && accessToken.value === token) clearSession()
      throw err
    }
  }

  async function authenticate(endpoint, credentials) {
    if (submitting.value) return
    submitting.value = true
    error.value = ''
    try {
      const data = await request(`/user/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      sessionStorage.setItem(TOKEN_KEY, data.accessToken)
      accessToken.value = data.accessToken
      user.value = data.user
      return data.user
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      submitting.value = false
    }
  }

  async function restoreSession() {
    if (!accessToken.value || user.value) return
    if (!restoring) {
      const token = accessToken.value
      restoring = authorizedRequest('/user/me')
        .then((data) => { if (accessToken.value === token) user.value = data.user })
        .finally(() => { restoring = null })
    }
    return restoring
  }

  async function refreshUser() {
    // Reload balances and reservations after payments, request creation or cancellation.
    // Ignore a late response if the user signed out or changed sessions while it loaded.
    const token = accessToken.value
    const data = await authorizedRequest('/user/me')
    if (accessToken.value === token) user.value = data.user
  }

  async function updateProfile(details) {
    const token = accessToken.value
    const multipart = details instanceof FormData
    const data = await authorizedRequest('/user/me', {
      method: 'PATCH',
      ...(multipart ? {} : { headers: { 'Content-Type': 'application/json' } }),
      body: multipart ? details : JSON.stringify(details),
    })
    if (accessToken.value !== token) throw new Error('Your session changed. Please sign in again.')
    user.value = data.user
    return data.user
  }

  async function logout() {
    try {
      if (accessToken.value) await authorizedRequest('/user/logout', { method: 'POST' })
    } finally {
      // Stateless JWT logout must also clear local state when offline.
      clearSession()
    }
  }

  return {
    accessToken, user, submitting, error, isAuthenticated, clearSession,
    authorizedRequest, restoreSession, refreshUser, updateProfile, logout,
    login: (credentials) => authenticate('login', credentials),
    register: (credentials) => authenticate('register', credentials),
  }
})
