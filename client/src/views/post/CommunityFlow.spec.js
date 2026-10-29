import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import CommunityView from './CommunityView.vue'
import CreatePostView from './CreatePostView.vue'
import PostDetailView from './PostDetailView.vue'
import { useAuthStore } from '@/stores/auth'

let wrapper
const emptyPage = { template: '<p>Page</p>' }
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})
function reply(data, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => data }
}
async function open(component, path = '/community') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.accessToken = 'test-token'
  auth.user = { userId: 3, userName: 'Fern Friend' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/community', component: emptyPage },
      { path: '/community/new', component: emptyPage },
      { path: '/community/:postId', component: emptyPage },
      { path: '/signin', name: 'sign-in', component: emptyPage },
      { path: '/profile/:userId', component: emptyPage },
    ],
  })
  await router.push(path)
  wrapper = mount(component, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return router
}

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
          title: 'Leaf', postImages: ['https://example.com/leaf.jpg'],
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
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('Every community starts with a hello')
})

it('publishes authenticated text and image then returns to the feed', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => reply({ postId: 5 })),
  )
  const router = await open(CreatePostView, '/community/new')
  await wrapper.get('#post-title').setValue('Fern')
  await wrapper.get('textarea').setValue('  My new fern  ')
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fern')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const file = new File(['photo'], 'fern.jpg', { type: 'image/jpeg' })
  Object.defineProperty(wrapper.get('input[type="file"]').element, 'files', {
    value: [file],
    configurable: true,
  })
  await wrapper.get('input[type="file"]').trigger('change')
  expect(wrapper.get('.community-photo-preview img').attributes('src')).toBe('blob:fern')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  const [url, options] = fetch.mock.calls[0]
  expect(url).toBe('/api/post')
  expect(options.headers.get('Authorization')).toBe('Bearer test-token')
  expect(options.body.get('content')).toBe('My new fern')
  expect(options.body.getAll('photos')[0].name).toBe('fern.jpg')
  expect(options.headers.has('Content-Type')).toBe(false)
  expect(router.currentRoute.value.path).toBe('/community')
})

it('rejects blank content and unsupported photos without posting', async () => {
  vi.stubGlobal('fetch', vi.fn())
  await open(CreatePostView, '/community/new')
  await wrapper.get('form').trigger('submit')
  expect(
    wrapper
      .findAll('[role="alert"]')
      .map((node) => node.text())
      .join(' '),
  ).toContain('Write something')
  await wrapper.get('textarea').setValue('Hello')
  Object.defineProperty(wrapper.get('input[type="file"]').element, 'files', {
    value: [new File(['bad'], 'bad.txt', { type: 'text/plain' })],
    configurable: true,
  })
  await wrapper.get('input[type="file"]').trigger('change')
  expect(wrapper.get('#photo-error').text()).toContain('JPG, PNG or WebP')
  expect(fetch).not.toHaveBeenCalled()
})

it('preserves the draft and enables retry when publishing fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => reply({ message: 'Please try later' }, false)),
  )
  const router = await open(CreatePostView, '/community/new')
  await wrapper.get('#post-title').setValue('Draft')
  await wrapper.get('textarea').setValue('Keep my draft')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(
    wrapper
      .findAll('[role="alert"]')
      .map((node) => node.text())
      .join(' '),
  ).toContain('Please try later')
  expect(wrapper.get('textarea').element.value).toBe('Keep my draft')
  expect(wrapper.get('[type="submit"]').element.disabled).toBe(false)
  expect(router.currentRoute.value.path).toBe('/community/new')
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
  expect(wrapper.get('.community-gallery-stage > img').attributes('src')).toBe(post.postImages[0])
  await wrapper.get('[aria-label="Next photo"]').trigger('click')
  expect(wrapper.get('.community-gallery-stage > img').attributes('src')).toBe(post.postImages[1])
  await wrapper.get('[aria-label="Next photo"]').trigger('click')
  expect(wrapper.get('.community-gallery-stage > img').attributes('src')).toBe(post.postImages[0])
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
  expect(wrapper.get('.community-gallery-stage > img').attributes('src')).toBe(
    'https://example.com/old.jpg',
  )
  expect(wrapper.find('[aria-label="Next photo"]').exists()).toBe(false)
})

it('shows the title in a card without photos and links avatars to profiles', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => reply([{ postId: 7, creatorId: 2, title: 'Growing without a photo', postImages: [], content: 'Body', likedCount: 0 }])))
  await open(CommunityView)
  expect(wrapper.get('.post-card-text').text()).toBe('Growing without a photo')
  expect(wrapper.get('.post-card-link').attributes('href')).toBe('/community/7')
  expect(wrapper.get('.post-card-author').attributes('href')).toBe('/profile/2')
})
