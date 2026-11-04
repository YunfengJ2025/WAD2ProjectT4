<script setup>
// My requests is the main view; the "New Request" button opens the creation form
// at /requests?tab=new. ("care" is the old name of that tab, kept for old links.)
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CareRequestsView from './CareRequestsView.vue'

const route = useRoute()
const creating = computed(() => ['new', 'care'].includes(route.query.tab))
</script>

<template>
  <CareRequestsView v-if="creating" section="create" />
  <CareRequestsView v-else section="mine" />
</template>
