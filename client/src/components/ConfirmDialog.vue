<script setup>
// ConfirmDialog: a reusable "Are you sure?" pop-up (delete plant, log out, water early...).
// The parent decides when it is open and what happens on confirm:
//   <ConfirmDialog :open="..." title="..." @confirm="doIt" @cancel="close" />
// It uses the browser's built-in <dialog> element, which already gives us the dark
// backdrop, keeps keyboard focus inside the pop-up, and closes on the Esc key.
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false }, // parent sets true to show the pop-up
  title: { type: String, required: true },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  busy: { type: Boolean, default: false }, // true while the action runs: buttons disabled
  busyLabel: { type: String, default: 'Working…' },
  // Colour of the confirm button: red for deleting, e.g. 'btn-primary' for safe actions
  confirmClass: { type: String, default: 'btn-danger' },
})
const emit = defineEmits(['confirm', 'cancel'])

// ref="dialog" in the template: gives us the real <dialog> element
const dialog = ref(null)

// Show or hide the <dialog> to match the `open` prop.
// showModal() and close() are the browser's own methods for <dialog>.
function sync(open) {
  const el = dialog.value
  if (!el) return
  if (open && !el.open) el.showModal()
  else if (!open && el.open) el.close()
}

// Whenever the parent changes `open`, show/hide the dialog (watch),
// and also once at the start in case it begins open (onMounted)
watch(() => props.open, sync)
onMounted(() => sync(props.open))

// Esc key or clicking the backdrop: tell the parent "cancel".
// preventDefault stops the browser closing it by itself, so the parent stays in control.
// While busy (e.g. deleting), cancelling is ignored.
function onCancel(event) {
  event.preventDefault()
  if (!props.busy) emit('cancel')
}
// A click on the dark area outside the box has the <dialog> itself as its target
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
      <button type="button" class="btn" :class="confirmClass" :disabled="busy" @click="emit('confirm')">
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
