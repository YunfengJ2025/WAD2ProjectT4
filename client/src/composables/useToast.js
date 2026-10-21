import { reactive } from 'vue'

// Shared across the app so a toast survives a route change
// (e.g. "Plant added" after the form navigates back to My Plants).
const toasts = reactive([])
let nextId = 1

export function useToast() {
  function dismiss(id) {
    const i = toasts.findIndex((t) => t.id === id)
    if (i !== -1) toasts.splice(i, 1)
  }

  function show(message, type = 'success', ms = 3500) {
    const id = nextId++
    toasts.push({ id, message, type })
    setTimeout(() => dismiss(id), ms)
  }

  return { toasts, show, dismiss }
}
