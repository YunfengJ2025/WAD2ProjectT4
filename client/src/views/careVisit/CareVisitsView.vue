<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AssignedVisitCard from '@/components/careVisit/AssignedVisitCard.vue'
import AvailableVisitCard from '@/components/careVisit/AvailableVisitCard.vue'
import VisitHistoryCard from '@/components/careVisit/VisitHistoryCard.vue'

const auth = useAuthStore()
const availableVisits = ref([])
const assignments = ref([])
const history = ref([])
const paidVisitIds = ref([])
const loading = ref(true)
const error = ref('')
const message = ref('')
const submittingVisitId = ref(0)
const acceptingVisitId = ref(0)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [available, active, past, transactions] = await Promise.all([
      auth.authorizedRequest('/care-visits/available'),
      auth.authorizedRequest('/care-visits/assignments'),
      auth.authorizedRequest('/care-visits'),
      auth.authorizedRequest(`/token/user/${auth.user.userId}`),
      auth.refreshUser(),
    ])
    availableVisits.value = available.visits
    assignments.value = active.visits
    history.value = past.visits
    paidVisitIds.value = transactions
      .filter((transaction) => transaction.type === 'CARE' && transaction.balanceApplied)
      .map((transaction) => transaction.visitId)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function acceptVisit(visit) {
  acceptingVisitId.value = visit.visitId
  error.value = ''
  message.value = ''
  try {
    await auth.authorizedRequest(`/care-visits/${visit.visitId}/accept`, { method: 'POST' })
    message.value = `You accepted the visit for ${visit.plants?.length || 1} plant${(visit.plants?.length || 1) === 1 ? '' : 's'}.`
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    acceptingVisitId.value = 0
  }
}

async function awardReward(visitId) {
  const reward = await auth.authorizedRequest('/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'CARE', visitId }),
  })
  return reward.transaction.amount
}

async function claimReward(visit) {
  if (submittingVisitId.value) return
  submittingVisitId.value = visit.visitId
  error.value = ''
  message.value = ''
  try {
    const amount = await awardReward(visit.visitId)
    message.value = `${amount} tokens awarded for visit #${visit.visitId}.`
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    submittingVisitId.value = 0
  }
}

async function submitVisitProof(details) {
  if (submittingVisitId.value) return
  const { visit, actions, photos } = details
  const body = new FormData()
  body.append('actions', JSON.stringify(actions))
  for (const [plantId, photo] of Object.entries(photos)) body.append(`photo_${plantId}`, photo)
  submittingVisitId.value = visit.visitId
  error.value = ''
  message.value = ''
  try {
    const result = await auth.authorizedRequest(`/care-visits/${visit.visitId}/proof`, {
      method: 'POST',
      body,
    })
    message.value = `Visit #${result.visit.visitId} saved with photo proof.`
    let rewardError = ''
    try {
      const amount = await awardReward(result.visit.visitId)
      message.value += ` ${amount} tokens awarded.`
    } catch (err) {
      rewardError = `Your photo proof was saved, but the token reward could not be awarded: ${err.message}`
    }
    await load()
    if (rewardError) error.value = rewardError
  } catch (err) {
    error.value = err.message
  } finally {
    submittingVisitId.value = 0
  }
}
</script>

<template>
  <main class="visits-page">
    <header class="page-heading">
      <h1>My sits</h1>
      <p>Complete the visits you accepted and upload a photo as proof.</p>
    </header>
    <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
    <p v-if="message" class="alert alert-success" role="status">{{ message }}</p>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Available visits</h2>
          <p>Choose a visit that fits your schedule.</p>
        </div>
        <span class="count">{{ availableVisits.length }} open</span>
      </div>
      <p v-if="loading" role="status">Loading available visits…</p>
      <p v-else-if="!availableVisits.length">No open visits right now. Check back later.</p>
      <div v-else class="available-list">
        <AvailableVisitCard
          v-for="visit in availableVisits"
          :key="visit.visitId"
          :visit="visit"
          :busy="acceptingVisitId === visit.visitId"
          @accept-visit="acceptVisit"
        />
      </div>
    </section>

    <section class="panel">
      <h2>Accepted visits</h2>
      <p v-if="loading" role="status">Loading visits…</p>
      <p v-else-if="!assignments.length">You have no accepted visits yet. Browse the available visits above.</p>
      <AssignedVisitCard
        v-for="visit in assignments"
        :key="visit.visitId"
        :visit="visit"
        :busy="submittingVisitId === visit.visitId"
        @submit-proof="submitVisitProof"
      />
    </section>

    <section class="panel">
      <h2>Visit history</h2>
      <p v-if="loading" role="status">Loading history…</p>
      <p v-else-if="!history.length">No visits submitted yet.</p>
      <VisitHistoryCard
        v-for="visit in history"
        :key="visit.visitId"
        :visit="visit"
        :paid="paidVisitIds.includes(visit.visitId)"
        :busy="submittingVisitId === visit.visitId"
        @claim-reward="claimReward"
      />
    </section>
  </main>
</template>

<style scoped>
.visits-page { max-width: 900px; margin: 0 auto; padding: 0 1rem 3rem; }
.page-heading { margin-bottom: 1.25rem; }
h1 { font-weight: 700; }
.panel { padding: 1.25rem; margin-bottom: 1rem; border: 1px solid var(--color-border, #dce5dc); border-radius: 12px; background: var(--surface, #fff); }
.panel h2 { margin-bottom: 1rem; font-size: 1.2rem; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.panel-heading h2 { margin-bottom: 0.2rem; }
.panel-heading p { margin: 0; color: #637466; }
.count { padding: 0.25rem 0.65rem; border-radius: 999px; background: #e7f3e9; color: #28623a; font-size: 0.83rem; font-weight: 700; white-space: nowrap; }
.available-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.85rem; margin-top: 1rem; }
</style>
