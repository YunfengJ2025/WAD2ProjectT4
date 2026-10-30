<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const assignments = ref([])
const history = ref([])
const files = ref({})
const actions = ref({})
const loading = ref(true)
const error = ref('')
const message = ref('')
const submitting = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [active, past] = await Promise.all([
      auth.authorizedRequest('/care-visits/assignments'),
      auth.authorizedRequest('/care-visits'),
    ])
    assignments.value = active.visits
    history.value = past.visits
  } catch (err) { error.value = err.message } finally { loading.value = false }
}
onMounted(load)

function setFile(requestId, event) {
  files.value[requestId] = event.target.files?.[0] || null
}

async function submitVisit(visit) {
  error.value = ''
  message.value = ''
  const file = files.value[visit.visitId]
  if (!file) { error.value = 'Choose a photo as proof of visit.'; return }
  if (!actions.value[visit.visitId]?.trim()) { error.value = 'Describe what you did during the visit.'; return }
  const body = new FormData()
  body.append('photo', file)
  body.append('action', actions.value[visit.visitId].trim())
  submitting.value = String(visit.visitId)
  try {
    const result = await auth.authorizedRequest(`/care-visits/${visit.visitId}/proof`, { method: 'POST', body })
    message.value = `Visit #${result.visit.visitId} saved with photo proof.`
    files.value[visit.visitId] = null
    actions.value[visit.visitId] = ''
    await load()
  } catch (err) { error.value = err.message } finally { submitting.value = '' }
}

const date = (value) => new Date(value).toLocaleString('en-GB')
</script>

<template>
  <main class="visits-page">
    <header><h1>Care visits</h1><p>Log each visit for a request you accepted. Every visit needs an action and photo proof.</p></header>
    <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
    <p v-if="message" class="alert alert-success" role="status">{{ message }}</p>
    <section class="panel"><h2>Your accepted requests</h2>
      <p v-if="loading">Loading assignments…</p><p v-else-if="!assignments.length">You have no active requests. Find one in Care Requests.</p>
      <article v-for="visit in assignments" :key="visit.visitId" class="assignment">
        <div class="request-head"><div><h3>{{ visit.plant?.plantName || 'Plant' }}</h3><p>{{ new Date(visit.visitDate).toLocaleDateString('en-GB') }} · {{ visit.request?.tokenReward }} tokens</p></div><span class="status">{{ visit.status }}</span></div>
        <p v-if="visit.request?.note">{{ visit.request.note }}</p>
        <form class="visit-form" @submit.prevent="submitVisit(visit)">
          <label>Action completed<input v-model="actions[visit.visitId]" maxlength="100" required placeholder="e.g. Watered the plant and checked the soil" /></label>
          <label>Proof photo<input type="file" accept="image/jpeg,image/png,image/webp" required @change="setFile(visit.visitId, $event)" /><small>JPG, PNG or WebP, up to 2 MB.</small></label>
          <button class="btn btn-primary" :disabled="submitting === String(visit.visitId)">{{ submitting === String(visit.visitId) ? 'Saving…' : 'Submit visit proof' }}</button>
        </form>
      </article>
    </section>
    <section class="panel"><h2>Visit history</h2>
      <p v-if="!loading && !history.length">No visits submitted yet.</p>
      <ul class="visit-list"><li v-for="visit in history" :key="visit.visitId"><span>{{ visit.plant?.plantName }} · {{ date(visit.visitDate) }} · {{ visit.action }}</span><a v-if="visit.proofUrl" :href="visit.proofUrl" target="_blank" rel="noopener noreferrer">View proof</a></li></ul>
    </section>
  </main>
</template>

<style scoped>
.visits-page{max-width:900px;margin:0 auto;padding:0 1rem 3rem}header{margin-bottom:1.25rem}h1{font-weight:700}.panel{background:var(--surface,#fff);border:1px solid var(--color-border,#dce5dc);border-radius:12px;padding:1.25rem;margin-bottom:1rem}.panel h2{font-size:1.2rem;margin-bottom:1rem}.assignment{border-top:1px solid #e2e8e2;padding:1rem 0}.request-head{display:flex;justify-content:space-between;gap:1rem}.request-head h3{font-size:1.05rem;margin:0}.request-head p,.assignment>p{color:#59665c;margin:.3rem 0}.status{align-self:start;text-transform:capitalize;background:#e8f3e9;color:#2d6740;padding:.2rem .6rem;border-radius:999px;font-size:.8rem}.visits-count{font-weight:600}.visit-form{display:grid;gap:.8rem;margin:1rem 0}.visit-form label{display:grid;gap:.35rem;font-weight:600}.visit-form input:not([type=file]){padding:.55rem;border:1px solid #b9c7bb;border-radius:7px;font:inherit}.visit-form small{font-weight:400;color:#68766b}.visit-form button{justify-self:start}.visit-list{list-style:none;padding:0;margin:.75rem 0 0}.visit-list li{display:flex;justify-content:space-between;gap:1rem;border-top:1px solid #edf0ed;padding:.55rem 0}.visit-list a{white-space:nowrap}
</style>
