// Integration tests mount the real page, children, Pinia stores, and memory router.
// Only network responses are fixtures; these are not real-backend E2E tests.
import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import CommunityView from './CommunityView.vue'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
import { createPostViewHarness, reply } from '@/test-utils/postViewHarness'
// The leaderboard is unrelated to these feed journeys; keep its API offline.
vi.mock('axios', () => ({ default: { get: vi.fn(async () => ({ data: { leaderboard: [] } })) } }))

let wrapper
const { open } = createPostViewHarness((value) => {
  wrapper = value
})

it('loads all posts newest first and links the plus button to create post', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply([
        { postId: 1, creatorId: 2, content: 'Older update', likedCount: 0 },
        {
          postId: 2,
          creatorId: 3,
          content: 'A new leaf!',
          title: 'Leaf',
          postImages: ['https://example.com/leaf.jpg'],
          likedCount: 1,
        },
      ]),
    ),
  )
  await open(CommunityView)
  expect(fetch.mock.calls[0][0]).toBe('/api/post')
  expect(wrapper.findAll('article')).toHaveLength(2)
  expect(wrapper.findAll('article')[0].text()).toContain('Leaf')
  expect(wrapper.findAll('article')[0].text()).toContain('Fern Friend')
  expect(wrapper.get('[aria-label="Create a post"]').attributes('href')).toBe('/community/new')
  expect(wrapper.get('.community-post-image').attributes('src')).toBe(
    'https://example.com/leaf.jpg',
  )
})

it('offers retry after a feed error and then shows the empty state', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(reply({ message: 'Unavailable' }, false))
      .mockResolvedValueOnce(reply([])),
  )
  await open(CommunityView)
  expect(wrapper.get('[role="alert"]').text()).toContain('Unavailable')
  await wrapper.get('[role="alert"] button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('Every community starts with a hello')
})

it('shows the title in a card without photos and links avatars to profiles', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply([
        {
          postId: 7,
          creatorId: 2,
          title: 'Growing without a photo',
          postImages: [],
          content: 'Body',
          likedCount: 0,
        },
      ]),
    ),
  )
  await open(CommunityView)
  expect(wrapper.get('.post-card-text').text()).toBe('Growing without a photo')
  expect(wrapper.get('.post-card-link').attributes('href')).toBe('/community/7')
  expect(wrapper.get('.post-card-author').attributes('href')).toBe('/profile/2')
})

it('combines case-insensitive search with the liked filter, then clears them', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply([
        { postId: 3, creatorId: 3, title: 'Fern care', content: 'Watering advice', postImages: [] },
        {
          postId: 2,
          creatorId: 2,
          title: 'New leaves',
          content: 'My FERN is growing',
          postImages: [],
        },
        { postId: 1, creatorId: 2, title: 'Orchid', content: 'Flowers', postImages: [] },
      ]),
    ),
  )
  await open(CommunityView)
  await wrapper.get('#community-search').setValue(' FERN ')
  expect(wrapper.findAll('.post-card')).toHaveLength(2)
  const filter = (label) =>
    wrapper.findAll('.community-filters button').find((button) => button.text() === label)
  const likes = useLikesStore()
  likes.loaded = true
  likes.states = { 2: { liked: true, likedCount: 1 } }
  await filter('Liked').trigger('click')
  expect(wrapper.get('.post-card-title').text()).toBe('New leaves')
  likes.states[2] = { liked: false, likedCount: 0 }
  await flushPromises()
  expect(wrapper.text()).toContain('No matching posts')
  await wrapper.get('.community-clear').trigger('click')
  expect(wrapper.get('#community-search').element.value).toBe('')
  expect(wrapper.findAll('.post-card')).toHaveLength(3)
})

it('disables personal filters for guests and resets private selection on logout', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => reply([{ postId: 1, creatorId: 3, title: 'Fern', content: 'Hello' }])),
  )
  await open(CommunityView)
  const buttons = wrapper.findAll('.community-filters button')
  await buttons[1].trigger('click')
  useAuthStore().clearSession()
  await flushPromises()
  expect(buttons[0].attributes('aria-pressed')).toBe('true')
  expect(buttons[1].element.disabled).toBe(true)
})

it('sorts by creation order and likes, retaining search and filter constraints', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply([
        { postId: 1, creatorId: 3, title: 'Fern A', content: '', likedCount: 5 },
        { postId: 3, creatorId: 3, title: 'Fern C', content: '', likedCount: 5 },
        { postId: 2, creatorId: 2, title: 'Orchid', content: '', likedCount: 9 },
        { postId: 4, creatorId: 3, title: 'Fern D', content: '' },
      ]),
    ),
  )
  await open(CommunityView)
  const titles = () => wrapper.findAll('.post-card-title').map((card) => card.text())
  expect(titles()).toEqual(['Fern D', 'Fern C', 'Orchid', 'Fern A'])
  expect(wrapper.get('#community-sort option:checked').text()).toBe('✓ Newest first')
  await wrapper.get('#community-sort').setValue('oldest')
  expect(wrapper.get('#community-sort option:checked').text()).toBe('✓ Oldest first')
  expect(titles()).toEqual(['Fern A', 'Orchid', 'Fern C', 'Fern D'])
  await wrapper.get('#community-sort').setValue('most-liked')
  expect(titles()).toEqual(['Orchid', 'Fern C', 'Fern A', 'Fern D'])
  expect(wrapper.get('#community-sort option:checked').text()).toBe('✓ Most liked')
  expect(
    wrapper.findAll('#community-sort option').filter((option) => option.text().startsWith('✓')),
  ).toHaveLength(1)
  await wrapper.get('#community-sort').setValue('least-liked')
  expect(titles()).toEqual(['Fern D', 'Fern C', 'Fern A', 'Orchid'])
  await wrapper.get('#community-search').setValue('Fern')
  await wrapper.get('#community-sort').setValue('most-liked')
  expect(titles()).toEqual(['Fern C', 'Fern A', 'Fern D'])
  const likes = useLikesStore()
  likes.states[1] = { liked: true, likedCount: 10 }
  await flushPromises()
  expect(titles()).toEqual(['Fern A', 'Fern C', 'Fern D'])
  likes.loaded = true
  await wrapper
    .findAll('.community-filters button')
    .find((button) => button.text() === 'Liked')
    .trigger('click')
  expect(titles()).toEqual(['Fern A'])
})

// Clicking the real child heart must update the real shared store and the feed filter.
it('keeps the feed and liked filter in sync after a confirmed like', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        reply([
          {
            postId: 5,
            creatorId: 2,
            title: 'Fern',
            content: 'Hello',
            postImages: [],
            likedCount: 0,
          },
        ]),
      )
      .mockResolvedValueOnce(reply({ postId: 5, liked: true, likedCount: 1 })),
  )
  await open(CommunityView)
  await wrapper.get('[aria-label="Like post: Fern"]').trigger('click')
  await flushPromises()
  expect(fetch.mock.calls[1][0]).toBe('/api/post/5/like')
  expect(wrapper.get('[aria-label="Unlike post: Fern"]').attributes('aria-pressed')).toBe('true')
  await wrapper
    .findAll('.community-filters button')
    .find((button) => button.text() === 'Liked')
    .trigger('click')
  expect(wrapper.findAll('.post-card')).toHaveLength(1)
  expect(wrapper.get('.post-card-title').text()).toBe('Fern')
})

// Management navigation leaves the feed rather than changing its search results.
it('opens My Posts through its button-style link instead of offering an own-post filter', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => reply([])))
  const router = await open(CommunityView)
  expect(wrapper.findAll('.community-filters button').map(button => button.text())).toEqual(['All posts', 'Liked'])
  const link = wrapper.get('a[href="/my-posts"]')
  expect(link.text()).toBe('My posts')
  await link.trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/my-posts')
})
