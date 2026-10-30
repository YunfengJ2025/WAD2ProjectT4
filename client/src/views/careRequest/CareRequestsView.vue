<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePlantsStore } from '@/stores/plants'
import TokenBalance from '@/components/token/TokenBalance.vue'

const auth = useAuthStore()
const plantsStore = usePlantsStore()
const owned = ref([])
const available = ref([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const form = ref({ plantId: '', startDate: '', endDate: '', note: '', tokenReward: 1 })
const plants = computed(() => plantsStore.plants)
// Preview the full reservation for the inclusive date range, matching one visit per day.
// This UI check is advisory; the backend checks the current available balance atomically.
const totalReward = computed(() => {
  const start = toIsoDate(form.value.startDate)
  const end = toIsoDate(form.value.endDate)
  if (!start || !end || end < start) return 0
  return (
    (Math.round((new Date(end) - new Date(start)) / 86_400_000) + 1) *
    Number(form.value.tokenReward)
  )
})

function toIsoDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return ''
  const [, dayText, monthText, yearText] = match
  const day = Number(dayText)
  const month = Number(monthText)
  const year = Number(yearText)
  const check = new Date(Date.UTC(year, month - 1, day))
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  )
    return ''
  return `${yearText}-${monthText}-${dayText}`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([plantsStore.fetchPlants()])
    const [mine, open] = await Promise.all([
      auth.authorizedRequest('/care-requests'),
      auth.authorizedRequest('/care-visits/available'),
      auth.refreshUser(),
    ])
    owned.value = mine.requests
    available.value = open.visits
    if (!form.value.plantId && plants.value.length)
      form.value.plantId = String(plants.value[0].plantId)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function createRequest() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const startDate = toIsoDate(form.value.startDate)
    const endDate = toIsoDate(form.value.endDate)
    if (!startDate || !endDate)
      throw new Error('Enter both dates as DD/MM/YYYY, for example 30/10/2026.')
    const result = await auth.authorizedRequest('/care-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form.value,
        startDate,
        endDate,
        plantId: Number(form.value.plantId),
        tokenReward: Number(form.value.tokenReward),
      }),
    })
    notice.value = `Request #${result.request.requestId} posted.`
    form.value = {
      plantId: form.value.plantId,
      startDate: '',
      endDate: '',
      note: '',
      tokenReward: 1,
    }
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

async function accept(visit) {
  error.value = ''
  notice.value = ''
  try {
    await auth.authorizedRequest(`/care-visits/${visit.visitId}/accept`, { method: 'POST' })
    notice.value = `You accepted the visit for ${visit.plant?.plantName || 'the plant'}. Add proof from Care Visits.`
    await load()
  } catch (err) {
    error.value = err.message
  }
}

async function cancel(request) {
  error.value = ''
  try {
    await auth.authorizedRequest(`/care-requests/${request.requestId}/cancel`, { method: 'POST' })
    await load()
  } catch (err) {
    error.value = err.message
  }
}

const date = (value) => new Date(value).toLocaleDateString('en-GB')
</script>

<template>
  <main class="care-page">
    <header>
      <div>
        <h1>Care requests</h1>
        <p>Create one request for each plant, or accept a neighbour’s request.</p>
      </div>
    </header>
    <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
    <p v-if="notice" class="alert alert-success" role="status">{{ notice }}</p>

    <section class="panel">
      <h2>Post a request</h2>
      <TokenBalance />
      <p v-if="!plants.length">Add a plant first, then you can request care for it.</p>
      <form v-else class="request-form" @submit.prevent="createRequest">
        <label
          >Plant<select v-model="form.plantId" required>
            <option v-for="plant in plants" :key="plant.plantId" :value="String(plant.plantId)">
              {{ plant.plantName }}
            </option>
          </select></label
        >
        <label
          >Start date<input
            v-model="form.startDate"
            type="text"
            inputmode="numeric"
            placeholder="DD/MM/YYYY"
            pattern="\d{2}/\d{2}/\d{4}"
            autocomplete="off"
            required
        /></label>
        <label
          >End date<input
            v-model="form.endDate"
            type="text"
            inputmode="numeric"
            placeholder="DD/MM/YYYY"
            pattern="\d{2}/\d{2}/\d{4}"
            autocomplete="off"
            required
        /></label>
        <label
          >Reward per visit (tokens)<input
            v-model.number="form.tokenReward"
            type="number"
            min="1"
            step="1"
            required
        /></label>
        <p class="wide">
          {{ totalReward }} tokens will be frozen for this request (one visit per day).
        </p>
        <label class="wide"
          >Note<textarea
            v-model="form.note"
            maxlength="1000"
            rows="3"
            placeholder="Care instructions for the sitter"
          ></textarea>
        </label>
        <button
          class="btn btn-primary"
          :disabled="
            saving ||
            totalReward > (auth.user?.availableTokenBalance ?? auth.user?.tokenBalance ?? 0)
          "
        >
          {{ saving ? 'Posting…' : 'Post request' }}
        </button>
      </form>
    </section>

    <div class="columns">
      <section class="panel">
        <h2>My requests</h2>
        <p v-if="loading">Loading requests…</p>
        <p v-else-if="!owned.length">You haven’t posted a request yet.</p>
        <article v-for="request in owned" :key="request.requestId" class="request-card">
          <div>
            <strong>{{ request.plant?.plantName || 'Plant' }}</strong
            ><span class="status">{{ request.status.replace('_', ' ') }}</span>
          </div>
          <p>
            {{ date(request.startDate) }} – {{ date(request.endDate) }} ·
            {{ request.tokenReward }} tokens
          </p>
          <p v-if="request.note">{{ request.note }}</p>
          <button
            v-if="['open', 'in_progress'].includes(request.status)"
            class="btn btn-outline-secondary btn-sm"
            @click="cancel(request)"
          >
            Cancel request
          </button>
          <ul v-if="request.visits?.length" class="proof-list">
            <li v-for="visit in request.visits" :key="visit.visitId">
              {{ date(visit.visitDate) }} · {{ visit.plant?.plantName || 'Plant' }} ·
              {{ visit.status
              }}<template v-if="visit.proofUrl">
                ·
                <a :href="visit.proofUrl" target="_blank" rel="noopener noreferrer"
                  >View proof</a
                ></template
              >
            </li>
          </ul>
        </article>
      </section>

      <section class="panel">
        <h2>Available to sit</h2>
        <p v-if="loading">Loading requests…</p>
        <p v-else-if="!available.length">No open requests right now.</p>
        <article v-for="visit in available" :key="visit.visitId" class="request-card">
          <div>
            <strong>{{ visit.plant?.plantName || 'Plant' }}</strong
            ><span class="status">{{ visit.request?.tokenReward }} tokens</span>
          </div>
          <p>{{ date(visit.visitDate) }} · {{ visit.owner?.userName || 'Neighbour' }}</p>
          <p v-if="visit.plant?.plantLocation">Plant location: {{ visit.plant.plantLocation }}</p>
          <p v-if="visit.request?.note">{{ visit.request.note }}</p>
          <button class="btn btn-primary btn-sm" @click="accept(visit)">Accept visit</button>
        </article>
      </section>
    </div>
  </main>
</template>

<style scoped>
.care-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1rem 3rem;
}
header {
  margin-bottom: 1.25rem;
}
h1 {
  font-weight: 700;
}
.panel {
  background: var(--surface, #fff);
  border: 1px solid var(--color-border, #dce5dc);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.panel h2 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
}
.request-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.request-form label {
  display: grid;
  gap: 0.35rem;
  font-weight: 600;
}
.request-form input,
.request-form select,
.request-form textarea {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #b9c7bb;
  border-radius: 7px;
  font: inherit;
}
.wide {
  grid-column: 1/-1;
}
.request-form button {
  justify-self: start;
}
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.request-card {
  padding: 0.9rem 0;
  border-top: 1px solid #e2e8e2;
}
.request-card div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
.request-card p {
  margin: 0.35rem 0;
  color: #59665c;
}
.status {
  text-transform: capitalize;
  background: #e8f3e9;
  color: #2d6740;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.8rem;
}
.proof-list {
  padding-left: 1rem;
  margin: 0.5rem 0;
  color: #59665c;
  font-size: 0.9rem;
}
@media (max-width: 700px) {
  .columns {
    grid-template-columns: 1fr;
  }
  .request-form {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
}
</style>
