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
import InteractiveBarChart from '../components/dashboard/InteractiveBarChart.vue'
import BadgeCard from '../components/dashboard/BadgeCard.vue'

// ref() reactive state — covered in WAD2 wk4/wk5
// Preview data allows frontend development before backend is ready
const userData = ref({
  name: "Tan Jun Jie (Demo User)",
  // [NOT IN WAD2 CONTENT] — DiceBear avatar API URL (external service)
  avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=junjie",
  neighbourhood: "Bishan",
  availableTokens: 145,
  tokensEarnedTotal: 180,
  tokensSpentTotal: 35,
  ratingAverage: 4.9,
  ratingCount: 14,
})

const stats = ref({
  totalPlantsOwned: 3,
  careRequestsPosted: 2,
  visitsCompleted: 3,
  plantsCaredFor: 10,
})

const badges = ref([
  { id: "first_sit", name: "First Sit", description: "Completed your first plant sitting visit!", unlocked: true, progress: 100, icon: "🌱" },
  { id: "ten_plants_saved", name: "10 Plants Saved", description: "Successfully watered and cared for 10 plants.", unlocked: true, progress: 100, icon: "🌿" },
  { id: "rainy_day_hero", name: "Rainy Day Hero", description: "Cared for corridor plants during an active weather alert.", unlocked: true, progress: 100, icon: "🌧️" },
])

// Chart data shape expected by vue-chartjs Bar component [NOT IN WAD2 CONTENT]
const activityChartData = ref({
  labels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
  datasets: [
    { label: "Visits Completed (Helper)", backgroundColor: "#0ea5e9", borderRadius: 6, data: [1, 2, 4, 5, 3, 2] },
    { label: "Requests Posted (Owner)", backgroundColor: "#8b5cf6", borderRadius: 6, data: [2, 1, 3, 2, 1, 2] },
  ],
})

const tokenChartData = ref({
  labels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
  datasets: [
    { label: "Tokens Earned", backgroundColor: "#22c55e", borderRadius: 6, data: [20, 30, 45, 50, 35, 25] },
    { label: "Tokens Spent", backgroundColor: "#f59e0b", borderRadius: 6, data: [15, 20, 10, 15, 10, 5] },
  ],
})

// computed() — covered in WAD2 wk4/wk5
const timeOfDay = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
})

// async/await + axios.get() — covered in WAD2 wk5 (Express + Axios)
async function fetchDashboard() {
  try {
    const leadRes = await axios.get('http://localhost:8000/api/leaderboard')
    if (leadRes.data.leaderboard && leadRes.data.leaderboard.length > 0) {
      const demoUserId = leadRes.data.leaderboard[0].id

      const statsRes = await axios.get(`http://localhost:8000/api/dashboard/stats/${demoUserId}`)
      userData.value = statsRes.data.user
      stats.value = statsRes.data.stats
      badges.value = statsRes.data.badges

      const chartRes = await axios.get(`http://localhost:8000/api/dashboard/charts/${demoUserId}`)
      activityChartData.value = chartRes.data.activityChart
      tokenChartData.value = chartRes.data.tokenFlowChart
    }
  } catch (err) {
    // Backend not running yet — keep rich preview data shown above
    console.info('Backend not active yet; showing frontend preview data.')
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
}

.stat-icon {
  font-size: 1.75rem;
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
