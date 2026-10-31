<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePlantsStore } from '@/stores/plants'
import TokenBalance from '@/components/token/TokenBalance.vue'
import CareRequestForm from '@/components/careRequest/CareRequestForm.vue'
import CareRequestCard from '@/components/careRequest/CareRequestCard.vue'

const auth = useAuthStore()
const plantsStore = usePlantsStore()
const plants = computed(() => plantsStore.plants)
const owned = ref([])
const loading = ref(true)
const saving = ref(false)
const cancellingRequestId = ref(0)
const formVersion = ref(0)
const error = ref('')
const notice = ref('')

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
</script>

<template>
  <main class="care-page">
    <header class="page-heading">
      <h1>Care requests</h1>
      <p>Choose one or more of your plants and create a care request for them.</p>
    </header>

    <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
    <p v-if="notice" class="alert alert-success" role="status">{{ notice }}</p>

    <section class="panel">
      <h2>Your tokens</h2>
      <TokenBalance />
    </section>

    <p v-if="loading" role="status">Loading your plants…</p>
    <CareRequestForm
      v-else
      :key="formVersion"
      :plants="plants"
      :available-balance="auth.user?.availableTokenBalance ?? auth.user?.tokenBalance ?? 0"
      :saving="saving"
      @create-request="createRequest"
    />

    <section class="panel requests-list">
      <h2>My requests</h2>
      <p v-if="loading" role="status">Loading requests…</p>
      <p v-else-if="!owned.length">You haven’t posted a request yet.</p>
      <CareRequestCard
        v-for="request in owned"
        :key="request.requestId"
        :request="request"
        :busy="cancellingRequestId === request.requestId"
        @cancel-request="cancelRequest"
      />
    </section>
  </main>
</template>

<style scoped>
.care-page { max-width: 1100px; margin: 0 auto; padding: 0 1rem 3rem; }
.page-heading { margin-bottom: 1.25rem; }
h1 { font-weight: 700; }
.panel { padding: 1.25rem; margin-bottom: 1rem; border: 1px solid var(--color-border, #dce5dc); border-radius: 12px; background: var(--surface, #fff); }
.panel h2 { margin-bottom: 1rem; font-size: 1.2rem; }
.requests-list { margin-top: 1rem; }
</style>
