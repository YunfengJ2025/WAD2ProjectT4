import { reactive } from 'vue'

// useToast: a composable (Week 11) for the small pop-up messages.
// Usage in any component:  const { show } = useToast();  show('Plant added')
// ToastHost.vue (in App.vue) displays the list.

// The list is created OUTSIDE the function, so every component that calls useToast()
// gets the SAME list. That's why a toast survives a route change
// (e.g. "Plant added" after the form navigates back to My Plants).
// reactive([]): like ref, but for an array/object we change in place (push/splice).
const toasts = reactive([])
let nextId = 1 // each toast gets a unique id, used as the v-for :key

export function useToast() {
  // Remove one toast (the × button, or automatically after a few seconds)
  function dismiss(id) {
    const i = toasts.findIndex((t) => t.id === id)
    if (i !== -1) toasts.splice(i, 1)
  }

  // Add a toast, then remove it after `ms` milliseconds (3.5 s by default).
  // type: 'success' (green), 'error' (red) or 'info'
  function show(message, type = 'success', ms = 3500) {
    const id = nextId++
    toasts.push({ id, message, type })
    setTimeout(() => dismiss(id), ms)
  }

  return { toasts, show, dismiss }
}
