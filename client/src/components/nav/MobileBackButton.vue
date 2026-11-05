<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

function goBack() {
  const previous = router.options.history.state.back
  // Use app history when available; direct links still have a useful parent.
  if (typeof previous === 'string' && previous.startsWith('/') &&
      !previous.startsWith('//') && !/^\/(signin|register)([/?#]|$)/.test(previous) &&
      previous !== route.fullPath) {
    router.back()
    return
  }
  let parent = '/schedule'
  if (route.name === 'schedule') parent = '/'
  else if (route.name === 'plant-edit') parent = `/plants/${route.params.plantId}`
  else if (['plant-new', 'plant-detail'].includes(route.name)) parent = '/plants'
  else if (['post-new', 'post-edit', 'post-detail', 'my-posts', 'recently-liked'].includes(route.name)) parent = '/community'
  else if (['visit-detail', 'Find Nearby'].includes(route.name)) parent = '/my-sits'
  else if (route.name === 'public-profile') parent = '/profile'
  router.replace(parent)
}
</script>

<template>
  <button class="mobile-back" type="button" aria-label="Go back" @click="goBack">
    <span aria-hidden="true">←</span> Back
  </button>
</template>

<style scoped>
.mobile-back { display: none; }
@media (max-width: 600px) {
  .mobile-back { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; margin-bottom: 0; padding: 0 0.25rem; border: 0; background: transparent; color: var(--muted); font: inherit; cursor: pointer; }
  .mobile-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
}
</style>
