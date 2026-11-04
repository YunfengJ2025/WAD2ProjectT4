import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import StarRating from './StarRating.vue'

// Rating is supplied as a prop; selection is returned through an emitted event.
describe('StarRating', () => {
  it('announces fractional ratings and renders four full stars plus a half star', () => {
    const wrapper = mount(StarRating, { props: { modelValue: 4.5, readonly: true } })
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('4.5 out of 5 stars')
    // This style assertion is intentional: fractional fill IS the rating's visual output.
    expect(wrapper.findAll('.review-star-fill').map((star) => star.element.style.width)).toEqual([
      '100%',
      '100%',
      '100%',
      '100%',
      '50%',
    ])
    expect(wrapper.find('input').exists()).toBe(false)
    wrapper.unmount()
  })
  it('emits a selected rating and responds to updated props', async () => {
    const wrapper = mount(StarRating, { props: { modelValue: 2 } })
    await wrapper.get('input[aria-label="5 stars"]').setValue(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[5]])
    // v-model belongs to the parent, so simulate the parent passing its new value.
    await wrapper.setProps({ modelValue: 5 })
    expect(wrapper.get('input[aria-label="5 stars"]').element.checked).toBe(true)
    wrapper.unmount()
  })
})
