import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import PostDraftPreview from './PostDraftPreview.vue'

const photos = ['first', 'second', 'third'].map((key) => ({ key, url: `/${key}.jpg`, alt: key }))
const current = (wrapper) => wrapper.get('.composer-draft-cover > img').attributes('src')

// Pointer events exercise swipe behaviour without needing a real touch screen.
async function pointer(stage, type, x, y) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { pointerId: 1, clientX: x, clientY: y, button: 0 })
  stage.element.dispatchEvent(event)
  await nextTick() // Wait for Vue to render the pointer event's state changes.
}

describe('draft photo navigation', () => {
  it('wraps arrow navigation and keeps keyboard and thumbnails in sync', async () => {
    const wrapper = mount(PostDraftPreview, { props: { photos } })
    await wrapper.get('[aria-label="Previous preview photo"]').trigger('click')
    expect(current(wrapper)).toBe('/third.jpg')
    await wrapper.get('[aria-label="Next preview photo"]').trigger('click')
    expect(current(wrapper)).toBe('/first.jpg')
    await wrapper.get('.composer-draft-cover').trigger('keydown', { key: 'ArrowRight' })
    expect(current(wrapper)).toBe('/second.jpg')
    expect(wrapper.get('[aria-label="Preview photo 2"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[aria-label="Preview photo 3"]').trigger('click')
    expect(current(wrapper)).toBe('/third.jpg')
    wrapper.unmount()
  })

  it('swipes horizontally, preserves vertical scrolling, and cancels interrupted drags', async () => {
    const wrapper = mount(PostDraftPreview, { props: { photos } })
    const stage = wrapper.get('.composer-draft-cover')
    Object.defineProperty(stage.element, 'clientWidth', { value: 400 })
    await pointer(stage, 'pointerdown', 250, 100)
    await pointer(stage, 'pointermove', 100, 105)
    expect(wrapper.get('.composer-draft-cover > img').attributes('style')).toContain('-150px')
    await pointer(stage, 'pointerup', 100, 105)
    expect(current(wrapper)).toBe('/second.jpg')
    await pointer(stage, 'pointerdown', 200, 100)
    await pointer(stage, 'pointermove', 205, 200)
    await pointer(stage, 'pointerup', 205, 200)
    expect(current(wrapper)).toBe('/second.jpg')
    await pointer(stage, 'pointerdown', 250, 100)
    await pointer(stage, 'pointermove', 100, 100)
    await pointer(stage, 'pointercancel', 100, 100)
    await pointer(stage, 'pointerup', 100, 100)
    expect(current(wrapper)).toBe('/second.jpg')
    wrapper.unmount()
  })

  it('returns to the cover when the selected photo is removed and hides arrows for one photo', async () => {
    const wrapper = mount(PostDraftPreview, { props: { photos } })
    await wrapper.get('[aria-label="Next preview photo"]').trigger('click')
    await wrapper.setProps({ photos: [photos[0]] })
    expect(current(wrapper)).toBe('/first.jpg')
    expect(wrapper.find('.composer-preview-arrow').exists()).toBe(false)
    await wrapper.setProps({ photos: [] })
    expect(wrapper.find('.composer-draft-cover > img').exists()).toBe(false)
    wrapper.unmount()
  })
})
