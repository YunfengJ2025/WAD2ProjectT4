import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import ReviewsView from './ReviewsView.vue'
import ReviewCard from '@/components/review/ReviewCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useReviewsStore } from '@/stores/reviews'

const records = [
  {
    reviewId: 1,
    type: 'VISIT',
    visitId: 10,
    creatorId: 2,
    receiverId: 1,
    creatorName: 'Alice',
    receiverName: 'Me',
    rating: 4,
    comment: 'Carefully done',
    createdAt: '2026-10-20',
  },
  {
    reviewId: 2,
    type: 'VISIT',
    visitId: 10,
    creatorId: 1,
    receiverId: 2,
    creatorName: 'Me',
    receiverName: 'Alice',
    rating: 2,
    comment: 'My feedback',
    createdAt: '2026-10-21',
  },
  {
    reviewId: 3,
    type: 'POST',
    postId: 5,
    creatorId: 2,
    receiverId: 1,
    creatorName: 'Alice',
    receiverName: 'Me',
    comment: 'Lovely plant',
    createdAt: '2026-10-22',
  },
  {
    reviewId: 4,
    type: 'VISIT',
    visitId: 20,
    creatorId: 3,
    receiverId: 4,
    creatorName: 'Other',
    receiverName: 'Other user',
    rating: 1,
    comment: 'Unrelated',
    createdAt: '2026-10-23',
  },
]
let auth
let wrapper
beforeEach(() => {
  setActivePinia(createPinia())
  auth = useAuthStore()
  auth.accessToken = 'test-token'
  auth.user = { userId: 1, userName: 'Me' }
  vi.spyOn(auth, 'authorizedRequest').mockResolvedValue({
    reviews: records.map((item) => ({ ...item })),
  })
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
})

async function open() {
  wrapper = mount(ReviewsView, { global: { stubs: { RouterLink: RouterLinkStub } } })
  await flushPromises()
}
async function press(text) {
  await wrapper
    .findAll('button')
    .find((button) => (button.attributes('aria-label') || button.text()) === text)
    .trigger('click')
  await flushPromises()
}

describe('profile reviews', () => {
  it('shows the author photo, falls back on image errors, and uses live profile photos for our entries', async () => {
    auth.authorizedRequest.mockResolvedValueOnce({
      reviews: records.map((item) => ({
        ...item,
        creatorPhotoUrl: 'https://images.example/author.png',
      })),
    })
    await open()
    const card = wrapper.findAllComponents(ReviewCard)[0]
    expect(card.get('header img').attributes('src')).toBe('https://images.example/author.png')
    expect(card.get('header img').attributes('alt')).toBe("Alice's profile photo")
    await card.get('header img').trigger('error')
    expect(card.find('header img').exists()).toBe(false)
    expect(card.get('.user-avatar').text()).toBe('A')
    auth.user.photoUrl = 'https://images.example/my-new-photo.png'
    await press('Written by me')
    expect(wrapper.get('.review-card header img').attributes('src')).toBe(
      'https://images.example/my-new-photo.png',
    )
  })
  it('shows a half-star average and updates category counts for each direction', async () => {
    auth.authorizedRequest.mockResolvedValueOnce({
      reviews: [...records, { ...records[0], reviewId: 6, rating: 5 }],
    })
    await open()
    expect(wrapper.get('[data-testid="average-rating"]').text()).toBe('4.5')
    expect(
      wrapper
        .get('.review-rating-summary [aria-label="4.5 out of 5 stars"]')
        .findAll('.review-star-fill')
        .map((star) => star.element.style.width),
    ).toEqual(['100%', '100%', '100%', '100%', '50%'])
    expect(wrapper.get('[aria-label="Care visits"] .review-count').text()).toBe('2')
    await press('Written by me')
    expect(wrapper.get('[aria-label="Care visits"] .review-count').text()).toBe('1')
    await press('Care visits')
    expect(wrapper.get('[aria-label="Care visits"]').attributes('aria-pressed')).toBe('true')
  })

  it('loads the authenticated profile, excludes others, and averages received visits only', async () => {
    await open()
    expect(auth.authorizedRequest).toHaveBeenCalledWith('/review/me')
    expect(wrapper.findAllComponents(ReviewCard)).toHaveLength(2)
    expect(wrapper.get('[data-testid="average-rating"]').text()).toContain('4.0')
    expect(wrapper.text()).not.toContain('Unrelated')
    await press('Written by me')
    expect(wrapper.findAllComponents(ReviewCard)).toHaveLength(1)
    expect(wrapper.text()).toContain('My feedback')
  })
  it('filters and searches without changing the received rating', async () => {
    await open()
    await press('Post comments')
    expect(wrapper.findAllComponents(ReviewCard)).toHaveLength(1)
    await wrapper.get('#review-search').setValue('missing')
    expect(wrapper.text()).toContain('No matching reviews')
    expect(wrapper.get('[data-testid="average-rating"]').text()).toContain('4.0')
  })
  it('persists replies with the authorized API and never offers replies on visits', async () => {
    await open()
    const cards = wrapper.findAllComponents(ReviewCard)
    expect(
      cards
        .find((card) => card.props('review').type === 'VISIT')
        .find('.reply-button')
        .exists(),
    ).toBe(false)
    auth.authorizedRequest.mockResolvedValueOnce({
      reviewId: 5,
      type: 'REVIEW',
      parentReviewId: 3,
      creatorId: 1,
      receiverId: 2,
      comment: 'Thank you!',
      createdAt: '2026-10-24',
    })
    const card = cards.find((card) => card.props('review').type === 'POST')
    await card.get('.reply-button').trigger('click')
    await card.get('textarea').setValue('Thank you!')
    await card.get('form').trigger('submit')
    await flushPromises()
    expect(auth.authorizedRequest).toHaveBeenLastCalledWith(
      '/review/me/replies',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ parentReviewId: 3, comment: 'Thank you!' }),
      }),
    )
    expect(card.text()).toContain('Thank you!')
    expect(card.find('.reply .reply-button').exists()).toBe(false)
  })
  it('shows load errors and retries rather than displaying sample data', async () => {
    auth.authorizedRequest.mockRejectedValueOnce(new Error('Offline'))
    await open()
    expect(wrapper.get('[role="alert"]').text()).toContain('Offline')
    await press('Try again')
    expect(wrapper.findAllComponents(ReviewCard)).toHaveLength(2)
  })
  it('clears reviews on logout and discards a late response', async () => {
    let resolve
    auth.authorizedRequest.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    wrapper = mount(ReviewsView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    auth.clearSession()
    resolve({ reviews: records })
    await flushPromises()
    expect(useReviewsStore().reviews).toEqual([])
    expect(wrapper.text()).not.toContain('Carefully done')
  })
})
