<template>
  <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
    <h5 class="fw-bold text-success mb-3">📅 Visit Dates & Status</h5>
    
    <div v-if="!visits || visits.length === 0" class="text-muted small">
      No scheduled visits found.
    </div>
    
    <div class="list-group list-group-flush" v-else>
      <div 
        v-for="visit in visits" 
        :key="visit.visitId" 
        class="list-group-item d-flex justify-content-between align-items-center py-3 border-bottom"
      >
        <div>
          <span class="fw-semibold">Date: {{ formatDate(visit.visitDate) }}</span>
          <span class="badge ms-2" :class="getBadge(visit.status)">{{ visit.status }}</span>
          <div class="small text-muted" v-if="visit.sitterId">Assigned Sitter: {{ visit.sitterId }}</div>
        </div>

        <div>
          <button 
            v-if="visit.status === 'Pending' && isSitter" 
            class="btn btn-outline-primary btn-sm rounded-pill fw-semibold"
            @click="$emit('accept-visit', visit.visitId)"
          >
            Accept Date
          </button>
          
          <button 
            v-if="(visit.status === 'Accepted' || visit.status === 'In Progress') && isSitter" 
            class="btn btn-success btn-sm rounded-pill fw-semibold ms-2"
            @click="$emit('open-checkin', visit.visitId)"
          >
            📸 Photo Check-In
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visits: { type: Array, default: () => [] },
  isSitter: { type: Boolean, default: false }
});

defineEmits(['accept-visit', 'open-checkin']);

// Safely format ISO strings or Date objects into clean local date strings
function formatDate(d) {
  if (!d) return 'N/A';
  const dateObj = new Date(d);
  return isNaN(dateObj.getTime()) ? d : dateObj.toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function getBadge(status) {
  switch (status) {
    case 'Pending': return 'bg-warning text-dark';
    case 'Accepted': return 'bg-info text-dark';
    case 'Completed': return 'bg-success';
    default: return 'bg-secondary';
  }
}
</script>