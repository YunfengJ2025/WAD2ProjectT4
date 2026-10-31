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
            <!-- Shop isn't built yet, so it can't be clicked -->
            <li>
              <span class="dropdown-item disabled" aria-disabled="true">
                Shop <small class="coming-soon">Coming soon</small>
              </span>
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
</style>
