<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Collapse, Dropdown } from 'bootstrap'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/user/UserAvatar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'

defineProps({ navigationitems: { type: Array, default: () => [] } })
defineEmits(['logout'])
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const notifications = ref([])
const notificationError = ref('')
const unreadCount = ref(0)
const confirmingClear = ref(false)
const clearingNotifications = ref(false)
const { show: toast } = useToast()

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

// (Carolyn) mark all as read, delete one, clear all (server: PATCH /read-all, DELETE /:id, DELETE /)
async function markAllRead() {
  try {
    const result = await auth.authorizedRequest('/notifications/read-all', { method: 'PATCH' })
    notifications.value.forEach((item) => { item.readAt ||= result.readAt })
    unreadCount.value = 0
  } catch (err) {
    notificationError.value = err.message
  }
}
async function removeNotification(notification) {
  try {
    await auth.authorizedRequest(`/notifications/${notification._id}`, { method: 'DELETE' })
    notifications.value = notifications.value.filter((item) => item._id !== notification._id)
    if (!notification.readAt) unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (err) {
    notificationError.value = err.message
  }
}
async function clearAll() {
  if (clearingNotifications.value) return
  clearingNotifications.value = true
  notificationError.value = ''
  try {
    await auth.authorizedRequest('/notifications', { method: 'DELETE' })
    notifications.value = []
    unreadCount.value = 0
    confirmingClear.value = false
    toast('All notifications cleared')
  } catch (err) {
    notificationError.value = err.message
    toast(err.message || 'Could not clear notifications', 'error')
  } finally {
    clearingNotifications.value = false
  }
}

// (Carolyn) icon + colour for each kind of notice
const NOTICE_LOOK = {
  watering_amount_changed: { icon: '💧', tone: 'off' },
  visit_missed: { icon: '⚠', tone: 'missed' },
  visit_expired: { icon: '↩', tone: 'expired' },
  visit_weather_skipped: { icon: '🌧', tone: 'rain' },
  visit_opted_out: { icon: '👋', tone: 'off' },
}
function noticeLook(notification) {
  return NOTICE_LOOK[notification.type] || { icon: '🔔', tone: 'off' }
}

// (Carolyn) "Just now", "5m ago", "3h ago", "Yesterday", "4 days ago", then "28 Oct"
function timeAgo(value) {
  const minutes = Math.floor((Date.now() - new Date(value)) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

function hasMakeupAction(notification) {
  return notification.type === 'visit_missed' && /make-up visit/i.test(notification.message)
}

// Open the matching request from missed or expired visit alerts.
async function openNotification(notification) {
  await markNotificationRead(notification)
  if (notification.type === 'watering_amount_changed' && notification.visitId) {
    await router.push({ name: 'visit-detail', params: { visitId: notification.visitId } })
    return
  }
  const opensRequest = notification.type === 'visit_expired' || hasMakeupAction(notification)
  if (notification.requestId && opensRequest) {
    await router.push({
      path: '/requests',
      query: { tab: 'requests', requestId: notification.requestId },
    })
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
const bellToggle = ref(null) // (Carolyn) to close the notification panel after it opens a page
watch(() => route.fullPath, () => {
  if (menu.value) Collapse.getInstance(menu.value)?.hide()
  if (bellToggle.value) Dropdown.getInstance(bellToggle.value)?.hide()
})
watch(() => auth.accessToken, loadNotifications, { immediate: true })
</script>

<template>
  <nav class="navbar navbar-expand-md bg-body-tertiary" aria-label="Main navigation">
    <div class="container-fluid flex-wrap gap-2">
      <RouterLink class="navbar-brand order-0" to="/schedule"><img src="../../assets/Leaf It to Us Logo.png" height="40px"></RouterLink>
      <!-- Main links: in the hamburger menu below 768px (they don't fit on one row with the
           bell and avatar until then), beside the logo from md up -->
      <div v-if="auth.isAuthenticated" id="mainNav" ref="menu" class="collapse navbar-collapse order-3 order-md-1">
        <ul class="navbar-nav flex-wrap me-auto">
          <li v-for="item in navigationitems" :key="item.to" class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="item.to">{{ item.label }}</RouterLink>
          </li>
        </ul>
      </div>

      <div class="d-flex align-items-center gap-2 ms-auto order-1 order-md-2">
        <!-- Display policy notices and let the user clear each unread badge. -->
        <div v-if="auth.isAuthenticated" class="dropdown">
          <button
            ref="bellToggle"
            type="button"
            class="btn notification-toggle position-relative"
            data-bs-toggle="dropdown"
            data-bs-auto-close="outside"
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
          <!-- (Carolyn) header with "Mark all read", icon per notice, dot for unread, ✕ to delete, "Clear all" -->
          <div class="dropdown-menu dropdown-menu-end notification-menu p-0">
            <div class="notification-head">
              <strong>Notifications</strong>
              <span v-if="unreadCount" class="unread-pill">{{ unreadCount }} new</span>
              <button v-if="unreadCount" type="button" class="head-link" @click="markAllRead">Mark all read</button>
            </div>
            <p v-if="notificationError" class="small text-danger px-3 pt-2 mb-0" role="alert">{{ notificationError }}</p>
            <div v-if="!notifications.length" class="notification-empty">
              <span aria-hidden="true">🌿</span>
              <p>You’re all caught up.</p>
            </div>
            <div v-else class="notification-list">
              <div
                v-for="item in notifications"
                :key="item._id"
                class="notification-item"
                :class="{ unread: !item.readAt }"
              >
                <span class="notice-icon" :class="`tone-${noticeLook(item).tone}`" aria-hidden="true">{{ noticeLook(item).icon }}</span>
                <div class="notice-body">
                  <button type="button" class="notification-message" @click="openNotification(item)">
                    <span>{{ item.message }}</span>
                    <small :title="new Date(item.createdAt).toLocaleString('en-GB')">{{ timeAgo(item.createdAt) }}</small>
                  </button>
                  <button
                    v-if="hasMakeupAction(item)"
                    type="button"
                    class="notification-action"
                    @click="openNotification(item)"
                  >Request make-up visit</button>
                </div>
                <span v-if="!item.readAt" class="unread-dot" aria-label="Unread"></span>
                <button type="button" class="notice-remove" aria-label="Delete notification" @click="removeNotification(item)">✕</button>
              </div>
            </div>
            <div v-if="notifications.length" class="notification-foot">
              <button type="button" class="head-link" :disabled="clearingNotifications" @click="confirmingClear = true">Clear all</button>
            </div>
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
            <!-- username only from lg: between 768 and 991px the links need the room -->
            <span class="d-none d-lg-inline">{{ auth.user.userName }}</span>
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
  <ConfirmDialog
    :open="confirmingClear"
    title="Clear all notifications?"
    message="This will delete all your notifications. This cannot be undone."
    confirm-label="Clear all"
    :busy="clearingNotifications"
    busy-label="Clearing..."
    @confirm="clearAll"
    @cancel="confirmingClear = false"
  />
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
/* (Carolyn) notification panel: fixed header/footer, list scrolls in between */
.notification-menu { width: min(380px, calc(100vw - 1rem)); overflow: hidden; border: 1px solid #e2e8e2; border-radius: 16px; box-shadow: 0 14px 40px #10231b26; }
.notification-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1rem; border-bottom: 1px solid #e7ece7; }
.notification-head strong { font-size: 1rem; }
.unread-pill { padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--tint, #daf2e3); color: var(--primary-deep, #0e6138); font-size: 0.75rem; font-weight: 700; }
.head-link { margin-left: auto; padding: 0; border: 0; background: none; color: var(--primary, #14804a); font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.head-link:hover { text-decoration: underline; }
.notification-list { max-height: min(60vh, 420px); overflow-y: auto; padding: 0.35rem; }
.notification-item { position: relative; display: flex; align-items: flex-start; gap: 0.7rem; padding: 0.7rem 2rem 0.7rem 0.65rem; border-radius: 12px; color: inherit; white-space: normal; }
.notification-item:hover { background: #f4f8f5; }
.notification-item + .notification-item { margin-top: 0.15rem; }
.notice-icon { flex-shrink: 0; display: grid; place-items: center; width: 2.2rem; height: 2.2rem; border-radius: 50%; background: #eceeed; font-size: 1rem; }
.notice-icon.tone-missed { background: #fde8ea; color: #a3212f; }
.notice-icon.tone-expired { background: #fff3d1; color: #795900; }
.notice-icon.tone-rain { background: #e4f6fa; color: #07657a; }
.notice-body { flex: 1; min-width: 0; display: grid; gap: 0.4rem; }
.notification-message { display: grid; gap: 0.2rem; padding: 0; border: 0; background: transparent; color: #4d5a51; font-size: 0.9rem; line-height: 1.35; text-align: left; cursor: pointer; }
.notification-item.unread .notification-message { color: #1f2d24; font-weight: 600; }
.notification-message small { color: #7a877e; font-size: 0.78rem; font-weight: 400; }
.unread-dot { position: absolute; top: 1.05rem; right: 0.75rem; width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--primary, #14804a); }
/* ✕ shows on hover (always on touch screens); the unread dot hides while it shows */
.notice-remove { position: absolute; top: 0.55rem; right: 0.4rem; display: grid; place-items: center; width: 1.6rem; height: 1.6rem; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #7a877e; font-size: 0.8rem; opacity: 0; cursor: pointer; }
.notification-item:hover .notice-remove, .notice-remove:focus-visible { opacity: 1; }
.notification-item:hover .unread-dot { opacity: 0; }
.notice-remove:hover { background: #e7ece7; color: #1f2d24; }
@media (hover: none) { .notice-remove { opacity: 1; } .unread-dot { right: 2.2rem; } }
.notification-empty { display: grid; justify-items: center; gap: 0.25rem; padding: 1.75rem 1rem; color: #68766b; }
.notification-empty span { font-size: 1.6rem; }
.notification-empty p { margin: 0; font-size: 0.9rem; }
.notification-foot { display: flex; justify-content: center; padding: 0.6rem; border-top: 1px solid #e7ece7; }
.notification-foot .head-link { margin: 0; color: #8a5a55; }
/* (Carolyn) phones: panel spans the screen under the navbar (Bootstrap's position pushed it off the left edge).
   !important is needed because Bootstrap sets the position inline. */
@media (max-width: 575px) {
  .notification-menu.show { position: fixed !important; inset: 4.5rem 0.5rem auto 0.5rem !important; width: auto; transform: none !important; }
}
.notification-action { justify-self: start; padding: 0.3rem 0.55rem; border: 1px solid #34834c; border-radius: 6px; background: #fff; color: #245b34; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
.notification-action:hover { background: #e7f3e9; }
@media (max-width: 600px) {
  .navbar > .container-fluid { column-gap: 0.375rem !important; padding-inline: 0.5rem; }
  .navbar-brand { margin-right: 0; padding: 0; }
  .navbar-brand img { height: 34px; width: auto; }
  .navbar-toggler { width: 44px; min-height: 44px; padding: 0.375rem; }
  .navbar-toggler-icon { width: 24px; height: 24px; }
}
</style>
