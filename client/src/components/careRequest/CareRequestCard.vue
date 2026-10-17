<template>
  <div class="card shadow-sm border-0 rounded-4 p-3 h-100">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="fw-bold mb-0 text-success">ID: {{ request.requestId }}</h6>
      <span class="badge" :class="badgeClass">{{ request.status }}</span>
    </div>
    <p class="mb-1 text-muted small"><strong>Owner:</strong> {{ request.ownerId }}</p>
    <p class="mb-1 small"><strong>Duration:</strong> {{ formatDate(request.startDate) }} - {{ formatDate(request.endDate) }}</p>
    <p class="mb-2 small"><strong>Reward:</strong> 🎁 {{ request.tokenReward }} Tokens / visit</p>
    <p class="text-secondary small mb-3">{{ request.note || 'No notes specified.' }}</p>
    
    <div class="mt-auto">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  request: { type: Object, required: true }
});

function formatDate(d) {
  return new Date(d).toLocaleDateString();
}

const badgeClass = computed(() => {
  switch (props.request.status) {
    case 'Pending': return 'bg-warning text-dark';
    case 'Accepted': return 'bg-info text-dark';
    case 'Completed': return 'bg-success';
    default: return 'bg-secondary';
  }
});
</script>