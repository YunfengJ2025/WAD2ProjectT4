import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useDragScroll } from './useDragScroll'

it('keeps clicks intact and captures only an actual mouse drag', () => {
  const track = ref({ scrollLeft: 0, setPointerCapture: vi.fn() })
  const drag = useDragScroll(track)
  drag.startDrag({ pointerType: 'mouse', button: 0, pointerId: 1, clientX: 200 })
  drag.stopDrag()
  const click = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
  drag.captureClick(click)
  expect(click.preventDefault).not.toHaveBeenCalled()
  expect(track.value.setPointerCapture).not.toHaveBeenCalled()
  drag.startDrag({ pointerType: 'mouse', button: 0, pointerId: 2, clientX: 200 })
  drag.moveDrag({ pointerId: 2, clientX: 100 })
  expect(track.value.scrollLeft).toBe(100)
  expect(track.value.setPointerCapture).toHaveBeenCalledWith(2)
  drag.stopDrag()
  drag.captureClick(click)
  expect(click.preventDefault).toHaveBeenCalledOnce()
  expect(click.stopPropagation).toHaveBeenCalledOnce()
})
