<script setup>
import { ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import ToastHost from './components/ToastHost.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useToast } from './composables/useToast'

const route = useRoute()
const router = useRouter()
const { show: toast } = useToast()
const loggingOut = ref(false)
const showLogoutConfirm = ref(false)

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
  <header v-if="route.path.startsWith('/plants')" class="topbar">
    <nav>
      <RouterLink to="/plants" :class="{ active: route.path.startsWith('/plants') }">
        My Plants
      </RouterLink>
      <button class="btn logout" type="button" :disabled="loggingOut" @click="showLogoutConfirm = true">
        {{ loggingOut ? 'Logging out...' : 'Log out' }}
      </button>
    </nav>
  </header>

  <RouterView:key="route.path" />
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
