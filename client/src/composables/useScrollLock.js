import { watch, onBeforeUnmount } from 'vue'

// Stops the page behind a pop-up from scrolling while the pop-up is open.
//
//   const open = ref(false)
//   useScrollLock(open)   // page can't scroll while open.value is true
//
// A counter is kept so two pop-ups open at once don't unlock the page too early.
let openCount = 0

function lock() {
  openCount++
  document.body.style.overflow = 'hidden'
}

function unlock() {
  openCount = Math.max(0, openCount - 1)
  if (openCount === 0) document.body.style.overflow = ''
}

export function useScrollLock(isOpen) {
  let locked = false

  watch(
    isOpen,
    (open) => {
      if (open && !locked) lock()
      if (!open && locked) unlock()
      locked = !!open
    },
    { immediate: true },
  )

  // Leaving the page while a pop-up is open must not leave the page stuck
  onBeforeUnmount(() => {
    if (locked) unlock()
    locked = false
  })
}
