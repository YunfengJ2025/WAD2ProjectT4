<script setup>
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

defineProps({ navigationitems: { type: Array, default: () => [] } })
defineEmits(['logout'])
const auth = useAuthStore()
</script>

<template>
  <nav class="navbar navbar-expand bg-body-tertiary" aria-label="Main navigation">
    <div class="container-fluid flex-wrap gap-2">
      <RouterLink class="navbar-brand" to="/">Leaf it to us</RouterLink>
      <ul class="navbar-nav flex-wrap me-auto mb-2 mb-lg-0">
        <li v-for="item in navigationitems" :key="item.to" class="nav-item">
          <RouterLink class="nav-link" active-class="active" :to="item.to">{{ item.label }}</RouterLink>
        </li>
      </ul>
      <div class="d-flex align-items-center gap-2">
        <template v-if="auth.isAuthenticated">
          <RouterLink class="nav-link" active-class="active" to="/profile">{{ auth.user.userName }}</RouterLink>
          <button type="button" class="btn btn-outline-secondary" @click="$emit('logout')">Log out</button>
        </template>
        <template v-else>
          <RouterLink class="btn btn-outline-secondary" to="/signin">Sign in</RouterLink>
          <RouterLink class="btn btn-primary" to="/register">Create account</RouterLink>
        </template>
      </div>
    </div>
  </nav>
</template>
