
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
