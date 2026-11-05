<template>
  <div class="dashboard-page anim-fade-in">
    <main class="content">
      <!-- HEADER -->
      <header class="page-header anim-slide-up">
        <div>
          <p class="greeting">Good {{ timeOfDay }}, <strong>{{ userData.name || 'Plant Pal' }}</strong> 👋</p>
          <h1>My Green Space</h1>
          <p class="subtitle">📍 {{ userData.neighbourhood }} | Active Community Caregiver</p>
        </div>

        <div class="header-ctas">
          <div class="token-pill anim-bounce-in" :title="`Total: ${userData.tokenBalance || userData.availableTokens || 0} tokens · Available: ${userData.availableTokenBalance ?? (userData.availableTokens || 0)} · Frozen: ${userData.frozenTokenBalance || 0}`">
            <span class="coin">🪙</span>
            <span class="amount">{{ userData.tokenBalance || userData.availableTokens || 0 }}</span>
            <span class="token-tag">Tokens</span>
            <span v-if="userData.frozenTokenBalance > 0" class="token-breakdown">
              ({{ userData.availableTokenBalance ?? 0 }} Avail · {{ userData.frozenTokenBalance }} Frozen)
            </span>
          </div>
          <router-link to="/leaderboard" class="btn btn-primary btn-sm btn-nav-action">
            <span class="btn-icon">🏆</span>
            <span class="btn-text">View Leaderboard</span>
          </router-link>
        </div>
      </header>

      <!-- STATS ROW -->
      <div class="stats-row">
        <div class="stat-card glass-card anim-slide-up anim-delay-1">
          <span class="stat-icon">🌱</span>
          <div>
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
          <BadgeCard v-for="badge in badges" :key="badge.id" :badge="badge" />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { apiUrl } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import InteractiveBarChart from '../../components/dashboard/InteractiveBarChart.vue'
import BadgeCard from '../../components/dashboard/BadgeCard.vue'

const auth = useAuthStore()

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

const badges = ref([])
const activityChartData = ref(null)
const tokenChartData = ref(null)

const timeOfDay = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
})

// Fetch user stats, badges, and 6-month chart datasets
async function fetchDashboard() {
  try {
    const leadRes = await axios.get(apiUrl('/leaderboard'))
    const activeUserId = auth.user?.userId || auth.user?.id || (leadRes.data?.leaderboard?.[0]?.id)
    if (activeUserId) {
      const statsRes = await axios.get(apiUrl(`/dashboard/stats/${activeUserId}`))
      userData.value = statsRes.data.user
      stats.value = statsRes.data.stats
      badges.value = statsRes.data.badges

      const chartRes = await axios.get(apiUrl(`/dashboard/charts/${activeUserId}`))
      activityChartData.value = chartRes.data.activityChart
      tokenChartData.value = chartRes.data.tokenFlowChart
    }
  } catch (err) {
    console.error('Failed to fetch dashboard data from server:', err)
  }
}

onMounted(() => {
  fetchDashboard()
})
</script>

<style scoped>
.dashboard-page {
  width: 100%;
  max-width: 100%;
  min-height: 100vh;
  padding-bottom: var(--space-2xl);
  box-sizing: border-box;
}

.content {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 0 1rem;
}

@media (min-width: 576px) {
  .content {
    padding: 0 1.5rem;
  }
}

@media (min-width: 768px) {
  .content {
    padding: 0 2rem;
  }
}

@media (min-width: 1200px) {
  .content {
    max-width: 1280px;
    padding: 0 2rem;
  }
}

@media (min-width: 1400px) {
  .content {
    max-width: 1360px;
    padding: 0 2.5rem;
  }
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: var(--space-md);
  width: 100%;
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

.btn-nav-action {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px;
  line-height: 1 !important;
  vertical-align: middle;
  padding: 8px 16px !important;
}

.btn-nav-action .btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  transform: translateY(-0.5px);
}

.btn-nav-action .btn-text {
  display: inline-block;
  line-height: 1;
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

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
  width: 100%;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  min-width: 0;
  box-sizing: border-box;
  transition: transform var(--transition-bounce), box-shadow var(--transition-base), border-color var(--transition-base);
}

.stat-card:hover {
  transform: translateY(-5px) scale(1.02);
  box-shadow: 0 16px 32px rgba(34, 197, 94, 0.12);
  border-color: rgba(74, 222, 128, 0.5);
}

.stat-card:hover .stat-icon {
  transform: scale(1.18) rotate(6deg);
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
  animation: countUp 0.5s ease-out;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-neutral-400);
  font-weight: 600;
  margin-top: 4px;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
  width: 100%;
}

.chart-card {
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base);
}

.chart-card:hover {
  transform: translateY(-4px);
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
  width: 100%;
  box-sizing: border-box;
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

.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
  width: 100%;
}

/* Responsive Breakpoints */
@media (max-width: 1399.98px) {
  .stats-row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-sm);
  }
  .stat-card {
    padding: var(--space-sm) var(--space-md);
  }
}

@media (max-width: 1199.98px) {
  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-md);
  }
  .charts-row {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }
}

@media (max-width: 991.98px) {
  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .charts-row {
    grid-template-columns: 1fr;
  }
  .badges-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
}

@media (max-width: 767.98px) {
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

@media (max-width: 575.98px) {
  .page-header h1 {
    font-size: 1.6rem;
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

@media (max-width: 379.98px) {
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
