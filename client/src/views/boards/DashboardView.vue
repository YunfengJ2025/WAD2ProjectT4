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
          <div class="token-pill anim-bounce-in">
            <span class="coin">🪙</span>
            <span class="amount">{{ userData.availableTokens || 0 }}</span>
            <span class="token-tag">Tokens</span>
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
            <div class="stat-label">Plants Owned</div>
          </div>
        </div>

        <div class="stat-card glass-card anim-slide-up anim-delay-2">
          <span class="stat-icon">📋</span>
          <div>
            <div class="stat-val">{{ stats.careRequestsPosted || 0 }}</div>
            <div class="stat-label">Requests Posted</div>
          </div>
        </div>

        <div class="stat-card glass-card anim-slide-up anim-delay-3">
          <span class="stat-icon">🤝</span>
          <div>
            <div class="stat-val">{{ stats.visitsCompleted || 0 }}</div>
            <div class="stat-label">Visits as Helper</div>
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
        <p class="section-sub">Unlock milestone badges by completing plant care visits for corridor &amp; balcony plants</p>
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

// Component imports — covered in WAD2 wk6 (<script setup> imports)
import InteractiveBarChart from '../../components/dashboard/InteractiveBarChart.vue'
import BadgeCard from '../../components/dashboard/BadgeCard.vue'

// ref() reactive state — covered in WAD2 wk4/wk5
// Initial empty state before fetching live data from MongoDB via backend API.
// Setting default object properties prevents Vue runtime errors (e.g. Cannot read property of null)
// while waiting for axios.get() to respond.
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

// Empty badges list populated dynamically from GET /api/dashboard/stats/:userId
const badges = ref([])

// Chart data starts as null so <InteractiveBarChart> displays its clean loading spinner
// until live data arrives from GET /api/dashboard/charts/:userId
const activityChartData = ref(null)
const tokenChartData = ref(null)

// computed() — covered in WAD2 wk4/wk5
const timeOfDay = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
})

// async/await + axios.get() — covered in WAD2 wk5 (Express + Axios)
// Fetches live user statistics, badges, and chart metrics from the backend API
async function fetchDashboard() {
  try {
    const leadRes = await axios.get('http://localhost:8000/api/leaderboard')
    if (leadRes.data.leaderboard && leadRes.data.leaderboard.length > 0) {
      // Pick the primary demo user ID from the leaderboard response
      const demoUserId = leadRes.data.leaderboard[0].id

      // Fetch user profile metrics and milestone badges
      const statsRes = await axios.get(`http://localhost:8000/api/dashboard/stats/${demoUserId}`)
      userData.value = statsRes.data.user
      stats.value = statsRes.data.stats
      badges.value = statsRes.data.badges

      // Fetch monthly visualisations data for Chart.js
      const chartRes = await axios.get(`http://localhost:8000/api/dashboard/charts/${demoUserId}`)
      activityChartData.value = chartRes.data.activityChart
      tokenChartData.value = chartRes.data.tokenFlowChart
    }
  } catch (err) {
    console.error('Failed to fetch dashboard data from server:', err)
  }
}

// onMounted() lifecycle hook — covered in WAD2 wk5 (Vue lifecycle)
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
}

.token-pill:hover {
  transform: scale(1.08);
}

.token-tag {
  font-size: 0.72rem;
  text-transform: uppercase;
  color: #78350f;
  margin-left: 2px;
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
@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .content {
    padding: 0 var(--space-md);
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .stats-row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
