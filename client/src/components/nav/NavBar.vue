<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Collapse } from 'bootstrap'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/user/UserAvatar.vue'

defineProps({ navigationitems: { type: Array, default: () => [] } })
defineEmits(['logout'])
const auth = useAuthStore()
const route = useRoute()
const notifications = ref([])
const notificationError = ref('')
const unreadCount = ref(0)

// Load the current user's notices when signed in and when opening the bell.
async function loadNotifications() {
  if (!auth.accessToken) {
    notifications.value = []
    unreadCount.value = 0
    return
  }
  try {
    const result = await auth.authorizedRequest('/notifications')
    notifications.value = result.notifications
    unreadCount.value = notifications.value.filter((item) => !item.readAt).length
    notificationError.value = ''
  } catch (err) {
    notificationError.value = err.message
  }
}

// Persist read state so unread notices stay cleared after a refresh.
async function markNotificationRead(notification) {
  if (notification.readAt) return
  try {
    const result = await auth.authorizedRequest(`/notifications/${notification._id}/read`, { method: 'PATCH' })
    notification.readAt = result.notification.readAt
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (err) {
    notificationError.value = err.message
  }
}

// Pages in the avatar dropdown
const accountItems = [
  { label: 'Profile', to: '/profile' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'Recently liked', to: '/recently-liked' },
  { label: 'Reviews', to: '/reviews' },
]

// On phones, close the menu after going to another page
const menu = ref(null)
watch(() => route.fullPath, () => {
  if (menu.value) Collapse.getInstance(menu.value)?.hide()
})
watch(() => auth.accessToken, loadNotifications, { immediate: true })
</script>

<template>
  <nav class="navbar navbar-expand-sm bg-body-tertiary" aria-label="Main navigation">
    <div class="container-fluid flex-wrap gap-2">
      <RouterLink class="navbar-brand order-0" to="/"><img src="../../assets/Leaf It to Us Logo.png" height="40px"></RouterLink>
      <!-- Main links: below the bar on phones (order-3), beside the logo from sm up -->
      <div v-if="auth.isAuthenticated" id="mainNav" ref="menu" class="collapse navbar-collapse order-3 order-sm-1">
        <ul class="navbar-nav flex-wrap me-auto">
          <li v-for="item in navigationitems" :key="item.to" class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="item.to">{{ item.label }}</RouterLink>
          </li>
        </ul>
      </div>

      <div class="d-flex align-items-center gap-2 ms-auto order-1 order-sm-2">
        <!-- Display policy notices and let the user clear each unread badge. -->
        <div v-if="auth.isAuthenticated" class="dropdown">
          <button
            type="button"
            class="btn notification-toggle position-relative"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            aria-label="Notifications"
            @click="loadNotifications"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
            <span class="unread-count" v-if="unreadCount">{{ unreadCount }}</span>
          </button>
          <div class="dropdown-menu dropdown-menu-end notification-menu p-2">
            <div class="d-flex justify-content-between align-items-center px-2 py-1">
              <strong>Notifications</strong>
              <span class="small text-secondary">{{ unreadCount }} unread</span>
            </div>
            <p v-if="notificationError" class="small text-danger px-2 mb-1" role="alert">{{ notificationError }}</p>
            <p v-else-if="!notifications.length" class="small text-secondary px-2 mb-1">You’re all caught up.</p>
            <button
              v-for="item in notifications"
              :key="item._id"
              type="button"
              class="notification-item"
              :class="{ unread: !item.readAt }"
              @click="markNotificationRead(item)"
            >
              <span>{{ item.message }}</span>
              <small>{{ new Date(item.createdAt).toLocaleString('en-GB') }}</small>
            </button>
          </div>
        </div>
        <div v-if="auth.isAuthenticated" class="dropdown">
          <button
            type="button"
            class="btn nav-link d-flex align-items-center gap-2 dropdown-toggle"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <UserAvatar :user="auth.user" :size="34" />
            <span class="d-none d-md-inline">{{ auth.user.userName }}</span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li v-for="item in accountItems" :key="item.to">
              <RouterLink class="dropdown-item" active-class="active" :to="item.to">{{ item.label }}</RouterLink>
            </li>
            <li><hr class="dropdown-divider" /></li>
            <li>
              <button type="button" class="dropdown-item" @click="$emit('logout')">Log out</button>
            </li>
          </ul>
        </div>
        <template v-else>
          <RouterLink class="btn btn-outline-secondary" to="/signin">Sign in</RouterLink>
          <RouterLink class="btn btn-primary" to="/register">Create account</RouterLink>
        </template>
      </div>

      <button
        v-if="auth.isAuthenticated"
        class="navbar-toggler order-2"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#mainNav"
        aria-controls="mainNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.coming-soon {
  margin-left: 0.35rem;
  font-size: 0.75rem;
}
/* Keep the notification list readable in the compact navbar dropdown. */
.notification-toggle { font-size: 1.35rem; line-height: 1; }
.unread-count { position: absolute; top: 0; right: 0; min-width: 1.05rem; padding: 0.05rem 0.2rem; border-radius: 999px; background: #b42318; color: #fff; font-size: 0.65rem; font-weight: 700; }
.notification-menu { width: min(360px, calc(100vw - 1rem)); max-height: 65vh; overflow-y: auto; }
.notification-item { display: grid; width: 100%; gap: 0.25rem; padding: 0.65rem; border: 0; border-radius: 8px; background: transparent; color: inherit; text-align: left; white-space: normal; }
.notification-item:hover { background: #f2f6f2; }
.notification-item.unread { background: #edf6ee; }
.notification-item small { color: #68766b; }
</style>
