<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import plantPlaceholder from '@/assets/plant.png'

// Shows the plant health results from the owner's requests: a panel, and an advice pop-up for one result.
//   <PlantHealthPanel :requests="owned" @seen="markHealthSeen" />
const props = defineProps({
  requests: { type: Array, default: () => [] }, // the owner's requests, each with visits -> items -> health
})
// the owner opened a result they had not seen yet; the parent saves that
const emit = defineEmits(['seen'])

const VISIBLE = 4 // rows shown before "Show more"
const showAll = ref(false)

const isSick = (entry) => entry.check.isHealthy === false

// The newest finished result for each plant, plus the request and visit it came from.
const entries = computed(() => {
  const latest = new Map()
  for (const request of props.requests)
    for (const visit of request.visits || [])
      for (const item of visit.items || []) {
        const check = item.health
        if (check?.status !== 'completed') continue // failed checks are not shown here
        const entry = {
          check,
          plantName: item.plant?.plantName || 'Plant',
          plantPhoto: item.plant?.photoUrl || '',
          proofUrl: item.proofUrl || '',
          visitId: visit.visitId,
          visitDate: visit.visitDate,
          requestId: request.requestId,
        }
        const known = latest.get(item.plantId)
        if (!known || new Date(check.createdAt) > new Date(known.check.createdAt)) latest.set(item.plantId, entry)
      }

  // new problems first, then problems already seen, then healthy plants (newest first within each)
  const rank = (entry) => (!isSick(entry) ? 2 : entry.check.ownerSeenAt ? 1 : 0)
  return [...latest.values()].sort(
    (a, b) => rank(a) - rank(b) || new Date(b.check.createdAt) - new Date(a.check.createdAt),
  )
})

const visibleEntries = computed(() => (showAll.value ? entries.value : entries.value.slice(0, VISIBLE)))
const issueCount = computed(() => entries.value.filter(isSick).length)
const newCount = computed(() => entries.value.filter((entry) => isSick(entry) && !entry.check.ownerSeenAt).length)
const hasMock = computed(() => entries.value.some((entry) => entry.check.provider === 'mock'))

const percent = (value) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : '')
function shortDate(value) {
  return new Date(value).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Singapore',
  })
}

// ---------- advice pop-up (the browser's own <dialog>, like ConfirmDialog) ----------
const TABS = [
  { key: 'prevention', label: 'Prevention' },
  { key: 'biological', label: 'Biological' },
  { key: 'chemical', label: 'Chemical' },
]
const selected = ref(null)
const tab = ref('')
const dialog = ref(null)

const issue = computed(() => selected.value?.check.issues?.[0] ?? null)
const otherIssues = computed(() => (selected.value?.check.issues ?? []).slice(1))
// only offer the tabs that actually have advice
const tabs = computed(() => TABS.filter(({ key }) => issue.value?.treatment?.[key]?.length))

function openAdvice(entry) {
  selected.value = entry
  tab.value = (entry.check.issues?.[0] && TABS.find(({ key }) => entry.check.issues[0].treatment?.[key]?.length)?.key) || ''
  if (!entry.check.ownerSeenAt) emit('seen', entry.check)
}

// show or hide the <dialog> to match `selected`
watch(
  selected,
  (entry) => {
    const el = dialog.value
    if (!el) return
    if (entry && !el.open) (el.showModal ? el.showModal() : el.setAttribute('open', ''))
    else if (!entry && el.open) (el.close ? el.close() : el.removeAttribute('open'))
  },
  { flush: 'post' },
)

function onBackdropClick(event) {
  if (event.target === dialog.value) selected.value = null
}
</script>

<template>
  <section v-if="entries.length" class="health" :class="{ 'has-issue': issueCount }" aria-labelledby="health-title">
    <div class="health-top">
      <span aria-hidden="true">🌿</span>
      <h2 id="health-title">Plant health</h2>
      <span v-if="newCount" class="badge-pill red">{{ newCount }} needs attention</span>
      <span v-else-if="issueCount" class="badge-pill amber">{{ issueCount }} to look after</span>
      <span v-else class="badge-pill green">All healthy</span>
      <span v-if="hasMock" class="demo">Demo result</span>
    </div>

    <div v-for="entry in visibleEntries" :key="entry.check.healthCheckId" class="hrow" :class="{ ok: !isSick(entry) }">
      <img
        class="avatar"
        :class="isSick(entry) ? 'ring' : 'okring'"
        :src="entry.plantPhoto || plantPlaceholder"
        :alt="entry.plantName"
        @error="$event.target.src = plantPlaceholder"
      />
      <div class="text">
        <b v-if="isSick(entry)">{{ entry.plantName }} · {{ entry.check.issues?.[0]?.name || 'Possible issue' }}</b>
        <b v-else>{{ entry.plantName }} · looks healthy ✓</b>
        <small v-if="isSick(entry)">
          <template v-if="entry.check.issues?.[0]">{{ percent(entry.check.issues[0].probability) }} likely · </template>found on {{ shortDate(entry.visitDate) }} · Request #{{ entry.requestId }}
        </small>
        <small v-else>
          <template v-if="percent(entry.check.healthProbability)">{{ percent(entry.check.healthProbability) }} confident · </template>{{ shortDate(entry.visitDate) }}
        </small>
      </div>
      <button v-if="isSick(entry)" type="button" class="btn-advice" @click="openAdvice(entry)">
        View advice ›
        <span v-if="!entry.check.ownerSeenAt" class="new-dot" aria-label="New"></span>
      </button>
    </div>

    <button v-if="entries.length > VISIBLE" type="button" class="more-link" @click="showAll = !showAll">
      {{ showAll ? 'Show fewer' : `Show ${entries.length - VISIBLE} more` }}
    </button>
  </section>

  <dialog ref="dialog" class="advice" aria-labelledby="advice-title" @click="onBackdropClick" @close="selected = null">
    <template v-if="selected">
      <header class="advice-head">
        <img class="avatar ring" :src="selected.plantPhoto || plantPlaceholder" :alt="selected.plantName" @error="$event.target.src = plantPlaceholder" />
        <div>
          <h3 id="advice-title">{{ selected.plantName }} · {{ issue?.name || 'Possible issue' }}</h3>
          <small>Request #{{ selected.requestId }} · {{ shortDate(selected.visitDate) }} · checked from the sitter's photo</small>
        </div>
        <button type="button" class="close" aria-label="Close" @click="selected = null">×</button>
      </header>

      <div class="advice-body">
        <div class="two-col">
          <img class="photo" :src="selected.proofUrl || selected.plantPhoto || plantPlaceholder" :alt="`${selected.plantName}, sitter's photo`" @error="$event.target.src = plantPlaceholder" />
          <div>
            <template v-if="issue">
              <div class="likelihood"><span>Likelihood</span><span>{{ percent(issue.probability) }}</span></div>
              <div class="bar"><i :style="{ width: percent(issue.probability) }"></i></div>
              <h4 v-if="issue.description">What it is</h4>
              <p v-if="issue.description">{{ issue.description }}</p>
              <h4 v-if="issue.cause">Likely cause</h4>
              <p v-if="issue.cause">{{ issue.cause }}</p>
              <p v-if="otherIssues.length" class="also">
                Also considered: {{ otherIssues.map((other) => `${other.name} (${percent(other.probability)})`).join(', ') }}
              </p>
            </template>
            <p v-else>The photo looks unhealthy, but no specific issue was identified.</p>
          </div>
        </div>

        <template v-if="tabs.length">
          <div class="seg" role="tablist" aria-label="Treatment advice">
            <button
              v-for="item in tabs"
              :key="item.key"
              type="button"
              role="tab"
              :aria-selected="tab === item.key"
              :class="{ on: tab === item.key }"
              @click="tab = item.key"
            >{{ item.label }}</button>
          </div>
          <ul>
            <li v-for="line in issue.treatment[tab]" :key="line">{{ line }}</li>
          </ul>
        </template>
        <p v-else-if="issue" class="also">No treatment advice came back for this issue.</p>
      </div>

      <footer class="advice-foot">
        <span class="disclaimer">🤖 AI suggestion, not a diagnosis<template v-if="selected.check.provider === 'mock'"> · Demo result</template></span>
        <span class="spacer"></span>
        <RouterLink class="btn-ghost" :to="{ name: 'visit-detail', params: { visitId: selected.visitId } }">View visit</RouterLink>
        <button type="button" class="btn-primary" @click="selected = null">Got it</button>
      </footer>
    </template>
  </dialog>
</template>

<style scoped>
.health { margin-bottom: 1.1rem; padding: 0.9rem 1rem; border: 1px solid #dce5dc; border-radius: 14px; background: #fff; box-shadow: 0 4px 14px #183c2410; }
.health.has-issue { border-color: #f0c9cd; background: linear-gradient(180deg, #fff7f7, #fff); }
.health-top { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; }
.health-top h2 { margin: 0; font-size: 1.05rem; }
.badge-pill { padding: 0.1rem 0.65rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
.badge-pill.red { background: #fde4e7; color: #a3212f; }
.badge-pill.amber { background: #fff3cf; color: #7a5a00; }
.badge-pill.green { background: #e6f5ea; color: #14532d; }
.demo { margin-left: auto; padding: 0.1rem 0.55rem; border: 1px dashed #b9c2bb; border-radius: 999px; color: #6c757d; font-size: 0.72rem; }

.hrow { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.25rem; }
.hrow + .hrow { border-top: 1px solid #f1e3e5; }
.hrow.ok { opacity: 0.8; }
.avatar { flex: none; width: 42px; height: 42px; border-radius: 50%; object-fit: cover; background: #e8f3e9; }
.ring { box-shadow: 0 0 0 3px #f3a6af; }
.okring { box-shadow: 0 0 0 3px #b8dfc0; }
.text { flex: 1; min-width: 0; }
.text b { display: block; }
.text small { color: #59665c; }

.btn-advice { position: relative; flex: none; padding: 0.4rem 0.85rem; border: 1px solid #245b34; border-radius: 8px; background: #245b34; color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.btn-advice:hover { background: #1d4a2b; }
.btn-advice:focus-visible, .more-link:focus-visible, .seg button:focus-visible, .close:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }
.new-dot { position: absolute; top: -4px; right: -4px; width: 11px; height: 11px; border-radius: 50%; background: #dc3545; box-shadow: 0 0 0 2px #fff; }
.more-link { margin-top: 0.35rem; padding: 0.2rem 0.25rem; border: 0; background: none; color: #2d6740; font-size: 0.85rem; font-weight: 600; cursor: pointer; }

/* ---------- advice pop-up ---------- */
.advice { width: min(640px, calc(100vw - 2rem)); margin: auto; padding: 0; border: 0; border-radius: 18px; overflow: hidden; color: #1f2d24; box-shadow: 0 20px 60px #0007; }
.advice::backdrop { background: rgba(20, 34, 25, 0.5); }
.advice-head { display: flex; align-items: center; gap: 0.85rem; padding: 1rem 1.25rem; border-bottom: 1px solid #f3d7da; background: linear-gradient(135deg, #fff1f2, #fff); }
.advice-head h3 { margin: 0; font-size: 1.2rem; }
.advice-head small { color: #59665c; }
.advice-head .avatar { width: 52px; height: 52px; }
.close { margin-left: auto; border: 0; background: none; color: #59665c; font-size: 1.6rem; line-height: 1; cursor: pointer; }
.advice-body { padding: 1.1rem 1.25rem; max-height: 60vh; overflow: auto; }
.two-col { display: grid; grid-template-columns: 190px 1fr; gap: 1rem; }
.photo { width: 100%; height: 190px; border-radius: 14px; object-fit: cover; background: #e8f3e9; }
.likelihood { display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 700; }
.bar { height: 10px; margin: 0.3rem 0 0.2rem; border-radius: 999px; background: #eee; overflow: hidden; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, #f0a03a, #dc3545); }
.advice h4 { margin: 0.8rem 0 0.2rem; font-size: 0.9rem; }
.advice p { margin: 0; color: #3d4a41; font-size: 0.9rem; line-height: 1.45; }
.also { margin-top: 0.6rem !important; color: #59665c !important; font-size: 0.8rem !important; }
.seg { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0 0.5rem; }
.seg button { padding: 0.35rem 0.8rem; border: 1px solid #e2e8e2; border-radius: 999px; background: #fff; color: #59665c; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
.seg button.on { border-color: #b8dfc0; background: #e8f3e9; color: #245b34; }
.advice ul { margin: 0; padding-left: 1.25rem; color: #3d4a41; font-size: 0.9rem; line-height: 1.6; }
.advice-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; padding: 0.85rem 1.25rem; border-top: 1px solid #e2e8e2; background: #fafcfa; }
.disclaimer { color: #59665c; font-size: 0.78rem; }
.spacer { flex: 1; }
.btn-ghost, .btn-primary { padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; text-decoration: none; cursor: pointer; }
.btn-ghost { border: 1px solid #dce5dc; background: #fff; color: #59665c; }
.btn-primary { border: 1px solid #245b34; background: #245b34; color: #fff; }

@media (max-width: 560px) {
  .two-col { grid-template-columns: 1fr; }
  .photo { height: 160px; }
}
</style>
