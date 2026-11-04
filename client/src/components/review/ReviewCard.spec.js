import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, it, expect, afterEach } from 'vitest'
import ReviewCard from './ReviewCard.vue'
let wrapper
const review = {
  reviewId: 1,
  type: 'POST',
  postId: 5,
  creatorId: 2,
  creatorName: 'Alice',
  comment: 'Lovely plant',
  createdAt: '2026-10-20',
}
afterEach(() => wrapper?.unmount())
async function open(props = {}) {
  // Memory history provides real navigation without opening a browser.
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<p />' } }],
  })
  await router.push('/')
  wrapper = mount(ReviewCard, {
    props: { review, ...props },
    global: {
      plugins: [router],
      stubs: { RouterLink: RouterLinkStub, StarRating: true, UserAvatar: true },
    },
  })
  return router
}
describe('ReviewCard', () => {
  it('renders the comment and navigates a summary to its related post', async () => {
    const router = await open()
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Lovely plant')
    await wrapper.get('article').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/community/5')
  })
  it('emits a trimmed reply only on an authenticated post discussion', async () => {
    await open({ source: 'post', canReply: true })
    await wrapper.get('button').trigger('click')
    await wrapper.get('textarea').setValue('  Thank you!  ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('reply')).toEqual([['Thank you!']])
    // A server-confirmed reply arrives through props and closes the draft form.
    await wrapper.setProps({ replies: [{ reviewId: 2, creatorName: 'Me', comment: 'Thank you!' }] })
    expect(wrapper.find('form').exists()).toBe(false)
  })
  it('blocks blank or busy reply submissions', async () => {
    await open({ source: 'post' })
    await wrapper.get('button').trigger('click')
    await wrapper.get('textarea').setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('reply')).toBeUndefined()
    await wrapper.get('textarea').setValue('Thanks')
    await wrapper.setProps({ busy: true })
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('reply')).toBeUndefined()
  })
  it('never offers replies for visits, replies, guests, or profile summaries', async () => {
    await open({ source: 'post', review: { ...review, type: 'VISIT', visitId: 3, rating: 5 } })
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.setProps({ review: { ...review, type: 'REVIEW' } })
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.setProps({ review, canReply: false })
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.setProps({ source: 'profile', canReply: true })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
