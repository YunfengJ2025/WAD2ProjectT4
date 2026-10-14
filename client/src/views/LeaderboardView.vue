<template>
  <div class="leaderboard-page anim-fade-in">
    <main class="content">
      <!-- HEADER -->
      <header class="page-header anim-slide-up">
        <div>
          <p class="greeting">Singapore HDB Community Rankings</p>
          <h1>🏆 Community Leaderboard</h1>
          <p class="subtitle">Top plant caregivers and helpful neighbours ranked by community tokens</p>
        </div>

        <div class="opt-out-box glass-card">
          <label class="switch-label">
            <input type="checkbox" :checked="isOptedOut" @change="toggleOptOut" class="styled-checkbox" />
            <span class="switch-text">Hide my profile from Leaderboard</span>
          </label>
        </div>
      </header>

      <!-- TABS (Identical to css style reference tabs) -->
      <div class="tabs anim-slide-up anim-delay-1">
        <button
          v-for="area in areas"
          :key="area"
          class="tab-btn"
          :class="{ active: selectedArea === area }"
          @click="selectArea(area)"
        >
          {{ area }}
        </button>
      </div>

      <!-- TOP 3 PODIUM -->
      <div v-if="filteredLeaderboard.length >= 3" class="podium-section anim-slide-up anim-delay-2">
        <!-- 2nd Place -->
        <div class="podium-card glass-card silver">
          <span class="medal">🥈</span>
          <img :src="filteredLeaderboard[1].avatarUrl" alt="Avatar" class="podium-avatar" />
          <h4>{{ filteredLeaderboard[1].name }}</h4>
          <p class="podium-area">📍 {{ filteredLeaderboard[1].neighbourhood }}</p>
          <div class="token-pill">🪙 {{ filteredLeaderboard[1].availableTokens }}</div>
        </div>

        <!-- 1st Place -->
        <div class="podium-card glass-card gold">
          <span class="crown">👑</span>
          <span class="medal">🥇</span>
          <img :src="filteredLeaderboard[0].avatarUrl" alt="Avatar" class="podium-avatar top" />
          <h4>{{ filteredLeaderboard[0].name }}</h4>
          <p class="podium-area">📍 {{ filteredLeaderboard[0].neighbourhood }}</p>
          <div class="token-pill gold-pill">🪙 {{ filteredLeaderboard[0].availableTokens }}</div>
        </div>

        <!-- 3rd Place -->
        <div class="podium-card glass-card bronze">
          <span class="medal">🥉</span>
          <img :src="filteredLeaderboard[2].avatarUrl" alt="Avatar" class="podium-avatar" />
          <h4>{{ filteredLeaderboard[2].name }}</h4>
          <p class="podium-area">📍 {{ filteredLeaderboard[2].neighbourhood }}</p>
          <div class="token-pill">🪙 {{ filteredLeaderboard[2].availableTokens }}</div>
        </div>
      </div>

      <!-- LEADERBOARD CARD (Using exact lb-row styling from css style reference) -->
      <div class="leaderboard-card glass-card anim-slide-up anim-delay-3">
        <div class="lb-header-row">
          <h3 class="chart-title">Top Token Holders in {{ selectedArea === 'All' ? 'Singapore' : selectedArea }}</h3>
          <span class="badge badge-done">{{ filteredLeaderboard.length }} Neighbours Active</span>
        </div>

        <div class="lb-list">
          <div
            v-for="u in filteredLeaderboard"
            :key="u.id"
            class="lb-row"
            :class="{ 'lb-me': u.id === CURRENT_USER_ID }"
          >
            <div class="lb-rank">{{ rankMedal(u.rank) }}</div>
            <div
              class="lb-avatar"
              :style="{
                background: u.id === CURRENT_USER_ID
                  ? 'linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600))'
                  : 'linear-gradient(135deg, var(--color-neutral-400), var(--color-neutral-600))'
              }"
            >
              {{ u.name ? u.name[0] : '🌱' }}
            </div>
            <div class="lb-name">
              {{ u.name }}
              <span v-if="u.id === CURRENT_USER_ID" class="you-tag">You</span>
            </div>
            <div class="lb-area">📍 {{ u.neighbourhood }}</div>
            <div class="lb-rating">⭐ {{ u.ratingAverage ? Number(u.ratingAverage).toFixed(1) : '5.0' }}</div>
            <div class="lb-bar-wrap">
              <div
                class="lb-bar"
                :style="{
                  width: `${(u.availableTokens / (filteredLeaderboard[0]?.availableTokens || 1)) * 100}%`,
                  background: u.id === CURRENT_USER_ID
                    ? 'linear-gradient(90deg, var(--color-primary-500), var(--color-primary-600))'
                    : 'linear-gradient(90deg, var(--color-neutral-400), var(--color-neutral-600))'
                }"
              ></div>
            </div>
            <div class="lb-tokens">🪙 {{ u.availableTokens }}</div>
          </div>

          <div v-if="filteredLeaderboard.length === 0" class="empty-state">
            <p>No neighbours found for "{{ selectedArea }}"!</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const areas = ['All', 'Bishan', 'Tampines', 'Punggol', 'Jurong West', 'Ang Mo Kio', 'Bedok', 'Toa Payoh']
const selectedArea = ref('All')
const isOptedOut = ref(false)
const CURRENT_USER_ID = ref('demo-user-1')

// Initial preview data (Allows immediate frontend preview before backend launch)
const initialLeaderboard = [
  { id: 'demo-user-2', rank: 1, name: 'Chloe Lim', neighbourhood: 'Bishan', availableTokens: 210, ratingAverage: 5.0, avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=chloe' },
  { id: 'demo-user-3', rank: 2, name: 'Marcus Wong', neighbourhood: 'Tampines', availableTokens: 175, ratingAverage: 4.8, avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=marcus' },
  { id: 'demo-user-1', rank: 3, name: 'Tan Jun Jie (Demo User)', neighbourhood: 'Bishan', availableTokens: 145, ratingAverage: 4.9, avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=junjie' },
  { id: 'demo-user-4', rank: 4, name: 'Priya Sharma', neighbourhood: 'Punggol', availableTokens: 130, ratingAverage: 4.7, avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=priya' },
]

const leaderboard = ref([...initialLeaderboard])

const filteredLeaderboard = computed(() => {
  let list = leaderboard.value
  if (selectedArea.value !== 'All') {
    list = list.filter((u) => u.neighbourhood === selectedArea.value)
  }
  if (isOptedOut.value) {
    list = list.filter((u) => u.id !== CURRENT_USER_ID.value)
  }
  return list.map((u, i) => ({ ...u, rank: i + 1 }))
})

async function fetchLeaderboard() {
  try {
    const url =
      selectedArea.value === 'All'
        ? 'http://localhost:8000/api/leaderboard'
        : `http://localhost:8000/api/leaderboard?area=${selectedArea.value}`

    const res = await axios.get(url)
    if (res.data && res.data.leaderboard && res.data.leaderboard.length > 0) {
      leaderboard.value = res.data.leaderboard
      CURRENT_USER_ID.value = leaderboard.value[0].id
    }
  } catch (err) {
    console.info('Backend not active yet; showing frontend preview data.')
  }
}

function selectArea(area) {
  selectedArea.value = area
  fetchLeaderboard()
}

async function toggleOptOut() {
  isOptedOut.value = !isOptedOut.value
  try {
    if (CURRENT_USER_ID.value) {
      await axios.patch(`http://localhost:8000/api/leaderboard/opt-out/${CURRENT_USER_ID.value}`)
      fetchLeaderboard()
    }
  } catch (err) {
    console.info('Toggled opt-out locally in frontend preview.')
  }
}

const rankMedal = (rank) => ({ 1: '🥇', 2: '🥈', 3: '🥉' }[rank] || `#${rank}`)

onMounted(() => {
  fetchLeaderboard()
})
</script>

<style scoped>
.leaderboard-page {
  min-height: 100vh;
  padding-bottom: var(--space-2xl);
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

.opt-out-box {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
}

.switch-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.85rem;
  color: var(--color-neutral-700);
  cursor: pointer;
  font-weight: 600;
}

.styled-checkbox {
  accent-color: var(--color-primary-500);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* TABS (from css style reference DashboardPage) */
.tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xl);
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-full);
  padding: 4px;
  width: fit-content;
  border: 1px solid var(--glass-border);
  flex-wrap: wrap;
}

.tab-btn {
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-neutral-500);
  cursor: pointer;
  transition: all var(--transition-base);
}

.tab-btn.active {
  background: white;
  color: var(--color-primary-700);
  box-shadow: var(--shadow-md);
}

.tab-btn:hover:not(.active) {
  color: var(--color-neutral-800);
}

/* PODIUM */
.podium-section {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: var(--space-lg);
  margin: var(--space-lg) 0 var(--space-xl);
}

.podium-card {
  text-align: center;
  width: 190px;
  padding: var(--space-lg) var(--space-md);
  position: relative;
  transition: transform var(--transition-base);
}

.podium-card.gold {
  transform: translateY(-16px);
  border-color: rgba(251, 191, 36, 0.6);
  background: linear-gradient(180deg, rgba(254, 243, 199, 0.7) 0%, rgba(255, 255, 255, 0.95) 100%);
  box-shadow: 0 12px 30px rgba(245, 158, 11, 0.18);
}

.crown {
  position: absolute;
  top: -14px;
  left: calc(50% - 12px);
  font-size: 1.5rem;
}

.medal {
  font-size: 1.4rem;
  display: block;
}

.podium-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin: var(--space-xs) auto;
  border: 2px solid var(--color-neutral-200);
  background: white;
}

.podium-avatar.top {
  width: 72px;
  height: 72px;
  border-color: var(--color-accent-400);
}

.podium-card h4 {
  margin: var(--space-xs) 0 2px;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.podium-area {
  margin: 0 0 var(--space-xs);
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

/* LEADERBOARD LIST (from css style reference DashboardPage) */
.leaderboard-card {
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
}

.lb-header-row {
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

.lb-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.lb-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  transition: background var(--transition-fast);
  animation: slideIn 0.4s ease both;
}

.lb-row:hover {
  background: rgba(255, 255, 255, 0.5);
}

.lb-me {
  background: rgba(34, 197, 94, 0.08) !important;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.lb-rank {
  font-size: 1.15rem;
  min-width: 36px;
  text-align: center;
  font-weight: 800;
}

.lb-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: white;
  font-weight: 800;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.lb-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-neutral-800);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 140px;
}

.you-tag {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-primary-700);
  border: 1px solid rgba(34, 197, 94, 0.3);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--radius-full);
}

.lb-area {
  font-size: 0.85rem;
  color: var(--color-neutral-500);
  min-width: 110px;
}

.lb-rating {
  font-size: 0.85rem;
  color: var(--color-neutral-500);
  min-width: 60px;
}

.lb-bar-wrap {
  flex: 1;
  background: var(--color-neutral-100);
  border-radius: var(--radius-full);
  height: 8px;
  overflow: hidden;
}

.lb-bar {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: barWide 1s ease both;
}

@keyframes barWide {
  from { width: 0 !important; }
}

.lb-tokens {
  font-weight: 800;
  font-size: 0.95rem;
  color: #92400e;
  min-width: 80px;
  text-align: right;
}

@media (max-width: 640px) {
  .content {
    padding: 0 var(--space-md);
  }
  .lb-area {
    display: none;
  }
  .podium-section {
    gap: var(--space-sm);
  }
  .podium-card {
    width: 105px;
    padding: var(--space-md) var(--space-xs);
  }
}
</style>
