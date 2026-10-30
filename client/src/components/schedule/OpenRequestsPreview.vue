<script setup>
// Home page card: the next 3 open care visits a neighbour can accept,
// with a link to see the rest.
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const SHOW = 3

const auth = useAuthStore()
const visits = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const data = await auth.authorizedRequest('/care-visits/available')
    total.value = data.visits.length
    visits.value = data.visits.slice(0, SHOW)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

const date = (value) => new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
</script>

<template>
  <section class="open-requests" aria-labelledby="open-requests-title">
    <header>
      <h2 id="open-requests-title">Neighbours who need help</h2>
      <RouterLink v-if="total > 0" to="/find-nearby" class="view-more">View more →</RouterLink>
    </header>

    <p v-if="loading" class="muted">Loading requests…</p>
    <p v-else-if="error" class="muted">Couldn't load requests right now.</p>
    <p v-else-if="!visits.length" class="muted">No open requests right now.</p>

    <ul v-else>
      <li v-for="visit in visits" :key="visit.visitId">
        <div>
          <strong>{{ visit.plant?.plantName || 'Plant' }}</strong>
          <span class="muted">{{ date(visit.visitDate) }} · {{ visit.owner?.userName || 'Neighbour' }}</span>
        </div>
        <span class="reward">{{ visit.request?.tokenReward }} tokens</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.open-requests {
  margin-top: 1.5rem;
  padding: 1.25rem;
  background: var(--surface, #fff);
  border: 1px solid var(--color-border, #dce5dc);
  border-radius: 12px;
}

header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

h2 {
  font-size: 1.2rem;
  margin: 0;
}

.view-more {
  white-space: nowrap;
  font-weight: 600;
  color: var(--accent);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 0;
  border-top: 1px solid var(--color-border, #e2e8e2);
}

li div {
  display: grid;
  min-width: 0;
}

.muted {
  color: var(--muted);
  margin: 0;
}

.reward {
  flex-shrink: 0;
  background: #e8f3e9;
  color: #2d6740;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
