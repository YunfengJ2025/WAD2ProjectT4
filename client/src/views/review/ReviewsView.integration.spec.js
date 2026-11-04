// Integration boundary: real page, ReviewCard, StarRating, auth/review stores,
// HTTP helper, and router. Only fetch responses stand in for the backend.
import { flushPromises } from '@vue/test-utils'
import { it, expect, vi } from 'vitest'
import ReviewsView from './ReviewsView.vue'
import { createPostViewHarness, reply } from '@/test-utils/postViewHarness'
let wrapper
const { open } = createPostViewHarness((value) => {
  wrapper = value
})
it('loads authenticated feedback and navigates from the real related-post card', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply({
        reviews: [
          {
            reviewId: 1,
            type: 'VISIT',
            visitId: 7,
            creatorId: 2,
            receiverId: 3,
            creatorName: 'Alice',
            rating: 4,
            comment: 'Careful sitter',
            createdAt: '2026-11-01',
          },
          {
            reviewId: 2,
            type: 'VISIT',
            visitId: 8,
            creatorId: 2,
            receiverId: 3,
            creatorName: 'Alice',
            rating: 5,
            comment: 'Great care',
            createdAt: '2026-11-02',
          },
          {
            reviewId: 3,
            type: 'POST',
            postId: 5,
            creatorId: 2,
            receiverId: 3,
            creatorName: 'Alice',
            comment: 'Lovely leaf',
            createdAt: '2026-11-03',
          },
          {
            reviewId: 4,
            type: 'VISIT',
            visitId: 9,
            creatorId: 3,
            receiverId: 2,
            creatorName: 'Fern Friend',
            rating: 1,
            comment: 'My own feedback',
            createdAt: '2026-11-03',
          },
        ],
      }),
    ),
  )
  const router = await open(ReviewsView)
  expect(fetch.mock.calls[0][0]).toBe('/api/review/me')
  expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-token')
  expect(wrapper.get('[data-testid="average-rating"]').text()).toContain('4.5')
  expect(wrapper.findAll('.review-card')).toHaveLength(3)
  const postFilter = wrapper
    .findAll('button')
    .find((button) => button.attributes('aria-label') === 'Post comments')
  await postFilter.trigger('click')
  expect(wrapper.findAll('.review-card')).toHaveLength(1)
  await wrapper.get('.review-card .comment').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/community/5')
})
