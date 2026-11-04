<script setup>
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Guests return to the public welcome page; signed-in users return to their schedule.
const auth = useAuthStore()
</script>

<template>
  <main class="not-found-page">
    <span class="not-found-code" aria-hidden="true">404</span>
    <h1>Page not found</h1>
    <p>This page may have moved, or the address may be incorrect.</p>
    <RouterLink :to="auth.isAuthenticated ? '/schedule' : '/'" class="btn btn-primary">
      {{ auth.isAuthenticated ? 'Back to my schedule' : 'Back to home' }}
    </RouterLink>
  </main>
</template>

<style scoped>
/* Center the recovery message without restricting text wrapping on phones. */
.not-found-page { max-width: 600px; margin: 4rem auto; padding: 2rem 1rem; text-align: center; }
/* Give the error number a quiet plant-green accent behind the main message. */
.not-found-code { display: block; font-size: clamp(4rem, 15vw, 7rem); font-weight: 700; color: var(--accent); line-height: 1.2; }
/* Keep the page's primary message clear on desktop and phone screens. */
h1 { font-size: clamp(1.6rem, 5vw, 2rem); margin: 1rem 0; }
/* Explain the missing page before offering a clear recovery action. */
p { color: var(--muted); line-height: 1.7; margin-bottom: 1.5rem; }
</style>
