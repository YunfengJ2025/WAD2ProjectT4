<template>
  <div class="container py-4">
    <h3 class="fw-bold text-primary mb-2">🏡 Plant Sitter Marketplace</h3>
    <p class="text-muted mb-4">Browse requests from nearby plant owners, accept individual visit dates, and upload photo check-ins.</p>

    <!-- Fallback Alert if array is empty -->
    <div v-if="requests.length === 0" class="alert alert-info rounded-3 shadow-sm">
      No care requests available right now. Switch to the <strong>Owner View</strong> to post a new request!
    </div>

    <!-- Requests Grid -->
    <div class="row" v-else>
      <div class="col-md-6 mb-4" v-for="req in requests" :key="req.requestId">
        <CareRequestCard :request="req">
          <template #actions>
            <button class="btn btn-primary w-100 rounded-pill btn-sm fw-semibold" @click="selectRequest(req)">
              View All Visit Dates
            </button>
          </template>
        </CareRequestCard>
      </div>
    </div>

    <!-- Generated Daily Visit Dates -->
    <div v-if="selectedRequest" class="mt-4 pt-3 border-top">
      <h4 class="fw-bold text-dark mb-3">All Generated Visit Dates for {{ selectedRequest.requestId }}</h4>
      <VisitDateSelector 
        :visits="selectedVisits" 
        :isSitter="true" 
        @accept-visit="acceptVisit"
        @open-checkin="openCheckInModal"
      />
    </div>

    <!-- Photo Check-In Modal -->
    <CheckInModal 
      v-if="activeVisitId" 
      :visitId="activeVisitId" 
      @close="activeVisitId = null" 
      @submit-proof="submitPhotoProof" 
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import API from '@/services/api'
import CareRequestCard from '@/components/careRequest/CareRequestCard.vue'
import VisitDateSelector from '@/components/careRequest/VisitDateSelector.vue'
import CheckInModal from '@/components/careVisit/CheckInModal.vue'

const requests = ref([])
const selectedRequest = ref(null)
const selectedVisits = ref([])
const activeVisitId = ref(null)

async function fetchRequests() {
  try {
    const res = await API.get('/care-requests')
    requests.value = res.data
  } catch (err) {
    console.error('Error fetching care requests:', err)
  }
}

async function selectRequest(req) {
  selectedRequest.value = req
  selectedVisits.value = []
  try {
    const res = await API.get(`/care-requests/${req.requestId}/visits`)
    selectedVisits.value = res.data
  } catch (err) {
    console.error('Error fetching visits:', err)
  }
}

async function acceptVisit(visitId) {
  try {
    await API.put(`/care-visits/${visitId}/accept`, { sitterId: 2 })
    alert('Visit date accepted successfully!')
    if (selectedRequest.value) {
      await selectRequest(selectedRequest.value)
    }
  } catch (err) {
    console.error('Error accepting visit:', err)
    alert('Failed to accept visit.')
  }
}

function openCheckInModal(visitId) {
  activeVisitId.value = visitId
}

async function submitPhotoProof(payload) {
  try {
    await API.post(`/care-visits/${payload.visitId}/check-in`, { photoUrl: payload.photoUrl });
    alert('Photo proof uploaded! Visit marked as completed.');
    activeVisitId.value = null;

    // Refresh both the requests list and the selected request's visits
    await fetchRequests();
    if (selectedRequest.value) {
      await selectRequest(selectedRequest.value);
    }
  } catch (err) {
    console.error('Error submitting proof:', err);
    alert('Failed to submit photo check-in.');
  }
}

onMounted(() => {
  fetchRequests()
})
</script>