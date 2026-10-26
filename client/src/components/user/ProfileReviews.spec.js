import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import ProfileReviews from './ProfileReviews.vue'
import { useAuthStore } from '@/stores/auth'

let wrapper
let pinia
const reviews = Array.from({ length: 8 }, (_, index) => ({
  reviewId: index + 1, receiverId: 1, creatorId: 2, creatorName: `Neighbour ${index + 1}`,
  type: 'VISIT', rating: 5, comment: `Review ${index + 1}`,
  createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
}))
const response = (items) => ({ ok: true, status: 200, json: async () => ({ reviews: items }) })
beforeEach(() => {
  sessionStorage.clear()
  pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.accessToken = 'token'
  auth.user = { userId: 1, userName: 'Gardener' }
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })
function mountSection() {
  wrapper = mount(ProfileReviews, { global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } } })
}

it('shows the six newest received reviews in one row and links to the reviews page', async () => {
  fetch.mockResolvedValueOnce(response([...reviews, { ...reviews[0], reviewId: 99, receiverId: 2 }]))
  mountSection()
  await flushPromises()
  const cards = wrapper.findAll('.review-preview')
  expect(cards).toHaveLength(6)
  expect(cards[0].text()).toContain('Review 8')
  expect(cards[5].text()).toContain('Review 3')
  expect(wrapper.text()).toContain('Showing 6 of 8')
  expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe('/reviews')
  expect(fetch.mock.calls[0][0]).toBe('/api/review/me')
})

it('shows loading, error and empty states and allows retry', async () => {
  let resolve
  fetch.mockImplementationOnce(() => new Promise((finish) => { resolve = finish }))
  mountSection()
  expect(wrapper.get('[role="status"]').text()).toContain('Loading')
  resolve({ ok: false, status: 500, json: async () => ({ message: 'Reviews unavailable' }) })
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Reviews unavailable')
  fetch.mockResolvedValueOnce(response([]))
  await wrapper.get('.retry-button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('No reviews received yet')
  expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe('/reviews')
})

it('uses each review author photo and falls back to their initial for missing or broken photos', async () => {
  fetch.mockResolvedValueOnce(response([
    { ...reviews[7], creatorPhotoUrl: 'https://images.example/author.png' },
    { ...reviews[6], creatorPhotoUrl: '' },
  ]))
  mountSection()
  await flushPromises()
  const cards = wrapper.findAll('.review-preview')
  expect(cards[0].get('img').attributes('src')).toBe('https://images.example/author.png')
  expect(cards[0].get('img').attributes('alt')).toBe("Neighbour 8's profile photo")
  expect(cards[0].get('img').attributes('draggable')).toBe('false')
  expect(cards[1].find('img').exists()).toBe(false)
  expect(cards[1].get('.user-avatar').text()).toBe('N')
  await cards[0].get('img').trigger('error')
  expect(cards[0].find('img').exists()).toBe(false)
  expect(cards[0].get('.user-avatar').text()).toBe('N')
})

it('scrolls with mouse dragging and keyboard or arrow controls', async () => {
  fetch.mockResolvedValueOnce(response(reviews))
  mountSection()
  await flushPromises()
  const track = wrapper.get('.reviews-track').element
  track.setPointerCapture = vi.fn()
  track.scrollBy = vi.fn()
  Object.defineProperty(track, 'clientWidth', { value: 600 })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  function pointer(type, x) {
    const event = new Event(type)
    Object.assign(event, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: x })
    track.dispatchEvent(event)
  }
  pointer('pointerdown', 300)
  pointer('pointermove', 100)
  expect(track.scrollLeft).toBe(200)
  pointer('pointerup', 100)
  await wrapper.get('[aria-label="Next reviews"]').trigger('click')
  expect(track.scrollBy).toHaveBeenLastCalledWith({ left: 510, behavior: 'instant' })
  await wrapper.get('.reviews-track').trigger('keydown', { key: 'ArrowLeft' })
  expect(track.scrollBy).toHaveBeenLastCalledWith({ left: -510, behavior: 'instant' })
})
