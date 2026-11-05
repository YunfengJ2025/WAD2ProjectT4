<template>
  <div class="leaderboard-page anim-fade-in">
    <main class="content">
      <!-- HEADER -->
      <header class="page-header anim-slide-up">
        <div>
          <p class="greeting">Singapore Rankings</p>
          <h1>🏆 Community Leaderboard</h1>
          <p class="subtitle">Top plant caregivers and helpful neighbours ranked by community tokens</p>
        </div>

        <div class="header-actions">
          <router-link to="/dashboard" class="btn btn-primary btn-sm btn-nav-action">
            <span class="btn-icon">🌱</span>
            <span class="btn-text">View Dashboard</span>
          </router-link>
          <div class="opt-out-box glass-card">
            <label class="switch-label">
              <input type="checkbox" :checked="isOptedOut" @change="toggleOptOut" class="styled-checkbox" />
              <span class="switch-text">Hide my profile from Leaderboard</span>
            </label>
          </div>
        </div>
      </header>

      <!-- TOP 3 PODIUM -->
      <div v-if="filteredLeaderboard.length >= 3" class="podium-section anim-slide-up anim-delay-1">
        <!-- 2nd Place -->
        <div class="podium-card glass-card silver">
          <span class="medal">🥈</span>
          <div class="podium-avatar-container">
            <UserAvatar
              :user="{ photoUrl: filteredLeaderboard[1].photoUrl, userName: filteredLeaderboard[1].name }"
              :size="60"
              class="podium-avatar"
            />
          </div>
          <h4>{{ filteredLeaderboard[1].name }}</h4>
          <div class="token-pill">🪙 {{ filteredLeaderboard[1].availableTokens }}</div>
        </div>

        <!-- 1st Place -->
        <div class="podium-card glass-card gold">
          <span class="crown">👑</span>
          <span class="medal">🥇</span>
          <div class="podium-avatar-container">
            <UserAvatar
              :user="{ photoUrl: filteredLeaderboard[0].photoUrl, userName: filteredLeaderboard[0].name }"
              :size="76"
              class="podium-avatar top"
            />
          </div>
          <h4>{{ filteredLeaderboard[0].name }}</h4>
          <div class="token-pill gold-pill">🪙 {{ filteredLeaderboard[0].availableTokens }}</div>
        </div>

        <!-- 3rd Place -->
        <div class="podium-card glass-card bronze">
          <span class="medal">🥉</span>
          <div class="podium-avatar-container">
            <UserAvatar
              :user="{ photoUrl: filteredLeaderboard[2].photoUrl, userName: filteredLeaderboard[2].name }"
              :size="60"
              class="podium-avatar"
            />
          </div>
          <h4>{{ filteredLeaderboard[2].name }}</h4>
          <div class="token-pill">🪙 {{ filteredLeaderboard[2].availableTokens }}</div>
        </div>
      </div>

      <!-- LEADERBOARD RANKINGS LIST -->
      <div class="leaderboard-card glass-card anim-slide-up anim-delay-2">
        <div class="lb-header-row">
          <h3 class="chart-title">Top Token Holders in Singapore</h3>
          <span class="badge badge-done">{{ filteredLeaderboard.length }} Neighbours Active</span>
        </div>

        <div class="lb-list">
          <div
            v-for="u in filteredLeaderboard"
            :key="u.id"
            class="lb-row"
            :class="{ 'lb-me': isCurrentUser(u) }"
          >
            <div class="lb-rank">{{ rankMedal(u.rank) }}</div>
            <div class="lb-avatar-wrap">
              <UserAvatar
                :user="{ photoUrl: u.photoUrl, userName: u.name }"
                :size="36"
                class="lb-avatar-img"
              />
            </div>
            <div class="lb-name">
              <span class="lb-username">{{ u.name }}</span>
              <span v-if="isCurrentUser(u)" class="you-tag">You</span>
            </div>
            <div class="lb-rating">⭐ {{ u.ratingAverage ? Number(u.ratingAverage).toFixed(1) : '5.0' }}</div>
            <div class="lb-tokens">🪙 {{ u.availableTokens }}</div>
          </div>

          <div v-if="filteredLeaderboard.length === 0" class="empty-state">
            <p>No neighbours on the leaderboard yet!</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { apiUrl } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/user/UserAvatar.vue'

const auth = useAuthStore()
const isOptedOut = ref(false)
const leaderboard = ref([])

const CURRENT_USER_ID = computed(() => auth.user?.userId || auth.user?.id || null)

function isCurrentUser(u) {
  if (!auth.user) return false
  if (CURRENT_USER_ID.value && String(u.id) === String(CURRENT_USER_ID.value)) return true
  if (auth.user.userName && u.name && u.name.toLowerCase() === auth.user.userName.toLowerCase()) return true
  return false
}

// Filter out current user if opted out and recalculate ranks
const filteredLeaderboard = computed(() => {
  let list = leaderboard.value
  if (isOptedOut.value) {
    list = list.filter((u) => !isCurrentUser(u))
  }
  return list.map((u, i) => ({ ...u, rank: i + 1 }))
})

async function fetchLeaderboard() {
  try {
    const res = await axios.get(apiUrl('/api/leaderboard'))
    if (res.data && res.data.leaderboard) {
      leaderboard.value = res.data.leaderboard
    }
  } catch (err) {
    console.error('Failed to fetch leaderboard from server:', err)
  }
}

async function fetchOptOutStatus() {
  const targetId = CURRENT_USER_ID.value
  if (!targetId) {
    if (auth.user?.hideFromLeaderboard !== undefined) {
      isOptedOut.value = Boolean(auth.user.hideFromLeaderboard)
    }
    return
  }
  try {
    const res = await axios.get(apiUrl(`/api/leaderboard/status/${targetId}`))
    if (res.data && typeof res.data.hideFromLeaderboard === 'boolean') {
      isOptedOut.value = res.data.hideFromLeaderboard
      if (auth.user) {
        auth.user.hideFromLeaderboard = res.data.hideFromLeaderboard
      }
    }
  } catch (err) {
    if (auth.user?.hideFromLeaderboard !== undefined) {
      isOptedOut.value = Boolean(auth.user.hideFromLeaderboard)
    }
  }
}

async function toggleOptOut() {
  const targetId = CURRENT_USER_ID.value
  isOptedOut.value = !isOptedOut.value

  if (targetId) {
    try {
      const res = await axios.patch(apiUrl(`/api/leaderboard/opt-out/${targetId}`))
      if (res.data && typeof res.data.hideFromLeaderboard === 'boolean') {
        isOptedOut.value = res.data.hideFromLeaderboard
        if (auth.user) {
          auth.user.hideFromLeaderboard = res.data.hideFromLeaderboard
        }
      }
      await fetchLeaderboard()
    } catch (err) {
      console.error('Error toggling opt-out:', err)
      isOptedOut.value = !isOptedOut.value
    }
  }
}

const rankMedal = (rank) => ({ 1: '🥇', 2: '🥈', 3: '🥉' }[rank] || `#${rank}`)

onMounted(async () => {
  await fetchOptOutStatus()
  await fetchLeaderboard()
})
</script>

<style scoped>
.leaderboard-page {
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

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
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
  transition: transform var(--transition-bounce), box-shadow var(--transition-base), border-color var(--transition-base);
  overflow: hidden;
}

.podium-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.08);
}

.podium-card.silver {
  border-color: rgba(203, 213, 225, 0.85);
}
.podium-card.silver:hover {
  transform: translateY(-12px) scale(1.02);
  box-shadow: 0 18px 36px rgba(148, 163, 184, 0.28);
}

.podium-card.bronze {
  border-color: rgba(245, 158, 11, 0.35);
}
.podium-card.bronze:hover {
  transform: translateY(-12px) scale(1.02);
  box-shadow: 0 18px 36px rgba(180, 83, 9, 0.2);
}

.podium-card.gold {
  transform: translateY(-16px);
  border-color: rgba(251, 191, 36, 0.85);
  background: linear-gradient(180deg, rgba(254, 243, 199, 0.85) 0%, rgba(255, 255, 255, 0.98) 100%);
  box-shadow: 0 16px 36px rgba(245, 158, 11, 0.28), 0 0 24px rgba(251, 191, 36, 0.22);
}

.podium-card.gold:hover {
  transform: translateY(-24px) scale(1.03);
  box-shadow: 0 24px 44px rgba(245, 158, 11, 0.38), 0 0 32px rgba(251, 191, 36, 0.32);
}

.podium-card.gold::after {
  content: '';
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.65) 50%, transparent 60%);
  animation: foilShimmer 5s ease-in-out infinite;
  pointer-events: none;
}

.crown {
  position: absolute;
  top: -18px;
  left: calc(50% - 14px);
  font-size: 1.6rem;
  animation: crownFloat 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 8px rgba(245, 158, 11, 0.45));
}

.medal {
  font-size: 1.4rem;
  display: block;
}

.podium-avatar-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: var(--space-xs) auto;
}

.podium-avatar {
  border-radius: 50%;
  border: 2px solid rgba(47, 125, 74, 0.45);
  background: var(--accent-soft, #e3f1e6);
  transition: transform var(--transition-bounce);
  overflow: hidden;
}

.podium-card:hover .podium-avatar {
  transform: scale(1.08);
}

.podium-avatar.top {
  border: 3.5px solid #eab308;
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.45);
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

/* LEADERBOARD ROWS */
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
  border: 1px solid transparent;
  transition: all var(--transition-fast);
  animation: slideIn 0.4s ease both;
}

.lb-row:hover {
  transform: translateX(6px);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
  border-color: rgba(74, 222, 128, 0.35);
}

.lb-me {
  background: rgba(34, 197, 94, 0.1) !important;
  border: 1px solid rgba(34, 197, 94, 0.35) !important;
  animation: userRowPulse 3s infinite ease-in-out;
}

.lb-rank {
  font-size: 1.15rem;
  min-width: 36px;
  text-align: center;
  font-weight: 800;
}

.lb-avatar-wrap {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lb-avatar-img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  border: 1.5px solid rgba(47, 125, 74, 0.45);
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
  flex: 1;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-neutral-800);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  flex-wrap: wrap;
}

.lb-username {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.you-tag {
  background: rgba(34, 197, 94, 0.18);
  color: var(--color-primary-700);
  border: 1px solid rgba(34, 197, 94, 0.4);
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 8px;
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
  background: rgba(231, 229, 228, 0.7);
  border-radius: var(--radius-full);
  height: 9px;
  overflow: hidden;
  position: relative;
}

.lb-bar {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: barWide 1s ease both;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.35);
  position: relative;
}

.lb-bar::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 8px #ffffff;
  opacity: 0.85;
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
  margin-left: auto;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.lb-tokens:hover, .token-pill:hover {
  transform: scale(1.08);
}

/* Responsive Breakpoints */
@media (max-width: 1199.98px) {
  .podium-section {
    gap: var(--space-md);
  }
  .podium-card {
    width: 175px;
  }
}

@media (max-width: 991.98px) {
  .podium-section {
    gap: var(--space-md);
  }
  .podium-card {
    width: 150px;
    padding: var(--space-md) var(--space-sm);
  }
  .podium-avatar.top {
    width: 66px;
    height: 66px;
  }
  .lb-name {
    min-width: 0;
  }
}

@media (max-width: 767.98px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-md);
  }
  .header-actions {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .opt-out-box {
    padding: var(--space-xs) var(--space-sm);
  }
  .podium-section {
    gap: var(--space-sm);
    margin: var(--space-md) 0 var(--space-lg);
  }
  .podium-card {
    width: 130px;
    padding: var(--space-md) var(--space-xs);
  }
  .podium-card h4 {
    font-size: 0.85rem;
  }
  .podium-avatar {
    width: 50px;
    height: 50px;
  }
  .podium-avatar.top {
    width: 60px;
    height: 60px;
  }
  .lb-bar-wrap {
    display: none;
  }
  .leaderboard-card {
    padding: var(--space-md);
  }
  .lb-row {
    padding: var(--space-xs) var(--space-sm);
  }
}

@media (max-width: 575.98px) {
  .page-header h1 {
    font-size: 1.65rem;
  }
  .header-actions {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-xs);
  }
  .header-actions .btn {
    text-align: center;
    width: 100%;
  }
  .tabs {
    width: 100%;
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 6px;
    -webkit-overflow-scrolling: touch;
  }
  .tab-btn {
    white-space: nowrap;
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.8rem;
  }
  .podium-section {
    gap: 6px;
    align-items: flex-end;
  }
  .podium-card {
    width: 105px;
    padding: var(--space-sm) 4px;
  }
  .podium-card h4 {
    font-size: 0.78rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .token-pill {
    font-size: 0.75rem;
    padding: 2px 6px;
  }
  .lb-row {
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
  }
  .lb-rank {
    font-size: 0.95rem;
    min-width: 24px;
  }
  .lb-avatar-wrap, .lb-avatar, .lb-avatar-img {
    width: 30px;
    height: 30px;
    font-size: 0.8rem;
  }
  .lb-name {
    min-width: 0;
    font-size: 0.82rem;
  }
  .lb-area {
    display: none;
  }
  .lb-rating {
    min-width: 44px;
    font-size: 0.75rem;
  }
  .lb-tokens {
    font-size: 0.82rem;
    min-width: 55px;
  }
}

@media (max-width: 379.98px) {
  .podium-section {
    gap: 4px;
  }
  .podium-card {
    width: 96px;
    padding: var(--space-xs) 2px;
  }
  .podium-avatar {
    width: 42px;
    height: 42px;
  }
  .podium-avatar.top {
    width: 50px;
    height: 50px;
  }
  .medal {
    font-size: 1.1rem;
  }
  .crown {
    font-size: 1.3rem;
    top: -14px;
  }
  .lb-row {
    gap: 4px;
  }
  .lb-name {
    min-width: 0;
    font-size: 0.76rem;
  }
  .lb-tokens {
    font-size: 0.76rem;
  }
}
</style>
