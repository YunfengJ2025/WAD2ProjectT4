<script setup>
// Keep each request and sitter workflow in its own URL-backed tab.
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CareRequestsView from './CareRequestsView.vue'
import CareVisitsView from '@/views/careVisit/CareVisitsView.vue'

const route = useRoute()
const tab = computed(() => {
  const requestedTab = route.query.tab
  if (['requests', 'available', 'sits'].includes(requestedTab)) return requestedTab
  return 'care'
})
const tabs = [
  { id: 'care', label: 'Care requests' },
  { id: 'requests', label: 'My requests' },
  { id: 'available', label: 'Available sits' },
  { id: 'sits', label: 'My sits' },
]
</script>

<template>
  <div>
    <ul class="nav nav-tabs requests-tabs" role="tablist" aria-label="Care requests and sits">
      <li v-for="item in tabs" :key="item.id" class="nav-item" role="presentation">
        <RouterLink
          class="nav-link"
          :class="{ active: tab === item.id }"
          role="tab"
          :aria-selected="tab === item.id"
          :aria-current="tab === item.id ? 'page' : undefined"
          :to="{ path: '/requests', query: { tab: item.id } }"
        >{{ item.label }}</RouterLink>
      </li>
    </ul>

    <CareRequestsView v-if="tab === 'care'" section="create" />
    <CareRequestsView v-else-if="tab === 'requests'" section="mine" />
    <CareVisitsView v-else-if="tab === 'available'" section="available" />
    <CareVisitsView v-else section="mine" />
  </div>
</template>

<style scoped>
.requests-tabs {
  max-width: 1100px;
  margin: 0 auto 1.5rem;
  padding: 0 1rem;
  gap: 0.25rem;
}
.requests-tabs .nav-link {
  color: #526354;
  font-weight: 600;
  transition: color 0.18s ease, background-color 0.18s ease;
}
.requests-tabs .nav-link:hover {
  color: #245b34;
  background: #f0f8f1;
}
.requests-tabs .nav-link.active {
  color: #245b34;
}
</style>
