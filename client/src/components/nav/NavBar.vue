<script setup>
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/user/UserAvatar.vue'

defineProps({ navigationitems: { type: Array, default: () => [] } })
defineEmits(['logout'])
const auth = useAuthStore()
</script>

<template>

  <nav class="navbar navbar-expand-sm bg-body-tertiary" aria-label="Main navigation">
    
    <div class="container-fluid flex flex-wrap gap-2">
      <RouterLink class="navbar-brand order-sm-0" to="/">Leaf it to us</RouterLink>
      <div class="collapse navbar-collapse">
        <ul class="navbar-nav flex-wrap me-auto mb-2 mb-lg-0">
          <li v-for="item in navigationitems" :key="item.to" class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="item.to">{{ item.label }}</RouterLink>
          </li>
        </ul>
      </div>

      <div class="d-flex align-items-center gap-2 order-sm-1">
        <template v-if="auth.isAuthenticated">
          <RouterLink class="nav-link d-flex align-items-center gap-2" active-class="active" to="/profile" aria-label="My profile">
            <UserAvatar :user="auth.user" :size="34" />
            {{ auth.user.userName }}
          </RouterLink>
          <button type="button" class="btn btn-outline-secondary" @click="$emit('logout')">Log out</button>
        </template>
        <template v-else>
          <RouterLink class="btn btn-outline-secondary" to="/signin">Sign in</RouterLink>
          <RouterLink class="btn btn-primary" to="/register">Create account</RouterLink>
        </template>
      </div>

      <button class="navbar-toggler order-sm-2" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
      </button>
    
    </div>
  </nav>
</template>
