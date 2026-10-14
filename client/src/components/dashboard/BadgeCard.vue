<template>
  <!--
    :class binding with array + object syntax — covered in WAD2 wk4 (Vue Basics I, v-bind)
    badge.unlocked conditionally applies the 'unlocked' CSS class
  -->
  <div :class="['badge-card glass-card', { unlocked: badge.unlocked }]">
    <div class="badge-icon-wrap">
      <!-- {{ }} template interpolation — covered in WAD2 wk4 -->
      <span class="badge-icon">{{ badge.icon }}</span>
      <!-- v-if — covered in WAD2 wk4 -->
      <span v-if="badge.unlocked" class="check-mark">✓</span>
    </div>
    <div class="badge-info">
      <h4>{{ badge.name }}</h4>
      <p>{{ badge.description }}</p>
      <!--
        :style binding — covered in WAD2 wk4 (v-bind:style)
        Dynamically sets the progress bar width from the badge.progress prop
      -->
      <div class="progress-bar-container">
        <div class="progress-fill" :style="{ width: badge.progress + '%' }"></div>
      </div>
      <!-- Ternary expression in template — covered in WAD2 wk4 -->
      <span class="status-text">
        {{ badge.unlocked ? 'Unlocked 🎉' : `${badge.progress}% completed` }}
      </span>
    </div>
  </div>
</template>

<script setup>
// defineProps — covered in WAD2 wk6 (Vue Components, <script setup>)
defineProps({ badge: { type: Object, required: true } })
</script>

<style scoped>
/* scoped CSS — part of Vue SFC structure, shown in WAD2 wk6 examples */

.badge-card {
  display: flex;
  align-items: center;
  gap: var(--space-md); /* [NOT IN WAD2 CONTENT] — CSS custom property */
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  /* [NOT IN WAD2 CONTENT] — CSS transition property for hover animation */
  transition: transform var(--transition-bounce), box-shadow var(--transition-base), border-color var(--transition-base);
  opacity: 0.75;
  filter: grayscale(0.7); /* [NOT IN WAD2 CONTENT] — CSS filter property */
  position: relative;
}

/* Unlocked state — full colour, green glow, elevated depth */
.badge-card.unlocked {
  filter: none;
  opacity: 1;
  border-color: rgba(74, 222, 128, 0.65);
  /* [NOT IN WAD2 CONTENT] — linear-gradient background */
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 253, 244, 0.95) 100%);
  box-shadow: 0 10px 28px rgba(34, 197, 94, 0.18), 0 0 16px rgba(74, 222, 128, 0.15);
}

.badge-card:hover {
  transform: translateY(-4px) scale(1.02); /* [NOT IN WAD2 CONTENT] — CSS transform on hover */
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.08);
}

.badge-card.unlocked:hover {
  box-shadow: 0 16px 36px rgba(34, 197, 94, 0.25), 0 0 24px rgba(74, 222, 128, 0.25);
}

/* Icon circle wrapper with breathing pulse on unlocked badges */
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
  animation: iconBreathe 3.5s ease-in-out infinite; /* [NOT IN WAD2 CONTENT] */
}

/* Small checkmark badge overlay — [NOT IN WAD2 CONTENT] (position: absolute overlay) */
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

/* Progress bar — [NOT IN WAD2 CONTENT] custom progress bar (WAD2 wk3 teaches Bootstrap .progress) */
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
  /* [NOT IN WAD2 CONTENT] — linear-gradient + CSS transition for animated fill */
  background: linear-gradient(90deg, var(--color-primary-400), var(--color-primary-600));
  transition: width 0.6s ease;
}

.status-text {
  font-size: 0.75rem;
  color: var(--color-primary-600);
  font-weight: 700;
}
</style>
