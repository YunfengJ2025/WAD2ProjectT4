import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import AuthView from './AuthView.vue'
import NotFoundView from './NotFoundView.vue'
import App from '@/App.vue'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

// These tests exercise the real route table and guards, not map/schedule rendering.
vi.mock('@/views/map/FindNearby.vue', () => ({ default: { template: '<p>Map</p>' } }))
vi.mock('@/views/WateringSchedView.vue', () => ({ default: { template: '<p>Schedule</p>' } }))
let wrapper
let pinia
let auth
beforeEach(() => {
  sessionStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  auth = useAuthStore()
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear() })

async function signIn(query = {}) {
  await router.push({ name: 'sign-in', query })
  // The auth API boundary is controlled; routing after successful login is real.
  vi.spyOn(auth, 'login').mockImplementation(async () => {
    auth.accessToken = 'token'
    auth.user = { userId: 1, userName: 'Gardener' }
  })
  wrapper = mount(AuthView, { global: { plugins: [pinia, router] } })
  await wrapper.get('#email').setValue('gardener@example.com')
  await wrapper.get('#password').setValue('password123')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  // Lazy route imports may finish after the request microtasks have settled.
  await vi.waitFor(() => expect(router.currentRoute.value.name).not.toBe('sign-in'))
}

it('lands on the schedule after a normal login', async () => {
  await signIn()
  expect(router.currentRoute.value.path).toBe('/schedule')
})

it('preserves a protected-page destination instead of forcing the schedule', async () => {
  await signIn({ redirect: '/my-posts' })
  expect(router.currentRoute.value.path).toBe('/my-posts')
})

it('ignores an external redirect and falls back to the schedule', async () => {
  await signIn({ redirect: '//example.com' })
  expect(router.currentRoute.value.path).toBe('/schedule')
})

it('sends already signed-in users away from the auth page to the schedule', async () => {
  auth.accessToken = 'token'
  auth.user = { userId: 1 }
  await router.push('/register')
  expect(router.currentRoute.value.name).toBe('schedule')
})

it('shows a public not-found page for unknown nested URLs with recovery navigation', async () => {
  await router.push('/unknown/deep/page')
  expect(router.currentRoute.value.name).toBe('not-found')
  expect(router.currentRoute.value.meta.requiresAuth).not.toBe(true)
  wrapper = mount(NotFoundView, { global: { plugins: [pinia, router] } })
  expect(wrapper.get('h1').text()).toBe('Page not found')
  expect(wrapper.get('a').attributes('href')).toBe('/')
  auth.accessToken = 'token'
  auth.user = { userId: 1 }
  await flushPromises()
  expect(wrapper.get('a').attributes('href')).toBe('/schedule')
})

it.each(['/schedule', '/unknown/after-refresh'])('shows the tree while restoring the session for %s', async (path) => {
  await router.push('/signin')
  auth.accessToken = 'saved-token'
  // Hold the response so the intermediate loading state can be tested reliably.
  let finish
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve })))
  const navigation = router.push(path)
  await vi.waitFor(() => expect(auth.isRestoring).toBe(true))
  wrapper = mount(App, { global: { plugins: [pinia, router], stubs: { NavBar: true } } })
  await flushPromises()
  expect(wrapper.get('.app-loading [role="status"]').text()).toContain('Getting your garden ready')
  expect(wrapper.find('.loading-tree').exists()).toBe(true)
  finish({ ok: true, status: 200, json: async () => ({ user: { userId: 1, userName: 'Gardener' } }) })
  await navigation
  await flushPromises()
  expect(auth.isRestoring).toBe(false)
  expect(wrapper.find('.app-loading').exists()).toBe(false)
  expect(wrapper.text()).toContain(path === '/schedule' ? 'Schedule' : 'Page not found')
})

it('clears restoration loading even when the saved session has expired', async () => {
  auth.accessToken = 'expired-token'
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ message: 'Expired token' }) })))
  await expect(auth.restoreSession()).rejects.toThrow('Expired token')
  expect(auth.isRestoring).toBe(false)
  expect(auth.isAuthenticated).toBe(false)
})

it.each(['/plants', '/requests', '/find-nearby'])('sends signed-out visitors from %s to home', async (path) => {
  await router.push(path)
  expect(router.currentRoute.value.path).toBe('/')
  expect(router.currentRoute.value.query).toEqual({})
})

it('returns home when an expired saved session is restored on a protected page', async () => {
  await router.push('/signin')
  auth.accessToken = 'expired-token'
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ message: 'Expired token' }) })))
  await router.push('/schedule')
  expect(router.currentRoute.value.path).toBe('/')
  expect(auth.accessToken).toBe('')
})
