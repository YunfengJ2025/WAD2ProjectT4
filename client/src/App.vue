
<script setup>
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { RouterView, useRoute, useRouter } from 'vue-router'

import NavBar from './components/nav/NavBar.vue'
import ToastHost from './components/ToastHost.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useToast } from './composables/useToast'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { show: toast } = useToast()

const loggingOut = ref(false)
const showLogoutConfirm = ref(false)

const navigationitems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'My Plants', to: '/plants' },
  { label: 'Find Nearby', to: '/find-nearby' },
  { label: 'Care Visits', to: '/care-visits' },
  { label: 'Schedule', to: '/schedule' }
  { label: 'Reviews', to: '/reviews' }
]

async function logout() {
  if (loggingOut.value) return

  loggingOut.value = true

  try {
    await auth.logout()
  } catch {
    toast('Signed out on this device. Could not reach the server.', 'info')
  } finally {
    showLogoutConfirm.value = false
    loggingOut.value = false
    await router.replace('/signin')
  }
}

watch(() => auth.accessToken, (token) => {
  if (!token && route.meta.requiresAuth) {
    router.replace({ name: 'sign-in', query: { redirect: route.fullPath } })
  }
})
</script>

<template>
  <!-- Background gradient container defined in main.css -->
  <div class="page-bg"></div>

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />

  <NavBar
    class="mb-4 full-width"
    v-if="!['sign-in', 'register'].includes(route.name)"
    :navigationitems="navigationitems"
    @logout="showLogoutConfirm = true"
  />

  <RouterView :key="route.path" />

  <ToastHost />

  <ConfirmDialog
    v-if="showLogoutConfirm"
    :open="showLogoutConfirm"
    title="Log out?"
    message="Are you sure you want to log out?"
    confirm-label="Log out"
    :busy="loggingOut"
    busy-label="Logging out..."
    @confirm="logout"
    @cancel="showLogoutConfirm = false"
  />
</template>

<style scoped>
/* The page is max 1280px wide and centred. This makes only the navbar
   span the whole screen: 100vw wide, then shifted left to the screen edge.
   (body has overflow-x: hidden in main.css, so no sideways scrollbar.) */
.full-width {
  width: 100vw;
  margin-left: calc(50% - 50vw);
}

.topbar {
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
}

.logout {
  margin-left: auto;
  min-width: 130px;
}

nav a {
  padding: 0.25rem 0;
  color: var(--color-text);
}

nav a.active {
  color: var(--accent);
  font-weight: 600;
}

nav a:hover {
  background-color: transparent;
  color: var(--accent);
}
</style>
