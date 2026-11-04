<script setup>
import Loading from '@/components/Loading.vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePlantsStore } from '@/stores/plants'
import { RouterLink, useRoute } from 'vue-router'
import TokenBalance from '@/components/token/TokenBalance.vue'
import CareRequestForm from '@/components/careRequest/CareRequestForm.vue'
import CareRequestCard from '@/components/careRequest/CareRequestCard.vue'
import PlantHealthPanel from '@/components/careRequest/PlantHealthPanel.vue'

// Let the parent tabs show request creation and the owner's request list separately.
const props = defineProps({
  section: { type: String, default: 'all' },
})

const auth = useAuthStore()
const route = useRoute()
const plantsStore = usePlantsStore()
const plants = computed(() => plantsStore.plants)
const owned = ref([])
const loading = ref(true)
const saving = ref(false)
const cancellingRequestId = ref(0)
const makeupBusyVisitId = ref(0)
const formVersion = ref(0)
const error = ref('')
const notice = ref('')

// Scroll the linked owner request into view after its cards have rendered.
async function focusRequestedCard() {
  const requestId = Number(route.query.requestId)
  if (!Number.isSafeInteger(requestId)) return
  await nextTick()
  document.getElementById(`care-request-${requestId}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
}

watch(() => route.query.requestId, focusRequestedCard)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([plantsStore.fetchPlants(), auth.refreshUser()])
    const mine = await auth.authorizedRequest('/care-requests')
    owned.value = mine.requests
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
  await focusRequestedCard()
}

onMounted(load)

async function createRequest(requestDetails) {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await auth.authorizedRequest('/care-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestDetails),
    })
    notice.value = `Request #${result.request.requestId} posted.`
    formVersion.value++
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

async function cancelRequest(request) {
  cancellingRequestId.value = request.requestId
  error.value = ''
  notice.value = ''
  try {
    await auth.authorizedRequest(`/care-requests/${request.requestId}/cancel`, { method: 'POST' })
    notice.value = `Request #${request.requestId} cancelled.`
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    cancellingRequestId.value = 0
  }
}

// Format replacement request dates in Singapore time, matching server policy dates.
function singaporeDateString(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value))
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${date.year}-${date.month}-${date.day}`
}

function addCalendarDays(value, days) {
  const [year, month, day] = value.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

// Post a one-day make-up request after the original date range to avoid duplicates.
async function requestMakeup({ request, visit }) {
  makeupBusyVisitId.value = visit.visitId
  error.value = ''
  notice.value = ''
  try {
    const tomorrow = addCalendarDays(singaporeDateString(new Date()), 1)
    const dayAfterRequest = addCalendarDays(singaporeDateString(request.endDate), 1)
    const startDate = dayAfterRequest > tomorrow ? dayAfterRequest : tomorrow
    // Replacement requests are routed with care visit operations.
    const result = await auth.authorizedRequest(`/care-visits/make-up/${visit.visitId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate }),
    })
    notice.value = `Make-up request #${result.request.requestId} posted for ${startDate}.`
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    makeupBusyVisitId.value = 0
  }
}

// ---------- filter pills: Active / Completed / Cancelled ----------
const GROUPS = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]
const filter = ref('active')

// anything that is not finished or cancelled counts as active (funding, open, in progress)
const groupOf = (request) => (['completed', 'cancelled'].includes(request.status) ? request.status : 'active')
const groups = computed(() =>
  GROUPS.map((group) => ({ ...group, requests: owned.value.filter((request) => groupOf(request) === group.key) })),
)
const shown = computed(() => groups.value.find((group) => group.key === filter.value)?.requests ?? [])
// the owner opened a health result: save that it has been seen (if this fails it simply stays marked new)
async function markHealthSeen(check) {
  try {
    const result = await auth.authorizedRequest(`/care-requests/health/${check.healthCheckId}/seen`, { method: 'PATCH' })
    check.ownerSeenAt = result.healthCheck.ownerSeenAt
  } catch {
    // leave it as new
  }
}
</script>

<template>
  <main class="care-page" :class="{ 'mine-page': props.section === 'mine' }">
    <RouterLink v-if="props.section === 'create'" to="/requests" class="back-link">← My requests</RouterLink>
    <header class="page-heading">
      <div>
        <h1>{{ props.section === 'mine' ? 'My Requests' : 'New Requests' }}</h1>
        <p v-if="props.section !== 'mine'">Choose one or more of your plants and create a care request for them.</p>
        <p v-else>View and manage the care requests you have posted.</p>
      </div>
      <RouterLink
        v-if="props.section === 'mine'"
        :to="{ path: '/requests', query: { tab: 'new' } }"
        class="btn btn-primary"
      >+ New Request</RouterLink>
    </header>

    <div v-if="props.section !== 'create' && owned.length" class="pills" role="group" aria-label="Filter requests">
      <button
        v-for="group in groups"
        :key="group.key"
        type="button"
        class="pill"
        :class="{ on: filter === group.key }"
        :aria-pressed="filter === group.key"
        @click="filter = group.key"
      >{{ group.label }}<b>{{ group.requests.length }}</b></button>
    </div>

    <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
    <p v-if="notice" class="alert alert-success" role="status">{{ notice }}</p>

    <section v-if="props.section !== 'mine'" class="panel">
      <h2>Your tokens</h2>
      <TokenBalance />
    </section>

    <template v-if="props.section !== 'mine'">
      <!-- Each request tab shows the same reusable growing-tree indicator. -->
      <Loading v-if="loading" label="Loading your plants…" />
      <CareRequestForm
        v-else
        :key="formVersion"
        :plants="plants"
        :available-balance="auth.user?.availableTokenBalance ?? auth.user?.tokenBalance ?? 0"
        :saving="saving"
        @create-request="createRequest"
      />
    </template>

    <section v-if="props.section !== 'create'" class="requests-list">
      <h2 v-if="props.section === 'all'">My requests</h2>
      <Loading v-if="loading" label="Loading requests…" />
      <p v-else-if="!owned.length">You haven’t posted a request yet.</p>
      <template v-else>
        <PlantHealthPanel :requests="owned" @seen="markHealthSeen" />

        <p v-if="!shown.length" class="empty">No {{ filter }} requests.</p>
        <div v-if="shown.length" class="request-grid">
          <CareRequestCard
            v-for="request in shown"
            :key="request.requestId"
            :request="request"
            :busy="cancellingRequestId === request.requestId"
            :makeup-busy-visit-id="makeupBusyVisitId"
            @cancel-request="cancelRequest"
            @makeup-request="requestMakeup"
          />
        </div>

      </template>
    </section>
  </main>
</template>

<style scoped>
/* (Carolyn) width and title match the Community page (was max-width 1100px, padding 0 1rem) */
.care-page { max-width: 1160px; margin: 0 auto; padding: 0 0 3rem; }
.page-heading { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 0.75rem 1rem; margin-bottom: 1.25rem; }
h1 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 700; letter-spacing: -0.04em; }
.panel { padding: 1.25rem; margin-bottom: 1rem; border: 1px solid var(--color-border, #dce5dc); border-radius: 12px; background: var(--surface, #fff); }
.panel h2 { margin-bottom: 1rem; font-size: 1.2rem; }
.requests-list h2 { margin-bottom: 1rem; font-size: 1.2rem; }
.requests-list { margin-top: 1rem; }
.mine-page .request-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 1rem; align-items: start; }
.empty { color: #59665c; }

.page-heading p { margin: 0; }
.page-heading .btn:active { transform: scale(0.96); }
.back-link { display: inline-block; margin-bottom: 0.5rem; color: #245b34; font-weight: 600; text-decoration: none; }
.back-link:hover { text-decoration: underline; }

/* filter pills */
.pills { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
.pill { padding: 0.35rem 0.9rem; border: 1px solid #dce5dc; border-radius: 999px; background: #fff; color: #59665c; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background-color 0.18s ease, color 0.18s ease; }
.pill b { margin-left: 0.35rem; color: #1f2d24; }
.pill:hover { background: #f0f8f1; }
.pill.on { border-color: #245b34; background: #245b34; color: #fff; }
.pill.on b { color: #fff; }
.pill:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) { .pill { transition: none; } }
</style>
