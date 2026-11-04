// Integration tests mount the real page, children, Pinia stores, and memory router.
// Only network responses are fixtures; these are not real-backend E2E tests.
import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import PostDetailView from './PostDetailView.vue'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
import { createPostViewHarness, reply } from '@/test-utils/postViewHarness'

let wrapper
const { open } = createPostViewHarness((value) => {
  wrapper = value
})

it('shows a large carousel, reviews and replies, and publishes a review', async () => {
  const post = {
    postId: 5,
    creatorId: 2,
    creatorName: 'Neighbour',
    content: 'My garden',
    postImages: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
    likedCount: 0,
  }
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(reply(post))
      .mockResolvedValueOnce(
        reply([
          { reviewId: 1, type: 'POST', creatorId: 4, comment: 'Beautiful!' },
          { reviewId: 2, type: 'REVIEW', creatorId: 2, parentReviewId: 1, comment: 'Thank you!' },
        ]),
      )
      .mockResolvedValueOnce(
        reply({ reviewId: 3, type: 'POST', creatorId: 3, comment: 'Love this' }),
      ),
  )
  await open(PostDetailView, '/community/5')
  expect(wrapper.text()).toContain('Beautiful!')
  expect(wrapper.text()).toContain('Thank you!')
  expect(
    wrapper.get('.post-gallery-slide[aria-hidden="false"] .post-gallery-photo').attributes('src'),
  ).toBe(post.postImages[0])
  await wrapper.get('[aria-label="Next photo"]').trigger('click')
  expect(
    wrapper.get('.post-gallery-slide[aria-hidden="false"] .post-gallery-photo').attributes('src'),
  ).toBe(post.postImages[1])
  await wrapper.get('[aria-label="Next photo"]').trigger('click')
  expect(
    wrapper.get('.post-gallery-slide[aria-hidden="false"] .post-gallery-photo').attributes('src'),
  ).toBe(post.postImages[0])
  await wrapper.get('#new-review').setValue('Love this')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(fetch.mock.calls[2][0]).toBe('/api/post/5/reviews')
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ comment: 'Love this' })
  expect(wrapper.text()).toContain('Love this')
  expect(wrapper.get('#new-review').element.value).toBe('')
})

it('supports single-photo posts without carousel controls', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        reply({
          postId: 5,
          creatorId: 2,
          content: 'Hello',
          postImages: ['https://example.com/old.jpg'],
        }),
      )
      .mockResolvedValueOnce(reply([])),
  )
  await open(PostDetailView, '/community/5')
  expect(
    wrapper.get('.post-gallery-slide[aria-hidden="false"] .post-gallery-photo').attributes('src'),
  ).toBe('https://example.com/old.jpg')
  expect(wrapper.find('[aria-label="Next photo"]').exists()).toBe(false)
})

it('swipes photos horizontally and ignores a primarily vertical gesture', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        reply({
          postId: 5,
          creatorId: 2,
          title: 'Garden',
          content: 'Hello',
          postImages: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
        }),
      )
      .mockResolvedValueOnce(reply([])),
  )
  await open(PostDetailView, '/community/5')
  const stage = wrapper.get('.community-gallery-stage')
  Object.defineProperty(stage.element, 'clientWidth', { value: 500 })
  async function pointer(type, values) {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, values)
    stage.element.dispatchEvent(event)
    await flushPromises()
  }
  await pointer('pointerdown', { pointerId: 1, clientX: 200, clientY: 20, button: 0 })
  await pointer('pointermove', { pointerId: 1, clientX: 50, clientY: 25 })
  // Both photos are already rendered; the track follows the pointer before release.
  expect(wrapper.findAll('.post-gallery-photo')).toHaveLength(4)
  expect(wrapper.get('.post-gallery-track').attributes('style')).toContain('-150px')
  expect(wrapper.get('.community-gallery-stage').classes()).toContain('photo-dragging')
  await pointer('pointerup', { pointerId: 1, clientX: 50, clientY: 25 })
  expect(wrapper.get('.post-gallery-track').attributes('style')).toContain('-200%')
  expect(wrapper.get('.post-gallery-track').attributes('style')).toContain('0px')
  expect(
    wrapper.get('.post-gallery-slide[aria-hidden="false"] .post-gallery-photo').attributes('src'),
  ).toBe('https://example.com/2.jpg')
  await pointer('pointerdown', { pointerId: 2, clientX: 200, clientY: 20, button: 0 })
  await pointer('pointermove', { pointerId: 2, clientX: 210, clientY: 120 })
  await pointer('pointerup', { pointerId: 2, clientX: 210, clientY: 120 })
  expect(
    wrapper.get('.post-gallery-slide[aria-hidden="false"] .post-gallery-photo').attributes('src'),
  ).toBe('https://example.com/2.jpg')
})

// Follow the emitted event from a real ReviewCard through the page, HTTP helper,
// mocked server response, and back into the rendered discussion.
it('persists a child reply and preserves a new-comment draft after a failed save', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        reply({ postId: 5, creatorId: 2, title: 'Fern', content: 'Hello', postImages: [] }),
      )
      .mockResolvedValueOnce(
        reply([
          { reviewId: 1, type: 'POST', creatorId: 2, creatorName: 'Alice', comment: 'Lovely' },
        ]),
      )
      .mockResolvedValueOnce(
        reply({ reviewId: 2, type: 'REVIEW', parentReviewId: 1, creatorId: 3, comment: 'Thanks!' }),
      )
      .mockResolvedValueOnce(reply({ message: 'Unavailable' }, false)),
  )
  await open(PostDetailView, '/community/5')
  await wrapper.get('.reply-button').trigger('click')
  await wrapper.get('.reply-form textarea').setValue('  Thanks!  ')
  await wrapper.get('.reply-form').trigger('submit')
  await flushPromises()
  expect(fetch.mock.calls[2][0]).toBe('/api/review/me/replies')
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ parentReviewId: 1, comment: 'Thanks!' })
  expect(wrapper.get('.replies').text()).toContain('Thanks!')
  expect(wrapper.find('.reply-form').exists()).toBe(false)
  await wrapper.get('#new-review').setValue('Keep this draft')
  await wrapper.get('.community-review-form').trigger('submit')
  await flushPromises()
  expect(wrapper.get('#new-review').element.value).toBe('Keep this draft')
  expect(wrapper.get('[role="alert"]').text()).toContain('Unavailable')
})
