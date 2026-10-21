
<script setup>
import { ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import NavBar from './components/nav/NavBar.vue'
import ToastHost from './components/ToastHost.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useToast } from './composables/useToast'

const route = useRoute()
const router = useRouter()
const { show: toast } = useToast()

const loggingOut = ref(false)
const showLogoutConfirm = ref(false)

const navigationitems = [
    { label: 'Dashboard', to: '/' },
    { label: 'Leaderboard', to: '/leaderboard' },
    { label: 'My Plants', to: '/my-plants' },
    { label: 'Find Nearby', to: '/find-nearby' },
    { label: 'Care Visits', to: '/care-visits' },
  { label: 'Home', to: '/' },
  { label: 'My Plants', to: '/plants' },
  { label: 'Find Nearby', to: '/find-nearby' },
  { label: 'Care Visits', to: '/care-visits' }
]

async function logout() {
  if (loggingOut.value) return

  loggingOut.value = true

  try {
    const response = await fetch('/api/user/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })

    if (!response.ok) {
      toast('Could not log out. Please try again.', 'error')
      return
    }

    showLogoutConfirm.value = false
    await router.replace('/signin')
  } catch {
    toast('Could not reach the server. Please try again.', 'error')
  } finally {
    loggingOut.value = false
  }
}

</script>

<template>
  <!-- Background gradient container defined in main.css -->
  <div class="page-bg"></div>

  <!-- <NavBar :navigationitems="navigationitems" /> -->
  <br>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />

  <NavBar
    v-if="!['/signin', '/signup'].includes(route.path)"
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
