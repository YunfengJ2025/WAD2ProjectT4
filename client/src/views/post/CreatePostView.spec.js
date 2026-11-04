// Integration tests mount the real page, children, Pinia stores, and memory router.
// Only network responses are fixtures; these are not real-backend E2E tests.
import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import CreatePostView from './CreatePostView.vue'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
import { createPostViewHarness, reply } from '@/test-utils/postViewHarness'

let wrapper
const { open } = createPostViewHarness((value) => {
  wrapper = value
})

it('updates the live preview without saving and toggles its mobile disclosure', async () => {
  vi.stubGlobal('fetch', vi.fn())
  await open(CreatePostView, '/community/new')
  await wrapper.get('#post-title').setValue('A little fern update')
  await wrapper.get('#post-content').setValue('One new leaf today!')
  expect(wrapper.get('.composer-draft h3').text()).toBe('A little fern update')
  expect(wrapper.get('.composer-draft-text').text()).toBe('One new leaf today!')
  expect(wrapper.get('#title-count').text()).toBe('20/150')
  await wrapper.get('.composer-preview-toggle').trigger('click')
  expect(wrapper.get('.composer-preview-toggle').attributes('aria-expanded')).toBe('true')
  expect(wrapper.get('#draft-preview').classes()).toContain('is-open')
  expect(fetch).not.toHaveBeenCalled()
})

it('keeps the cover on retained images before moving it to a new upload', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply({
        postId: 5,
        creatorId: 3,
        title: 'Original',
        content: 'Hello',
        postImages: ['https://example.com/cover.jpg'],
      }),
    ),
  )
  await open(CreatePostView, '/community/5/edit')
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-photo')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  Object.defineProperty(wrapper.get('#post-photos').element, 'files', {
    value: [new File(['photo'], 'new.jpg', { type: 'image/jpeg' })],
    configurable: true,
  })
  await wrapper.get('#post-photos').trigger('change')
  expect(wrapper.findAll('.composer-cover-badge')).toHaveLength(1)
  expect(wrapper.get('.composer-cover-badge').element.parentElement.querySelector('img').src).toBe(
    'https://example.com/cover.jpg',
  )
  expect(wrapper.get('.composer-draft-cover img').attributes('src')).toBe(
    'https://example.com/cover.jpg',
  )
  await wrapper.get('[aria-label="Remove current photo 1"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('.composer-cover-badge').element.parentElement.querySelector('img').src).toBe(
    'blob:new-photo',
  )
  expect(wrapper.get('.composer-draft-cover img').attributes('src')).toBe('blob:new-photo')
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

it('edits own post, removes a retained photo and saves without changing the creator', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        reply({
          postId: 5,
          creatorId: 3,
          title: 'Original',
          content: 'Hello',
          postImages: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
        }),
      )
      .mockResolvedValueOnce(reply({ postId: 5 })),
  )
  const router = await open(CreatePostView, '/community/5/edit')
  expect(wrapper.get('#post-title').element.value).toBe('Original')
  await wrapper.get('[aria-label="Remove current photo 1"]').trigger('click')
  await wrapper.get('#post-title').setValue('Updated')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  const [url, options] = fetch.mock.calls[1]
  expect(url).toBe('/api/post/5')
  expect(options.method).toBe('PATCH')
  expect(options.body.get('title')).toBe('Updated')
  expect(JSON.parse(options.body.get('retainedImages'))).toEqual(['https://example.com/2.jpg'])
  expect(router.currentRoute.value.path).toBe('/my-posts')
})

// Ownership is a page/API integration guard, not a presentation-only component rule.
it('refuses to expose another users post in the edit form', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply({ postId: 5, creatorId: 99, title: 'Private edit', content: 'Hello', postImages: [] }),
    ),
  )
  await open(CreatePostView, '/community/5/edit')
  expect(wrapper.get('[role="alert"]').text()).toContain('only edit your own posts')
  expect(wrapper.find('form').exists()).toBe(false)
})
