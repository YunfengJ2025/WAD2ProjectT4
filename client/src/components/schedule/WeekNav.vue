<script setup>
import { onBeforeUnmount } from 'vue'
import gsap from 'gsap'

defineProps({
  title: { type: String, required: true },
  isCurrentWeek: { type: Boolean, default: false },
  hasLater: { type: Boolean, default: true },
})
const emit = defineEmits(['shift', 'today'])

// people who ask their device for less motion get no burst
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false

const activeLeaves = new Set() // every leaf currently flying, so we can clean up if the page closes mid-burst

function removeLeaf(leaf) {
  leaf.remove()
  activeLeaves.delete(leaf)
}

function leafBurst(button, direction) {
  if (reduceMotion || activeLeaves.size > 12) return // cap it so rapid clicking can't flood the page

  const box = button.getBoundingClientRect()
  const startX = box.left + box.width / 2
  const startY = box.top + box.height / 2

  for (let i = 0; i < 3; i++) {
    const leaf = document.createElement('span')
    leaf.textContent = '🍃'
    leaf.setAttribute('aria-hidden', 'true')
    document.body.appendChild(leaf)
    activeLeaves.add(leaf)

    // inline styles, because this element is created outside Vue so scoped CSS can't reach it
    gsap.set(leaf, {
      position: 'fixed',
      left: startX,
      top: startY,
      xPercent: -50,
      yPercent: -50,
      fontSize: gsap.utils.random(14, 24),
      pointerEvents: 'none',
      zIndex: 2000,
      scale: 0.4,
      rotation: gsap.utils.random(-40, 40),
    })

    const duration = gsap.utils.random(0.8, 1.2)
    gsap.timeline({ onComplete: () => removeLeaf(leaf) })
      .to(leaf, {
        x: direction * gsap.utils.random(30, 100), // Next flies right, Previous flies left
        y: gsap.utils.random(-100, -50),           // always floats up
        rotation: gsap.utils.random(-200, 200),
        scale: gsap.utils.random(0.9, 1.3),
        duration,
        ease: 'power2.out',
      }, 0)
      .to(leaf, { opacity: 0, duration: 0.4, ease: 'none' }, duration - 0.4) // fade out at the end
  }
}

// tell the parent to change week, then burst
function onNav(direction, event) {
  emit('shift', direction)
  leafBurst(event.currentTarget, direction)
}

onBeforeUnmount(() => {
  for (const leaf of activeLeaves) {
    gsap.killTweensOf(leaf)
    leaf.remove()
  }
  activeLeaves.clear()
})
</script>

<template>
  <div class="week-nav">
    <button
      class="leaf-btn leaf-prev"
      :disabled="isCurrentWeek"
      aria-label="Previous 7 days"
      @click="onNav(-1, $event)"
    >
      <span class="leaf-arrow">‹</span> Previous
    </button>

    <div class="week-title">
      <strong>{{ title }}</strong>
      <button v-if="!isCurrentWeek" class="today-chip" @click="emit('today')">Back to today</button>
    </div>

    <button
      class="leaf-btn leaf-next"
      :disabled="!hasLater"
      aria-label="Next 7 days"
      @click="onNav(1, $event)"
    >
      Next <span class="leaf-arrow">›</span>
    </button>
  </div>
</template>

<style scoped>
.week-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.week-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.3rem 1.1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
  text-align: center;
  font-size: 0.9rem;
}

.today-chip {
  border: 0;
  padding: 0.05rem 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #166534;
  background: rgba(34, 197, 94, 0.18);
  cursor: pointer;
}
.today-chip:hover { background: rgba(34, 197, 94, 0.32); }

/* leaf buttons */
.leaf-btn {
  position: relative;
  border: 0;
  padding: 0.55rem 1.4rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #4ade80, #16a34a);
  box-shadow: 0 4px 10px rgba(22, 163, 74, 0.35);
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
}
/* two sharp opposite corners and two big round ones = a leaf. mirrored for the other direction */
.leaf-next { border-radius: 2rem 0.3rem 2rem 0.3rem; }
.leaf-prev { border-radius: 0.3rem 2rem 0.3rem 2rem; }

/* a faint vein line across the leaf */
.leaf-btn::after {
  content: '';
  position: absolute;
  left: 14%;
  right: 14%;
  top: 50%;
  height: 1px;
  background: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}
.leaf-next::after { transform: rotate(-18deg); }
.leaf-prev::after { transform: rotate(18deg); }

.leaf-arrow { font-size: 1.1rem; margin: 0 0.15rem; }

/* hover / press only when the button is usable */
.leaf-next:not(:disabled):hover { transform: translateY(-2px) rotate(-4deg); box-shadow: 0 8px 16px rgba(22, 163, 74, 0.4); }
.leaf-prev:not(:disabled):hover { transform: translateY(-2px) rotate(4deg);  box-shadow: 0 8px 16px rgba(22, 163, 74, 0.4); }
.leaf-btn:not(:disabled):active { transform: scale(0.94); }
.leaf-btn:focus-visible { outline: 3px solid #0d6efd; outline-offset: 3px; }

/* a withered leaf: greyed out, flat, no shadow */
.leaf-btn:disabled {
  background: linear-gradient(135deg, #cbd5e1, #94a3b8);
  box-shadow: none;
  opacity: 0.55;
  cursor: not-allowed;
}

/* phones: smaller buttons so Previous / title / Next all fit on one row */
@media (max-width: 575.98px) {
  .leaf-btn { padding: 0.45rem 0.8rem; font-size: 0.85rem; }
  .week-title { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
}

@media (prefers-reduced-motion: reduce) {
  .leaf-btn { transition: none; }
  .leaf-btn:hover, .leaf-btn:active { transform: none; }
}
</style>