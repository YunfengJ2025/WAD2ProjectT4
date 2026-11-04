import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import ReviewForm from './ReviewForm.vue'

const targets = [
  { key: 'visit', type: 'VISIT', title: 'Watering', receiverName: 'Alice' },
  { key: 'post', type: 'POST', title: 'New leaf' },
]
// Stub the child rating selector: these tests check the form, not star rendering.
const options = { props: { targets }, global: { stubs: { StarRating: true } } }
describe('ReviewForm', () => {
  it('rejects missing targets, visit ratings, and blank messages', async () => {
    const wrapper = mount(ReviewForm, options)
    // trigger submits directly in jsdom so we can check the component validation too.
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('Choose a visit or post')
    await wrapper.get('select').setValue('visit')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('star rating')
    wrapper.getComponent({ name: 'StarRating' }).vm.$emit('update:modelValue', 5)
    await wrapper.get('textarea').setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('short message')
    expect(wrapper.emitted('submit')).toBeUndefined()
    wrapper.unmount()
  })
  it('emits a trimmed visit review using the child rating event', async () => {
    const wrapper = mount(ReviewForm, options)
    await wrapper.get('select').setValue('visit')
    wrapper.getComponent({ name: 'StarRating' }).vm.$emit('update:modelValue', 4)
    await wrapper.get('textarea').setValue('  Thanks!  ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')[0]).toEqual([
      { target: targets[0], rating: 4, comment: 'Thanks!' },
    ])
    wrapper.unmount()
  })
  it('submits post comments without ratings and emits cancellation', async () => {
    const wrapper = mount(ReviewForm, options)
    await wrapper.get('select').setValue('post')
    expect(wrapper.findComponent({ name: 'StarRating' }).exists()).toBe(false)
    await wrapper.get('textarea').setValue('Lovely leaf')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')[0][0].rating).toBe(null)
    await wrapper.get('button[type="button"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })
})
