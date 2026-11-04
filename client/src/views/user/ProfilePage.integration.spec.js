// Full profile composition: real profile sections, cards, store actions, and HTTP helper.
import { flushPromises } from '@vue/test-utils'
import { it, expect, vi } from 'vitest'
import ProfileView from './ProfileView.vue'
import { createPostViewHarness, reply } from '@/test-utils/postViewHarness'
let wrapper
const { open } = createPostViewHarness((value) => {
  wrapper = value
})
it('loads profile details, recent posts, and received reviews together', async () => {
  const user = {
    userId: 3,
    userName: 'Fern Friend',
    email: 'fern@example.com',
    block: '123',
    unitNumber: '#01-01',
    postalCode: '123456',
    tokenBalance: 50,
    photoUrl: '/old.png',
  }
  // Route by URL rather than call order: independent profile sections load concurrently.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (url === '/api/user/me') return reply({ user })
      if (url === '/api/post/me')
        return reply([
          { postId: 5, creatorId: 3, title: 'My fern', content: 'New leaf', postImages: [] },
        ])
      if (url === '/api/review/me')
        return reply({
          reviews: [
            {
              reviewId: 1,
              creatorId: 2,
              receiverId: 3,
              creatorName: 'Alice',
              type: 'VISIT',
              visitId: 7,
              rating: 5,
              comment: 'Carefully done',
              createdAt: '2026-11-01',
            },
          ],
        })
      throw new Error('Unexpected API request: ' + url)
    }),
  )
  await open(ProfileView)
  await flushPromises()
  expect(wrapper.text()).toContain('fern@example.com')
  expect(wrapper.get('#profile-posts').text()).toContain('My fern')
  expect(wrapper.get('#profile-reviews').text()).toContain('Carefully done')
  // A successful edit must update shared Pinia data AND the real child post identity.
  await wrapper.get('.edit-button').trigger('click')
  await wrapper.get('#userName').setValue('New Gardener')
  fetch.mockResolvedValueOnce(reply({ user: { ...user, userName: 'New Gardener' } }))
  await wrapper
    .get('#userName')
    .element.closest('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flushPromises()
  expect(wrapper.get('#profile-posts .post-card-author').text()).toContain('New Gardener')
})
