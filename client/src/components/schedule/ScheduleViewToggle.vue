<script setup>
defineProps({
  modelValue: { type: String, required: true }, // 'mine' or 'sitting'
  badge: { type: Number, default: 0 },          // plants you still need to water as a sitter
})
const emit = defineEmits(['update:modelValue'])

const OPTIONS = [
  { value: 'mine', icon: '🪴', label: 'My plants' },
  { value: 'sitting', icon: '🤝', label: 'Sitting' },
]

// left / right arrow keys move between the two tabs
function onKey(event) {
  const next = event.key === 'ArrowRight' ? 'sitting' : event.key === 'ArrowLeft' ? 'mine' : null
  if (next) emit('update:modelValue', next)
}
</script>

<template>
  <div class="view-toggle" role="tablist" aria-label="Schedule view" :data-active="modelValue" @keydown="onKey">
    <span class="thumb" aria-hidden="true"></span>
    <button
      v-for="opt in OPTIONS"
      :key="opt.value"
      type="button"
      role="tab"
      class="toggle-btn"
      :class="{ active: modelValue === opt.value }"
      :aria-selected="modelValue === opt.value"
      :tabindex="modelValue === opt.value ? 0 : -1"
      @click="emit('update:modelValue', opt.value)"
    >
      <span aria-hidden="true">{{ opt.icon }}</span>
      {{ opt.label }}
      <span v-if="opt.value === 'sitting' && badge" class="badge-dot" :aria-label="`${badge} to water`">{{ badge }}</span>
    </button>
  </div>
</template>

<style scoped>
.view-toggle {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;          /* two equal halves, so the thumb is exactly half wide */
  width: min(100%, 340px);
  margin: 0 auto 1rem;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(4px);
}

/* the green pill that slides under the active tab */
.thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 4px);
  border-radius: 999px;
  background: linear-gradient(135deg, #4ade80, #16a34a);
  box-shadow: 0 4px 10px rgba(22, 163, 74, 0.35);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.view-toggle[data-active='sitting'] .thumb { transform: translateX(100%); }

.toggle-btn {
  position: relative;               /* sits above the thumb */
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem 0.5rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #14532d;
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.25s ease;
}
.toggle-btn.active { color: #fff; }
.toggle-btn:focus-visible { outline: 3px solid #0d6efd; outline-offset: 2px; }

.badge-dot {
  min-width: 1.2rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #f59e0b;
  color: #fff;
  font-size: 0.7rem;
  line-height: 1.2rem;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .thumb, .toggle-btn { transition: none; }
}
</style>