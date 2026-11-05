import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LandingPage from './landingpage.vue'

vi.mock('@/views/map/FindNearby.vue', () => ({ default: { template: '<div />' } }))
let wrapper
beforeEach(() => {
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn() })
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('allows signed-out visitors onto the landing page and protects the schedule', async () => {
  const { default: router } = await import('../router/index.js')
  await router.push('/')
  expect(router.currentRoute.value.name).toBe('home')
  expect(router.currentRoute.value.meta.requiresAuth).not.toBe(true)
  wrapper = mount(LandingPage, { global: { plugins: [router] } })
  await flushPromises()
  expect(wrapper.get('h1').attributes('aria-label')).toBe('Leaf It to Us')
  expect(wrapper.get('.hero-title').text()).toContain('Happy plants.')
  expect(wrapper.get('.galaxy-intro').findAll('a')).toHaveLength(1)
  expect(wrapper.get('.scroll-cue').text()).toBe('Scroll down')
  expect(wrapper.get('a[href="/register"]').exists()).toBe(true)
  expect(wrapper.find('.watering-demo').exists()).toBe(false)
  expect(wrapper.get('.signup-prompt').text()).toBe('Create your own digital garden now')
  await wrapper.get('button[aria-label="Next feature"]').trigger('click')
  expect(wrapper.findAll('.orbit-card h3')[1].text()).toBe('Find helpers to sit your plants')
  expect(wrapper.get('.showcase-copy h2').text()).toBe('Find helpers to sit your plants')
  expect(wrapper.find('.landing-header').exists()).toBe(false)
  expect(wrapper.find('.feature-options').exists()).toBe(false)
  expect(wrapper.get('.hero-actions a[href="/register"]').text()).toBe('Sign up')
  expect(wrapper.get('.hero-actions a[href="/signin"]').text()).toContain('Log in')
  await router.push('/schedule')
  expect(router.currentRoute.value.path).not.toBe('/schedule')
  expect(router.currentRoute.value.query.redirect).toBe('/schedule')
})

it('rotates features on a tree click, without responding to scroll', async () => {
  vi.stubGlobal('innerWidth', 1200)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  const callbacks = []
  const schedule = vi.fn((callback) => {
    callbacks.push(callback)
    return callbacks.length
  })
  vi.stubGlobal('requestAnimationFrame', schedule)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { default: router } = await import('../router/index.js')
  await router.push('/')
  wrapper = mount(LandingPage, { global: { plugins: [router] } })
  const card = wrapper.get('.orbit-card')
  const initialTransform = card.element.style.transform
  expect(initialTransform).toContain('translate')
  expect(schedule).not.toHaveBeenCalled()
  window.dispatchEvent(new Event('scroll'))
  await flushPromises()
  expect(card.element.style.transform).toBe(initialTransform)
  expect(schedule).not.toHaveBeenCalled()
  await wrapper.get('button[aria-label="Rotate features around the tree"]').trigger('click')
  callbacks.shift()(performance.now() + 1200)
  await flushPromises()
  expect(card.element.style.transform).not.toBe(initialTransform)
  expect(wrapper.findAll('.orbit-card')).toHaveLength(3)
  expect(wrapper.find('.garden-controls').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('Brush past')
})
