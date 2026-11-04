// Integration tests mount the real page, children, Pinia stores, and memory router.
// Only network responses are fixtures; these are not real-backend E2E tests.
import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import ProfilePosts from '@/components/user/ProfilePosts.vue'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
import { createPostViewHarness, reply } from '@/test-utils/postViewHarness'

let wrapper
const { open } = createPostViewHarness((value) => {
  wrapper = value
})

it('shows recent own posts on the profile and links to all posts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply([{ postId: 5, creatorId: 3, title: 'My fern', content: 'Hello', postImages: [] }]),
    ),
  )
  await open(ProfilePosts)
  expect(fetch.mock.calls[0][0]).toBe('/api/post/me')
  expect(wrapper.text()).toContain('My fern')
  expect(wrapper.findAll('a').some((link) => link.attributes('href') === '/my-posts')).toBe(true)
})
