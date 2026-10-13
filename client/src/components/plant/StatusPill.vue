<script setup>
// status comes from getWateringStatus(): { key, label }
defineProps({
  status: { type: Object, required: true },
})
</script>

<template>
  <span class="pill" :class="status.key">
    <span class="dot" aria-hidden="true"></span>{{ status.label }}
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

/* Solid colours when action is needed, quiet glass when it isn't */
.pill.overdue {
  background: #c8322a;
  color: #fff;
}

.pill.due {
  background: #f0b429;
  color: #3a2800;
}

.pill.upcoming {
  background: rgba(15, 22, 17, 0.62);
  color: #e9f5ec;
  backdrop-filter: blur(6px);
}
</style>
