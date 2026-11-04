import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, it, expect, afterEach, vi } from 'vitest'
import LikeButton from './LikeButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
let wrapper
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  sessionStorage.clear()
})
async function open(signedIn = true) {
  const pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.accessToken = signedIn ? 'token' : ''
  auth.user = signedIn ? { userId: 1 } : null
  const likes = useLikesStore(pinia)
  likes.loaded = true
  likes.states = { 5: { liked: false, likedCount: 2 } }
  // Store actions are dependencies. HTTP persistence is tested at integration level.
  vi.spyOn(likes, 'fetchLikes').mockResolvedValue()
  vi.spyOn(likes, 'toggle').mockImplementation(async () => {
    const old = likes.states[5]
    likes.states[5] = { liked: !old.liked, likedCount: old.liked ? 2 : 3 }
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/community', component: { template: '<p />' } },
      { path: '/signin', name: 'sign-in', component: { template: '<p />' } },
    ],
  })
  await router.push('/community')
  wrapper = mount(LikeButton, {
    props: { post: { postId: 5, title: 'Fern', likedCount: 2 } },
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  return { likes, router }
}
describe('LikeButton', () => {
  it('updates its accessible selected state and count after liking and unliking', async () => {
    const { likes } = await open()
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(likes.toggle).toHaveBeenCalledWith(expect.objectContaining({ postId: 5 }))
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button').text()).toBe('3')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('button').text()).toBe('2')
  })
  it('disables pending requests and displays failure without changing the count', async () => {
    const { likes } = await open()
    likes.pending = { 5: true }
    await flushPromises()
    expect(wrapper.get('button').element.disabled).toBe(true)
    likes.pending = {}
    likes.toggle.mockRejectedValueOnce(new Error('Unable to like this post'))
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Unable to like')
    expect(wrapper.get('button').text()).toBe('2')
  })
  it('redirects guests to sign in and preserves their return address', async () => {
    const { router, likes } = await open(false)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('sign-in')
    expect(router.currentRoute.value.query.redirect).toBe('/community')
    expect(likes.toggle).not.toHaveBeenCalled()
  })
})
