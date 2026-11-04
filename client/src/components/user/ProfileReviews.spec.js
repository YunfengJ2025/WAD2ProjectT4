import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, it, expect, afterEach, vi } from 'vitest'
import ProfileReviews from './ProfileReviews.vue'
import { useAuthStore } from '@/stores/auth'
import { useReviewsStore } from '@/stores/reviews'
let wrapper
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  sessionStorage.clear()
})
function open() {
  const pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.user = { userId: 1, userName: 'Me' }
  const store = useReviewsStore(pinia)
  // Isolate the parent: the store supplies data and the child echoes its comment prop.
  vi.spyOn(store, 'fetchReviews').mockResolvedValue()
  wrapper = mount(ProfileReviews, {
    global: {
      plugins: [pinia],
      stubs: {
        RouterLink: RouterLinkStub,
        ReviewCard: {
          props: ['review'],
          template: '<p data-testid="review-summary">{{ review.comment }}</p>',
        },
      },
    },
  })
  return store
}
describe('ProfileReviews', () => {
  it('selects six newest received reviews and links to the full page', async () => {
    const store = open()
    store.reviews = Array.from({ length: 8 }, (_, i) => ({
      reviewId: i + 1,
      receiverId: 1,
      type: 'VISIT',
      comment: 'Review ' + (i + 1),
      createdAt: '2026-10-' + String(i + 1).padStart(2, '0'),
    }))
    store.reviews.push({ reviewId: 99, receiverId: 2, comment: 'Not mine' })
    await flushPromises()
    const summaries = wrapper.findAll('[data-testid="review-summary"]')
    expect(summaries).toHaveLength(6)
    expect(summaries[0].text()).toBe('Review 8')
    expect(summaries[5].text()).toBe('Review 3')
    expect(wrapper.text()).not.toContain('Not mine')
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toBe('/reviews')
  })
  it('shows loading, failure, retry, and empty states', async () => {
    const store = open()
    store.loading = true
    await flushPromises()
    expect(wrapper.text()).toContain('Loading your reviews')
    store.loading = false
    store.error = 'Reviews unavailable'
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Reviews unavailable')
    // Reset the spy after mount so only the user's retry is counted.
    store.fetchReviews.mockClear()
    await wrapper.get('button').trigger('click')
    expect(store.fetchReviews).toHaveBeenCalledTimes(1)
    store.error = ''
    await flushPromises()
    expect(wrapper.text()).toContain('No reviews received yet')
  })
})
