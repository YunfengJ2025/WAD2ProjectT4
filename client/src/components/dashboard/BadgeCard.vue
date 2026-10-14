<template>
  <div :class="['badge-card glass-card', { unlocked: badge.unlocked }]">
    <div class="badge-icon-wrap">
      <span class="badge-icon">{{ badge.icon }}</span>
      <span v-if="badge.unlocked" class="check-mark">✓</span>
    </div>
    <div class="badge-info">
      <h4>{{ badge.name }}</h4>
      <p>{{ badge.description }}</p>
      <div class="progress-bar-container">
        <div class="progress-fill" :style="{ width: badge.progress + '%' }"></div>
      </div>
      <span class="status-text">
        {{ badge.unlocked ? 'Unlocked 🎉' : `${badge.progress}% completed` }}
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({ badge: { type: Object, required: true } })
</script>

<style scoped>
.badge-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
  opacity: 0.75;
  filter: grayscale(0.7);
}

.badge-card.unlocked {
  filter: none;
  opacity: 1;
  border-color: rgba(74, 222, 128, 0.5);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 253, 244, 0.9) 100%);
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.12);
}

.badge-card:hover {
  transform: translateY(-2px);
}

.badge-icon-wrap {
  position: relative;
  font-size: 2rem;
  min-width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-neutral-100);
  border-radius: var(--radius-full);
}

.badge-card.unlocked .badge-icon-wrap {
  background: var(--color-primary-100);
}

.check-mark {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: var(--color-primary-500);
  color: white;
  font-size: 0.75rem;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  box-shadow: 0 2px 4px rgba(34, 197, 94, 0.4);
}

.badge-info {
  flex: 1;
  min-width: 0;
}

.badge-info h4 {
  margin: 0 0 2px 0;
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.badge-info p {
  margin: 0 0 var(--space-xs) 0;
  font-size: 0.8rem;
  color: var(--color-neutral-500);
  line-height: 1.35;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: var(--color-neutral-200);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary-400), var(--color-primary-600));
  transition: width 0.6s ease;
}

.status-text {
  font-size: 0.75rem;
  color: var(--color-primary-600);
  font-weight: 700;
}
</style>
