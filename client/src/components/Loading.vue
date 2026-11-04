<script setup>
// Pages supply a descriptive message while sharing the same growing-tree animation.
defineProps({
  label: { type: String, default: 'Loading…' },
})
</script>

<template>
  <!-- Announce the message once; the decorative tree stays hidden from screen readers. -->
  <div class="loading" role="status" aria-live="polite" aria-atomic="true">
    <svg class="loading-tree" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <ellipse class="tree-ground" cx="60" cy="105" rx="30" ry="5" />
      <!-- Draw the trunk upward first, then let its branches and leaves unfold. -->
      <path class="tree-trunk" d="M60 104V34" />
      <path class="tree-branches" d="M60 81 39 60M60 69 82 47M60 53 46 39" />
      <g class="tree-leaves">
        <path class="tree-leaf leaf-left" d="M43 65C23 67 18 48 21 39 38 38 49 49 43 65Z" />
        <path class="tree-leaf leaf-right" d="M77 54C72 35 86 23 100 26 102 44 92 57 77 54Z" />
        <path class="tree-leaf leaf-upper" d="M48 45C31 43 28 28 33 19 49 21 57 32 48 45Z" />
        <path class="tree-leaf leaf-top" d="M60 36C46 24 51 10 62 5 75 16 74 28 60 36Z" />
      </g>
      <path class="tree-soil" d="M37 104h46" />
    </svg>
    <p class="loading-label">{{ label }}</p>
  </div>
</template>

<style scoped>
/* Loading region: center the tree and message without covering surrounding controls. */
.loading {
  /* Share one faster cycle across stems and leaves to keep their growth synchronized. */
  --tree-duration: 1.8s;
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--muted, #607166);
}

/* Tree canvas: keep the illustration compact and consistent across page sections. */
.loading-tree {
  width: 100px;
  height: 100px;
  overflow: visible;
}

/* Ground and soil: anchor the growing tree to a soft green patch. */
.tree-ground {
  fill: var(--accent-soft, #e7f3e9);
}
.tree-soil {
  fill: none;
  stroke: #9b7650;
  stroke-width: 3;
  stroke-linecap: round;
}

/* Woody stems: dash offsets reveal the trunk and branches from their starting points. */
.tree-trunk,
.tree-branches {
  fill: none;
  stroke: #88633f;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tree-trunk {
  stroke-width: 5;
  stroke-dasharray: 70;
  animation: grow-trunk var(--tree-duration) ease-in-out infinite;
}
.tree-branches {
  stroke-width: 3;
  stroke-dasharray: 32;
  animation: grow-branches var(--tree-duration) ease-in-out infinite;
}

/* Leaves: scale from each branch tip so the foliage appears to unfold naturally. */
.tree-leaf {
  fill: var(--accent, #2f7d4a);
  animation: grow-leaf var(--tree-duration) ease-in-out infinite;
}
.leaf-left {
  transform-origin: 43px 65px;
}
.leaf-right {
  transform-origin: 77px 54px;
  fill: #67a65b;
}
.leaf-upper {
  transform-origin: 48px 45px;
  fill: #67a65b;
}
.leaf-top {
  transform-origin: 60px 36px;
}

/* Message: inherit the page font and avoid default paragraph spacing. */
.loading-label {
  margin: 0;
  font-size: 0.9rem;
  text-align: center;
}

/* Growth cycle: grow stems, reveal foliage, hold the full tree, then restart. */
@keyframes grow-trunk {
  0%, 8% { stroke-dashoffset: 70; opacity: 0; }
  12% { opacity: 1; }
  45%, 88% { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
@keyframes grow-branches {
  0%, 25% { stroke-dashoffset: 32; opacity: 0; }
  35% { opacity: 1; }
  55%, 88% { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
@keyframes grow-leaf {
  0%, 38% { transform: scale(0); opacity: 0; }
  65%, 88% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}

/* Reduced motion: display a fully grown tree while retaining the loading message. */
@media (prefers-reduced-motion: reduce) {
  .tree-trunk,
  .tree-branches,
  .tree-leaf {
    animation: none;
  }
}
</style>
