<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-md-8">
        <div class="card shadow-sm border-0 rounded-4 p-4">
          <h3 class="fw-bold text-success mb-2">🌿 Plant Owner: Post Care Request</h3>
          <p class="text-muted mb-4">Pick your dates. A visit is created only for days when one of your plants needs watering,
            and the sitter submits one photo per plant.
          </p>

          <form @submit.prevent="submitRequest">
            <div class="mb-3">
              <label class="form-label fw-semibold">Owner User ID</label>
              <input type="number" class="form-control" v-model.number="form.ownerId" @change="loadPlants" required>
            </div>

            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">Start Date</label>
                <input type="date" class="form-control" v-model="form.startDate" :min="todayISO" required>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label fw-semibold">End Date</label>
                <input type="date" class="form-control" v-model="form.endDate" :min="form.startDate || todayISO" required>
              </div>
            </div>

            <!-- Preview: which plants need a photo on which visit -->
            <div class="mb-3">
              <label class="form-label fw-semibold">Visits that will be created</label>

              <div v-if="plantsLoading" class="text-muted small">Loading your plants...</div>
              <div v-else-if="plantsError" class="text-danger small">{{ plantsError }}</div>
              <div v-else-if="!myPlants.length" class="text-muted small">
                No plants found for this owner.
              </div>
              <div v-else-if="!form.startDate || !form.endDate" class="text-muted small">
                Choose a start and end date to see the visits.
              </div>
              <div v-else-if="!days.length" class="alert alert-warning py-2 mb-0 small">
                None of your plants need watering between these dates.
              </div>

              <ul v-else class="list-group">
                <li v-for="day in days" :key="day.date"
                    class="list-group-item d-flex justify-content-between align-items-start">
                  <span class="fw-semibold">{{ formatDate(day.date) }}</span>
                  <span class="text-end small">
                    <span v-for="id in day.plantIds" :key="id" class="badge bg-success-subtle text-success-emphasis ms-1">
                      🪴 {{ plantName(id) }}
                    </span>
                  </span>
                </li>
              </ul>
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold">Token Reward (per visit)</label>
              <input type="number" class="form-control" v-model.number="form.tokenReward" min="1" required>
              <div v-if="days.length" class="form-text">
                Total: {{ days.length * form.tokenReward }} tokens for {{ days.length }}
                visit{{ days.length === 1 ? '' : 's' }}
                ({{ photoCount }} photo{{ photoCount === 1 ? '' : 's' }} to be submitted).
              </div>
            </div>

            <div class="mb-4">
              <label class="form-label fw-semibold">Special Notes</label>
              <textarea class="form-control" rows="3" v-model="form.note" placeholder="E.g., Please water balcony plants thoroughly every morning."></textarea>
            </div>

            <button type="submit" class="btn btn-success w-100 py-2 rounded-3 fw-semibold"
                    :disabled="loading || !days.length">
              {{ loading ? 'Posting Request...' : 'Post Care Request' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import API from '@/services/api';
import { buildSchedule } from '@/composables/schedule/buildSchedule'
import { startOfDay, toDateInputValue } from '@/utils/wateringStatus'

const router = useRouter();
const loading = ref(false);
const todayISO = toDateInputValue(startOfDay(new Date())) // local date, not UTC

const form = ref({
  ownerId: 1,
  startDate: '',
  endDate: '',
  tokenReward: 5,
  note: ''
});

// ---------- the owner's plants ----------
const myPlants = ref([])
const plantsLoading = ref(false)
const plantsError = ref('')

async function loadPlants() {
  plantsLoading.value = true
  plantsError.value = ''
  try {
    const res = await API.get(`/care-requests/plants/${form.value.ownerId}`)
    myPlants.value = res.data
  } catch (err) {
    console.error('Error loading plants:', err)
    myPlants.value = []
    plantsError.value = 'Could not load your plants.'
  } finally {
    plantsLoading.value = false
  }
}
onMounted(loadPlants)

function plantName(plantId) {
  const plant = myPlants.value.find((p) => String(p.plantId) === String(plantId))
  return plant ? plant.plantName : plantId
}

// which plants are due on which date
// Reuses the schedule logic: every plant's watering dates, kept only if inside the chosen range
const days = computed(() => {
  const { startDate, endDate } = form.value
  if (!startDate || !endDate || endDate < startDate || !myPlants.value.length) return []

  // buildSchedule counts forward from today, so make the window reach endDate (inclusive)
  const today = startOfDay(new Date())
  const end = new Date(endDate + 'T00:00:00')
  const windowDays = Math.round((end - today) / 86400000) + 1
  if (windowDays < 1) return []

  const items = buildSchedule(myPlants.value, new Date(), windowDays)

  const byDate = {}
  for (const item of items) {
    if (item.status === 'done') continue                       // already watered today
    if (item.dueAt < startDate || item.dueAt > endDate) continue
    if (!byDate[item.dueAt]) byDate[item.dueAt] = []
    byDate[item.dueAt].push(item.plantId)
  }

  return Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, plantIds]) => ({ date, plantIds }))
})

const photoCount = computed(() =>
  days.value.reduce((total, day) => total + day.plantIds.length, 0)
)

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

// submit 
async function submitRequest() {
  if (!days.value.length) {
    alert('None of your plants need watering in that range.')
    return
  }

  loading.value = true
  try {
    const res = await API.post('/care-requests', {
      ...form.value,
      days: days.value, // [{ date, plantIds }] -> server makes one visit per date, one item per plant
    })
    alert('Care request created successfully!')
    router.push(`/care-requests/${res.data.data.requestId}`)
  } catch (err) {
    console.error(err)
    alert(err.response?.data?.message || 'Failed to post care request.')
  } finally {
    loading.value = false
  }
}
</script>