<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-8">
        <div class="card shadow-sm border-0 rounded-4 p-4">
          <h3 class="fw-bold text-success mb-2">🌿 Plant Owner: Post Care Request</h3>
          <p class="text-muted mb-4">Select your start and end dates. The app will generate daily care visits for every date in between!</p>

          <form @submit.prevent="submitRequest">
            <div class="mb-3">
              <label class="form-label fw-semibold">Owner User ID</label>
              <input type="number" class="form-control" v-model.number="form.ownerId" required>
            </div>

            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">Start Date</label>
                <input type="date" class="form-control" v-model="form.startDate" required>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">End Date</label>
                <input type="date" class="form-control" v-model="form.endDate" :min="form.startDate" required>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold">Token Reward (per visit)</label>
              <input type="number" class="form-control" v-model.number="form.tokenReward" min="1" required>
            </div>

            <div class="mb-4">
              <label class="form-label fw-semibold">Special Notes</label>
              <textarea class="form-control" rows="3" v-model="form.note" placeholder="E.g., Please water balcony plants thoroughly every morning."></textarea>
            </div>

            <button type="submit" class="btn btn-success w-100 py-2 rounded-3 fw-semibold" :disabled="loading">
              {{ loading ? 'Posting Request...' : 'Post Care Request' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import API from '@/services/api';

const router = useRouter();
const loading = ref(false);
const form = ref({
  ownerId: 1,
  startDate: '',
  endDate: '',
  tokenReward: 5,
  note: ''
});

async function submitRequest() {
  if (new Date(form.value.endDate) < new Date(form.value.startDate)) {
    alert('End date cannot be earlier than start date!');
    return;
  }

  loading.value = true;
  try {
    const res = await API.post('/care-requests', form.value);
    alert('Care request created successfully!');
    router.push(`/care-requests/${res.data.data.requestId}`);
  } catch (err) {
    console.error(err);
    alert('Failed to post care request.');
  } finally {
    loading.value = false;
  }
}
</script>