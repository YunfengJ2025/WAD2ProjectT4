<template>
  <!--
    CommunityPodium Component:
    Renders top 3 caregivers directly on the Community view.
    v-if — covered in WAD2 wk4 (Vue Basics I)
    v-bind (:src, :alt) — covered in WAD2 wk4
    <RouterLink> — covered in WAD2 wk6 (Vue Router)
    anim-slide-up — custom CSS keyframe animation from main.css [NOT IN WAD2 CONTENT]
  -->
  <section v-if="leaders && leaders.length >= 3" class="community-podium-wrap anim-slide-up">
    <div class="podium-header">
      <div>
        <span class="podium-eyebrow">TOP CAREGIVERS</span>
        <h3 class="podium-title">Community Champions 🏆</h3>
      </div>
      <!-- router-link gives quick navigation to the complete LeaderboardView -->
      <RouterLink to="/leaderboard" class="view-all-link">
        View Full Leaderboard ↗
      </RouterLink>
    </div>

    <!--
      Podium Layout:
      Arranged visually as [2nd Silver, 1st Gold (center & elevated), 3rd Bronze].
      Gold card is elevated using translateY(-12px) in CSS [NOT IN WAD2 CONTENT].
    -->
    <div class="podium-section">
      <!-- 2nd Place -->
      <div class="podium-card silver">
        <span class="medal">🥈</span>
        <div class="podium-avatar-container">
          <UserAvatar
            :user="{ photoUrl: leaders[1].photoUrl, userName: leaders[1].name }"
            :size="52"
            class="podium-avatar"
          />
        </div>
        <h4>{{ leaders[1].name }}</h4>
        <div class="token-pill">🪙 {{ leaders[1].availableTokens }}</div>
      </div>

      <!-- 1st Place (Champion) -->
      <div class="podium-card gold">
        <span class="crown">👑</span>
        <span class="medal">🥇</span>
        <div class="podium-avatar-container">
          <UserAvatar
            :user="{ photoUrl: leaders[0].photoUrl, userName: leaders[0].name }"
            :size="66"
            class="podium-avatar top"
          />
        </div>
        <h4>{{ leaders[0].name }}</h4>
        <div class="token-pill gold-pill">🪙 {{ leaders[0].availableTokens }}</div>
      </div>

      <!-- 3rd Place -->
      <div class="podium-card bronze">
        <span class="medal">🥉</span>
        <div class="podium-avatar-container">
          <UserAvatar
            :user="{ photoUrl: leaders[2].photoUrl, userName: leaders[2].name }"
            :size="52"
            class="podium-avatar"
          />
        </div>
        <h4>{{ leaders[2].name }}</h4>
        <div class="token-pill">🪙 {{ leaders[2].availableTokens }}</div>
      </div>
    </div>
  </section>
</template>

<script setup>
// RouterLink component from Vue Router — covered in WAD2 wk6
import { RouterLink } from 'vue-router'
import UserAvatar from '@/components/user/UserAvatar.vue'

// defineProps is a Vue 3 Composition API macro — covered in WAD2 wk5
// Receives the array of top 3 users from CommunityView
defineProps({
  leaders: {
    type: Array,
    default: () => [],
  },
})
</script>

<style scoped>
.community-podium-wrap {
  background: linear-gradient(135deg, rgba(240, 253, 244, 0.7) 0%, rgba(255, 255, 255, 0.95) 100%);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 20px;
  padding: 1.5rem 1.75rem 1.25rem;
  margin-bottom: 2.25rem;
  box-shadow: 0 8px 24px rgba(20, 83, 45, 0.05);
}

.podium-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.podium-eyebrow {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--accent, #16a34a);
  display: block;
  margin-bottom: 0.2rem;
}

.podium-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-heading, #1f2937);
  margin: 0;
}

.view-all-link {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent, #16a34a);
  text-decoration: none;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  background: rgba(34, 197, 94, 0.1);
  transition: all 0.2s ease;
}

.view-all-link:hover {
  background: rgba(34, 197, 94, 0.2);
  transform: translateX(2px);
}

.podium-section {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 1.25rem;
  padding-top: 1rem;
}

.podium-card {
  text-align: center;
  width: 170px;
  padding: 1.25rem 0.85rem;
  position: relative;
  border-radius: 16px;
  background: white;
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
  overflow: hidden;
}

.podium-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.podium-card.silver {
  border-color: rgba(203, 213, 225, 0.9);
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.podium-card.bronze {
  border-color: rgba(245, 158, 11, 0.3);
  background: linear-gradient(180deg, #fffbeb 0%, #ffffff 100%);
}

.podium-card.gold {
  transform: translateY(-12px);
  border-color: rgba(251, 191, 36, 0.85);
  background: linear-gradient(180deg, rgba(254, 243, 199, 0.85) 0%, #ffffff 100%);
  box-shadow: 0 10px 28px rgba(245, 158, 11, 0.22), 0 0 20px rgba(251, 191, 36, 0.18);
}

.podium-card.gold:hover {
  transform: translateY(-18px) scale(1.02);
  box-shadow: 0 16px 36px rgba(245, 158, 11, 0.32);
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

@keyframes foilShimmer {
  0%, 100% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
}

.crown {
  position: absolute;
  top: -14px;
  left: calc(50% - 12px);
  font-size: 1.4rem;
  animation: crownFloat 3s ease-in-out infinite;
  filter: drop-shadow(0 3px 6px rgba(245, 158, 11, 0.4));
}

@keyframes crownFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.medal {
  font-size: 1.25rem;
  display: block;
}

.podium-avatar-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0.5rem auto;
}

.podium-avatar {
  border-radius: 50%;
  border: 2px solid rgba(47, 125, 74, 0.45);
  background: var(--accent-soft, #e3f1e6);
  overflow: hidden;
}

.podium-avatar.top {
  border: 3.5px solid #eab308;
  box-shadow: 0 0 14px rgba(251, 191, 36, 0.45);
}

.podium-card h4 {
  margin: 0.35rem 0 0.5rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-heading, #1f2937);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.token-pill {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #475569;
}

.gold-pill {
  background: #fef3c7;
  color: #b45309;
}

/* Bootstrap responsive podium breakpoints */
@media (max-width: 767.98px) {
  .podium-section {
    gap: 0.8rem;
  }
  .podium-card {
    width: 120px;
    padding: 1rem 0.5rem;
  }
}

@media (max-width: 575.98px) {
  .podium-section {
    gap: 0.5rem;
  }
  .podium-card {
    width: 100px;
    padding: 0.8rem 0.35rem;
  }
  .podium-avatar {
    width: 38px;
    height: 38px;
  }
  .podium-avatar.top {
    width: 48px;
    height: 48px;
  }
}
</style>

