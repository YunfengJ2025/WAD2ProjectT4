import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import LikeButton from './LikeButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
let wrapper
const post = { postId: 5, title: 'Fern', likedCount: 2 }
const response = (data) => ({ ok: true, status: 200, json: async () => data })
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})
async function open(initial = []) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.accessToken = 'token'
  auth.user = { userId: 2 }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(initial)))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/community', component: { template: '<p />' } },
      { path: '/signin', name: 'sign-in', component: { template: '<p />' } },
    ],
  })
  await router.push('/community')
  wrapper = mount(LikeButton, { props: { post }, global: { plugins: [pinia, router] } })
  await flushPromises()
  return { auth, router, likes: useLikesStore() }
}
it('loads persisted likes and toggles full and empty hearts using server counts', async () => {
  await open([{ ...post, liked: true }])
  expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
  fetch.mockResolvedValueOnce(response({ postId: 5, liked: false, likedCount: 1 }))
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(fetch.mock.calls[1][1].method).toBe('DELETE')
  expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
  expect(wrapper.text()).toBe('1')
  fetch.mockResolvedValueOnce(response({ postId: 5, liked: true, likedCount: 2 }))
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(fetch.mock.calls[2][1].method).toBe('POST')
  expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
})
it('blocks duplicate clicks and keeps state unchanged when a request fails', async () => {
  await open()
  let reject
  fetch.mockImplementationOnce(
    () =>
      new Promise((resolve, fail) => {
        reject = fail
      }),
  )
  await wrapper.get('button').trigger('click')
  await wrapper.get('button').trigger('click')
  expect(fetch).toHaveBeenCalledTimes(2)
  reject(new Error('Offline'))
  await flushPromises()
  expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
  expect(wrapper.get('[role="alert"]').text()).toContain('Could not reach the server')
})
it('clears liked posts on logout and sends guest clicks to sign in', async () => {
  const { auth, router, likes } = await open([{ ...post, liked: true }])
  auth.clearSession()
  await flushPromises()
  expect(likes.posts).toEqual([])
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.name).toBe('sign-in')
  expect(router.currentRoute.value.query.redirect).toBe('/community')
})
