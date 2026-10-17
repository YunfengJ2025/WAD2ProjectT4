<template>
  <div class="container py-4" v-if="request">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h3 class="fw-bold mb-0">📋 Request Details: {{ request.requestId }}</h3>
      <router-link to="/" class="btn btn-outline-secondary btn-sm rounded-pill">Post Another</router-link>
    </div>

    <div class="row">
      <div class="col-md-4 mb-4">
        <CareRequestCard :request="request" />
      </div>
      <div class="col-md-8">
        <VisitDateSelector :visits="visits" :isSitter="false" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import API from '@/services/api';
import CareRequestCard from '@/components/careRequest/CareRequestCard.vue';
import VisitDateSelector from '@/components/careRequest/VisitDateSelector.vue';

const route = useRoute();
const request = ref(null);
const visits = ref([]);

async function loadDetails() {
  try {
    const reqId = route.params.id;
    const reqRes = await API.get(`/care-requests/${reqId}`);
    request.value = reqRes.data;

    const visitsRes = await API.get(`/care-requests/${reqId}/visits`);
    visits.value = visitsRes.data;
  } catch (err) {
    console.error(err);
  }
}

onMounted(loadDetails);
</script>