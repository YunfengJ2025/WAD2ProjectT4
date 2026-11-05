// Arrange props/dependencies, act through the rendered controls,
// then assert observable output. Await trigger/setValue for Vue updates and
// flushPromises for async requests. Cleanup prevents state leaking between tests.
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { afterEach, expect, it } from 'vitest'
import PostCard from './PostCard.vue'
let wrapper
const photos = ['https://example.com/first.jpg', 'https://example.com/second.jpg']
async function open(postImages = photos) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/community', component: { template: '<p />' } },
      { path: '/community/:postId', component: { template: '<p />' } },
      { path: '/profile/:userId', component: { template: '<p />' } },
    ],
  })
  await router.push('/community')
  wrapper = mount(PostCard, {
    props: {
      post: { postId: 5, creatorId: 2, title: 'Garden', postImages },
      author: { userName: 'Neighbour' },
    },
    global: { plugins: [router], stubs: { LikeButton: true } },
  })
  await flushPromises()
  return router
}
afterEach(() => wrapper?.unmount())
// Each case exercises one user-visible behaviour; child styling is not asserted.
it('previews next and previous photos with wraparound without opening the post', async () => {
  const router = await open()
  await wrapper.get('[aria-label="Next photo for Garden"]').trigger('click')
  expect(wrapper.get('img').attributes('src')).toBe(photos[1])
  expect(wrapper.get('.community-photo-count').text()).toBe('2 / 2')
  expect(router.currentRoute.value.path).toBe('/community')
  await wrapper.get('[aria-label="Next photo for Garden"]').trigger('click')
  expect(wrapper.get('img').attributes('src')).toBe(photos[0])
  await wrapper.get('[aria-label="Previous photo for Garden"]').trigger('click')
  expect(wrapper.get('img').attributes('src')).toBe(photos[1])
  await wrapper.get('.post-card-photo-link').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/community/5')
})
// Each case exercises one user-visible behaviour; child styling is not asserted.
it('supports dot selection and keyboard arrows with an announced selected state', async () => {
  await open()
  const second = wrapper.get('[aria-label="Preview photo 2 for Garden"]')
  await second.trigger('click')
  expect(second.attributes('aria-pressed')).toBe('true')
  await wrapper.get('.post-card-cover').trigger('keydown', { key: 'ArrowLeft' })
  expect(wrapper.get('img').attributes('src')).toBe(photos[0])
  expect(second.attributes('aria-pressed')).toBe('false')
})
// Each case exercises one user-visible behaviour; child styling is not asserted.
it('keeps the title fallback navigable and can leave a broken photo preview', async () => {
  await open()
  await wrapper.get('img').trigger('error')
  expect(wrapper.get('.post-card-text').text()).toBe('Garden')
  await wrapper.get('[aria-label="Next photo for Garden"]').trigger('click')
  expect(wrapper.get('img').attributes('src')).toBe(photos[1])
})
// Each case exercises one user-visible behaviour; child styling is not asserted.
it('does not show preview controls on single-photo or text-only posts', async () => {
  await open([photos[0]])
  expect(wrapper.find('.post-preview-dots').exists()).toBe(false)
  await wrapper.setProps({ post: { postId: 6, creatorId: 2, title: 'No photo', postImages: [] } })
  expect(wrapper.find('.post-preview-arrow').exists()).toBe(false)
  expect(wrapper.get('.post-card-text').text()).toBe('No photo')
})
