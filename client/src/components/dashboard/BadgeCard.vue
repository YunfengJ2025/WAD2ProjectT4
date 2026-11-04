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
  transition: transform var(--transition-bounce), box-shadow var(--transition-base), border-color var(--transition-base);
  opacity: 0.75;
  filter: grayscale(0.7);
  position: relative;
}

/* Unlocked state */
.badge-card.unlocked {
  filter: none;
  opacity: 1;
  border-color: rgba(74, 222, 128, 0.65);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 253, 244, 0.95) 100%);
  box-shadow: 0 10px 28px rgba(34, 197, 94, 0.18), 0 0 16px rgba(74, 222, 128, 0.15);
}

.badge-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.08);
}

.badge-card.unlocked:hover {
  box-shadow: 0 16px 36px rgba(34, 197, 94, 0.25), 0 0 24px rgba(74, 222, 128, 0.25);
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
  transition: transform var(--transition-bounce);
}

.badge-card.unlocked .badge-icon-wrap {
  background: linear-gradient(135deg, var(--color-primary-100), var(--color-primary-200));
  animation: iconBreathe 3.5s ease-in-out infinite;
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

@media (max-width: 575.98px) {
  .badge-card {
    padding: var(--space-sm);
    gap: var(--space-xs);
  }
  .badge-icon-wrap {
    width: 38px;
    height: 38px;
  }
  .badge-icon {
    font-size: 1.25rem;
  }
  .badge-info h4 {
    font-size: 0.88rem;
  }
  .badge-info p {
    font-size: 0.75rem;
  }
}
</style>
