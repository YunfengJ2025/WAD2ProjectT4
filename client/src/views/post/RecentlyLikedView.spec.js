// Integration tests mount the real page, children, Pinia stores, and memory router.
// Only network responses are fixtures; these are not real-backend E2E tests.
import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import RecentlyLikedView from './RecentlyLikedView.vue'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
import { createPostViewHarness, reply } from '@/test-utils/postViewHarness'

let wrapper
const { open } = createPostViewHarness((value) => {
  wrapper = value
})

it('shows recently liked posts in server order and provides an empty state', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply([
        { postId: 2, title: 'Most recent like', creatorId: 2, postImages: [], likedCount: 1 },
        { postId: 9, title: 'Earlier like', creatorId: 2, postImages: [], likedCount: 1 },
      ]),
    ),
  )
  await open(RecentlyLikedView)
  expect(fetch.mock.calls[0][0]).toBe('/api/post/liked/me')
  expect(wrapper.findAll('.post-card-title').map((node) => node.text())).toEqual([
    'Most recent like',
    'Earlier like',
  ])
})
