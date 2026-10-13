<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'
import ToastHost from './components/ToastHost.vue'

const route = useRoute()
</script>

<template>
  <header v-if="route.path.startsWith('/plants')" class="topbar">
    <nav>
      <RouterLink to="/plants" :class="{ active: route.path.startsWith('/plants') }">
        My Plants
      </RouterLink>
    </nav>
  </header>

  <RouterView :key="route.path" />
  <ToastHost />
</template>

<style scoped>
.topbar {
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
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
