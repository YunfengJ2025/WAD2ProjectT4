import { ref } from 'vue'

// Add mouse dragging to a native horizontal scroller while keeping taps and links usable.
export function useDragScroll(track) {
  const dragging = ref(false)
  let gesture = null
  let suppressClick = false
  function startDrag(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    suppressClick = false
    gesture = { id: event.pointerId, x: event.clientX, scroll: track.value.scrollLeft }
  }
  function moveDrag(event) {
    if (!gesture || event.pointerId !== gesture.id) return
    if (!dragging.value && Math.abs(event.clientX - gesture.x) > 6) {
      dragging.value = true
      track.value.setPointerCapture?.(event.pointerId)
    }
    if (dragging.value) track.value.scrollLeft = gesture.scroll - (event.clientX - gesture.x)
  }
  function stopDrag() {
    if (!gesture) return
    suppressClick = dragging.value
    gesture = null
    dragging.value = false
  }
  // A drag must scroll rather than accidentally opening the card under the cursor.
  function captureClick(event) {
    if (!suppressClick) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick = false
  }
  return { dragging, startDrag, moveDrag, stopDrag, captureClick }
}
