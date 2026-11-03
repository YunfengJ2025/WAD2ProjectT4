<template>
  <!-- anim-fade-in = CSS animation class from main.css [NOT IN WAD2 CONTENT] -->
  <div class="dashboard-page anim-fade-in">
    <main class="content">
      <!-- HEADER -->
      <!-- anim-slide-up = CSS animation class [NOT IN WAD2 CONTENT] -->
      <header class="page-header anim-slide-up">
        <div>
          <!-- {{ }} template interpolation — covered in WAD2 wk4 -->
          <p class="greeting">Good {{ timeOfDay }}, <strong>{{ userData.name || 'Plant Pal' }}</strong> 👋</p>
          <h1>My Green Space</h1>
          <p class="subtitle">📍 {{ userData.neighbourhood }} | Active Community Caregiver</p>
        </div>

        <div class="header-ctas">
          <!-- token-pill & anim-bounce-in = custom CSS classes from main.css [NOT IN WAD2 CONTENT] -->
          <div class="token-pill anim-bounce-in" :title="`Total: ${userData.tokenBalance || userData.availableTokens || 0} tokens · Available: ${userData.availableTokenBalance ?? (userData.availableTokens || 0)} · Frozen: ${userData.frozenTokenBalance || 0}`">
            <span class="coin">🪙</span>
            <span class="amount">{{ userData.tokenBalance || userData.availableTokens || 0 }}</span>
            <span class="token-tag">Tokens</span>
            <span v-if="userData.frozenTokenBalance > 0" class="token-breakdown">
              ({{ userData.availableTokenBalance ?? 0 }} Avail · {{ userData.frozenTokenBalance }} Frozen)
            </span>
          </div>
          <!-- <router-link> — covered in WAD2 wk6 (Vue Router) -->
          <router-link to="/leaderboard" class="btn btn-primary btn-sm">🏆 View Leaderboard</router-link>
        </div>
      </header>

      <!-- STATS ROW -->
      <!-- CSS Grid layout — not explicitly covered in WAD2 (Bootstrap grid taught in wk3 instead) -->
      <div class="stats-row">
        <!-- glass-card = glassmorphism CSS class [NOT IN WAD2 CONTENT] -->
        <div class="stat-card glass-card anim-slide-up anim-delay-1">
          <span class="stat-icon">🌱</span>
          <div>
            <!-- || 0 fallback — basic JS short-circuit, WAD2 wk4+ -->
            <div class="stat-val">{{ stats.totalPlantsOwned || 0 }}</div>
            <div class="stat-label">Total Plants Owned</div>
          </div>
        </div>

        <div class="stat-card glass-card anim-slide-up anim-delay-2">
          <span class="stat-icon">📋</span>
          <div>
            <div class="stat-val">{{ stats.careRequestsPosted || 0 }}</div>
            <div class="stat-label">Total Requests Posted</div>
          </div>
        </div>

        <div class="stat-card glass-card anim-slide-up anim-delay-3">
          <span class="stat-icon">🤝</span>
          <div>
            <div class="stat-val">{{ stats.visitsCompleted || 0 }}</div>
            <div class="stat-label">Total Visits as Helper</div>
          </div>
        </div>

        <div class="stat-card glass-card anim-slide-up anim-delay-4">
          <span class="stat-icon">⭐</span>
          <div>
            <!-- .toFixed(1) — JavaScript number formatting, not WAD2-specific -->
            <div class="stat-val">{{ userData.ratingAverage ? Number(userData.ratingAverage).toFixed(1) : '5.0' }}</div>
            <div class="stat-label">Helper Rating</div>
          </div>
        </div>
      </div>

      <!-- CHARTS ROW -->
      <div class="charts-row">
        <div class="chart-card glass-card anim-slide-up anim-delay-2">
          <div class="chart-header">
            <h3 class="chart-title">📋 Activity Over Time</h3>
            <span class="badge badge-accepted">Live Visits</span>
          </div>
          <!--
            <InteractiveBarChart> — custom component using chart.js/vue-chartjs
            [NOT IN WAD2 CONTENT] — third-party charting library, not in weekly notes.
            Covered concepts: component import & usage with :prop binding (WAD2 wk6)
          -->
          <InteractiveBarChart :chartData="activityChartData" />
        </div>

        <div class="chart-card glass-card anim-slide-up anim-delay-3">
          <div class="chart-header">
            <h3 class="chart-title">🪙 Token Flow (Earned vs Spent)</h3>
            <span class="badge badge-done">Balance Logs</span>
          </div>
          <InteractiveBarChart :chartData="tokenChartData" />
        </div>
      </div>

      <!-- MILESTONE BADGES SECTION -->
      <section class="section glass-card anim-slide-up anim-delay-4">
        <div class="section-header">
          <h2>🏅 Milestone Badges</h2>
          <span class="badge badge-progress">Community Achievements</span>
        </div>
        <p class="section-sub">Unlock milestone badges by completing plant care visits</p>
        <div class="badges-grid">
          <!--
            v-for with :key — covered in WAD2 wk4 (Vue Basics I)
            :badge prop binding — covered in WAD2 wk6 (Vue Components, defineProps)
          -->
          <BadgeCard v-for="badge in badges" :key="badge.id" :badge="badge" />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
// ref, computed, onMounted — covered in WAD2 wk4/wk5 (Vue Basics)
import { ref, computed, onMounted } from 'vue'

// axios — covered in WAD2 wk5 (server/client communication)
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

// useAuthStore() is a Pinia store — a global reactive state manager [NOT IN WAD2 CONTENT]
// It holds the currently logged-in user's data (userId, name, tokens, etc.)
// across all components without prop-drilling. WAD2 wk6 introduces Vuex/Pinia conceptually.
const auth = useAuthStore()

// Component imports — covered in WAD2 wk6 (<script setup> imports)
// These are locally registered child components — they do NOT need app.component() registration
// because <script setup> automatically makes imported components available in the template.
import InteractiveBarChart from '../../components/dashboard/InteractiveBarChart.vue'
import BadgeCard from '../../components/dashboard/BadgeCard.vue'

// ref() reactive state — covered in WAD2 wk4/wk5
// We initialise userData and stats with empty/zero defaults so Vue never tries to
// render {{ undefined }} while waiting for the API. Without defaults, accessing
// userData.name before the API responds would throw "Cannot read property of null".
const userData = ref({
  name: "",
  avatarUrl: "",
  neighbourhood: "",
  availableTokens: 0,
  tokensEarnedTotal: 0,
  tokensSpentTotal: 0,
  ratingAverage: 5.0,
  ratingCount: 0,
})

const stats = ref({
  totalPlantsOwned: 0,
  careRequestsPosted: 0,
  visitsCompleted: 0,
  plantsCaredFor: 0,
})

// badges starts as [] so v-for renders nothing (empty grid) until data arrives.
const badges = ref([])

// activityChartData and tokenChartData start as null — NOT empty {}.
// <InteractiveBarChart> uses v-if="chartData && chartData.labels" to guard rendering.
// null = spinner shows; {} = Chart.js tries to render with missing data and crashes.
const activityChartData = ref(null)
const tokenChartData = ref(null)

// computed() — covered in WAD2 wk4/wk5
// Reads the current hour once at mount time and returns a greeting string.
// Using computed() instead of a plain variable means Vue memoises the result —
// it won't recompute every render if the hour hasn't changed.
const timeOfDay = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
})

// async/await + axios.get() — covered in WAD2 wk5 (Express + Axios)
// We chain three sequential API calls:
// 1. GET /api/leaderboard   — to resolve the logged-in user's userId
// 2. GET /api/dashboard/stats/:id — returns stats, user object, and badge array
// 3. GET /api/dashboard/charts/:id — returns 6-month activity & token datasets
// All three are awaited so data flows in order: no chart rendering before userId is known.
async function fetchDashboard() {
  try {
    const leadRes = await axios.get('http://localhost:8000/api/leaderboard')
    // Optional chaining (?.) — modern JS, not WAD2-specific.
    // Safely reads nested properties without throwing if auth.user is null.
    const activeUserId = auth.user?.userId || auth.user?.id || (leadRes.data?.leaderboard?.[0]?.id)
    if (activeUserId) {
      const statsRes = await axios.get(`http://localhost:8000/api/dashboard/stats/${activeUserId}`)
      userData.value = statsRes.data.user
      stats.value = statsRes.data.stats
      badges.value = statsRes.data.badges

      const chartRes = await axios.get(`http://localhost:8000/api/dashboard/charts/${activeUserId}`)
      activityChartData.value = chartRes.data.activityChart
      tokenChartData.value = chartRes.data.tokenFlowChart
    }
  } catch (err) {
    console.error('Failed to fetch dashboard data from server:', err)
  }
}

// onMounted() lifecycle hook — covered in WAD2 wk5 (Vue lifecycle)
// Fires once after the component's DOM is inserted into the page.
// We call fetchDashboard() here rather than at the top level so that
// the API call only runs when this component is actually rendered, not on import.
onMounted(() => {
  fetchDashboard()
})
</script>

<style scoped>
/* scoped styles — Vue SFC structure shown in WAD2 wk6 */

.dashboard-page {
  min-height: 100vh;
  padding-bottom: var(--space-2xl); /* CSS custom property [NOT IN WAD2 CONTENT] */
}

.content {
  padding: 0 var(--space-xl);
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: var(--space-md);
}

.greeting {
  color: var(--color-neutral-500);
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.page-header h1 {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-primary-900);
  margin: 0;
  letter-spacing: -0.03em;
}

.subtitle {
  margin: 4px 0 0;
  color: var(--color-neutral-500);
  font-size: 0.88rem;
}

.header-ctas {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.token-pill {
  padding: 6px 14px;
  font-size: 0.9rem;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.token-pill:hover {
  transform: scale(1.05);
}

.token-tag {
  font-size: 0.72rem;
  text-transform: uppercase;
  color: #78350f;
  margin-left: 2px;
}

.token-breakdown {
  font-size: 0.74rem;
  font-weight: 600;
  color: #92400e;
  background: rgba(245, 158, 11, 0.18);
  padding: 2px 7px;
  border-radius: 12px;
  margin-left: 4px;
}

/* CSS Grid — [NOT IN WAD2 CONTENT] WAD2 wk3 teaches Bootstrap grid, not CSS Grid */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  transition: transform var(--transition-bounce), box-shadow var(--transition-base), border-color var(--transition-base); /* [NOT IN WAD2 CONTENT] */
}

.stat-card:hover {
  transform: translateY(-5px) scale(1.02); /* [NOT IN WAD2 CONTENT] */
  box-shadow: 0 16px 32px rgba(34, 197, 94, 0.12);
  border-color: rgba(74, 222, 128, 0.5);
}

.stat-card:hover .stat-icon {
  transform: scale(1.18) rotate(6deg); /* [NOT IN WAD2 CONTENT] */
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.stat-icon {
  font-size: 1.75rem;
  transition: transform 0.3s ease;
}

.stat-val {
  font-family: var(--font-heading);
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--color-primary-900);
  line-height: 1;
  animation: countUp 0.5s ease-out; /* [NOT IN WAD2 CONTENT] — CSS animation */
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-neutral-400);
  font-weight: 600;
  margin-top: 4px;
}

/* CSS Grid — [NOT IN WAD2 CONTENT] */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
}

.chart-card {
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base); /* [NOT IN WAD2 CONTENT] */
}

.chart-card:hover {
  transform: translateY(-4px); /* [NOT IN WAD2 CONTENT] */
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.07);
  border-color: rgba(255, 255, 255, 0.9);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.chart-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-800);
  margin: 0;
}

.section.glass-card {
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header h2 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--color-primary-900);
  margin: 0;
}

.section-sub {
  font-size: 0.85rem;
  color: var(--color-neutral-500);
  margin: 4px 0 var(--space-lg);
}

/* CSS Grid with auto-fit/minmax — [NOT IN WAD2 CONTENT] */
.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
}

/* Responsive media queries — covered in WAD2 wk3 (Bootstrap breakpoints concept) */
@media (max-width: 1400px) {
  .stats-row {
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-sm);
  }
  .stat-card {
    padding: var(--space-sm) var(--space-md);
  }
}

@media (max-width: 1200px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts-row {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }
}

@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts-row {
    grid-template-columns: 1fr;
  }
  .badges-grid {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
}

@media (max-width: 768px) {
  .content {
    padding: 0 var(--space-md);
  }
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-md);
  }
  .page-header h1 {
    font-size: 2rem;
  }
  .header-ctas {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .token-pill {
    max-width: 100%;
    flex-wrap: wrap;
    padding: 5px 10px;
    font-size: 0.85rem;
  }
  .token-breakdown {
    display: inline-block;
    margin-top: 2px;
  }
  .chart-card {
    padding: var(--space-md);
  }
  .section.glass-card {
    padding: var(--space-lg) var(--space-md);
  }
}

@media (max-width: 640px) {
  .content {
    padding: 0 var(--space-sm);
  }
  .page-header h1 {
    font-size: 1.65rem;
  }
  .subtitle {
    font-size: 0.8rem;
  }
  .header-ctas {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-xs);
  }
  .header-ctas .btn {
    text-align: center;
    width: 100%;
  }
  .stats-row {
    grid-template-columns: 1fr;
    gap: var(--space-xs);
  }
  .stat-card {
    padding: var(--space-sm) var(--space-md);
  }
  .stat-val {
    font-size: 1.35rem;
  }
  .badges-grid {
    grid-template-columns: 1fr;
    gap: var(--space-xs);
  }
  .section.glass-card {
    padding: var(--space-md) var(--space-sm);
  }
  .section-header h2 {
    font-size: 1.05rem;
  }
  .section-sub {
    font-size: 0.78rem;
    margin-bottom: var(--space-sm);
  }
}

@media (max-width: 380px) {
  .stat-card {
    padding: var(--space-xs) var(--space-sm);
  }
  .stat-icon {
    font-size: 1.4rem;
  }
  .token-pill {
    font-size: 0.78rem;
  }
}
</style>
