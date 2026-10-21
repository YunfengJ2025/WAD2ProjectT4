<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  busy: { type: Boolean, default: false },
  busyLabel: { type: String, default: 'Working…' },
})
const emit = defineEmits(['confirm', 'cancel'])

const dialog = ref(null)

function sync(open) {
  const el = dialog.value
  if (!el) return
  if (open && !el.open) el.showModal()
  else if (!open && el.open) el.close()
}

watch(() => props.open, sync)
onMounted(() => sync(props.open))

// Esc key or clicking the backdrop
function onCancel(event) {
  event.preventDefault()
  if (!props.busy) emit('cancel')
}
function onBackdropClick(event) {
  if (event.target === dialog.value) onCancel(event)
}
</script>

<template>
  <dialog
    ref="dialog"
    class="confirm"
    aria-labelledby="confirm-title"
    @cancel="onCancel"
    @click="onBackdropClick"
  >
    <h2 id="confirm-title">{{ title }}</h2>
    <p v-if="message">{{ message }}</p>
    <div class="actions">
      <button type="button" class="btn" :disabled="busy" autofocus @click="emit('cancel')">
        Cancel
      </button>
      <button type="button" class="btn btn-danger" :disabled="busy" @click="emit('confirm')">
        {{ busy ? busyLabel : confirmLabel }}
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.confirm {
  width: min(400px, calc(100vw - 2rem));
  /* base.css sets margin: 0 on everything; auto is what centres a modal dialog */
  margin: auto;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--color-text);
}

.confirm::backdrop {
  background: rgba(0, 0, 0, 0.45);
}

h2 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 0.4rem;
}

p {
  color: var(--muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.25rem;
}
</style>
