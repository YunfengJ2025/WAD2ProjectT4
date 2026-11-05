<script setup>
// ToastHost: shows the small pop-up messages ("Plant added", errors...).
// It is placed once in App.vue. Any page calls useToast().show('message'),
// and because the list is shared (see composables/useToast.js), it appears here.
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

// Toast button (e.g. Undo): close the toast, then run its action
function runAction(t) {
  dismiss(t.id)
  t.action.onClick()
}
</script>

<template>
  <!-- aria-live: screen readers read new messages out loud -->
  <div class="toasts" role="status" aria-live="polite">
    <!-- TransitionGroup animates each toast sliding in and out -->
    <TransitionGroup name="toast">
      <!-- Called "app-toast", not "toast": Bootstrap's .toast class hides itself (display: none) -->
      <div v-for="t in toasts" :key="t.id" class="app-toast" :class="t.type">
        <span>{{ t.message }}</span>
        <button v-if="t.action" type="button" class="toast-action" @click="runAction(t)">
          {{ t.action.label }}
        </button>
        <button type="button" aria-label="Dismiss" @click="dismiss(t.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  z-index: 50;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  width: min(420px, calc(100vw - 2rem));
  display: grid;
  gap: 0.5rem;
  pointer-events: none;
}

.app-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  background: var(--accent);
  color: var(--on-accent);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  font-weight: 500;
}

/* Undo-style button: outlined so it looks different from the × */
.app-toast .toast-action {
  margin-left: auto;
  padding: 0.2rem 0.7rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
}

.app-toast .toast-action:hover {
  background: rgba(255, 255, 255, 0.2);
}

.app-toast.error {
  background: var(--danger);
  color: var(--on-danger);
}

.app-toast button {
  background: none;
  border: 0;
  color: inherit;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.25rem;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
@media (max-width: 600px) {
  .toasts { bottom: calc(1rem + env(safe-area-inset-bottom)); }
}
</style>
