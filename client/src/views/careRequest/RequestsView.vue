<script setup>
// Requests page: two tabs that show the existing Care Requests and Care Visits pages.
// The tab is kept in the URL (?tab=sits) so links can open a specific tab.
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CareRequestsView from './CareRequestsView.vue'
import CareVisits from '@/components/careVisit/CareVisits.vue'

const route = useRoute()
const tab = computed(() => (route.query.tab === 'sits' ? 'sits' : 'requests'))
</script>

<template>
  <div>
    <ul class="nav nav-tabs requests-tabs">
      <li class="nav-item">
        <RouterLink
          class="nav-link"
          :class="{ active: tab === 'requests' }"
          :aria-current="tab === 'requests' ? 'page' : undefined"
          :to="{ path: '/requests' }"
        >My Requests</RouterLink>
      </li>
      <li class="nav-item">
        <RouterLink
          class="nav-link"
          :class="{ active: tab === 'sits' }"
          :aria-current="tab === 'sits' ? 'page' : undefined"
          :to="{ path: '/requests', query: { tab: 'sits' } }"
        >My Sits</RouterLink>
      </li>
    </ul>

    <CareRequestsView v-if="tab === 'requests'" />
    <CareVisits v-else />
  </div>
</template>

<style scoped>
.requests-tabs {
  max-width: 1100px;
  margin: 0 auto 1.5rem;
  padding: 0 1rem;
}
</style>
