import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, it, expect, afterEach, vi } from 'vitest'
import ProfilePosts from './ProfilePosts.vue'
import { useAuthStore } from '@/stores/auth'
import { usePostsStore } from '@/stores/posts'
let wrapper
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  sessionStorage.clear()
})
function open() {
  const pinia = createPinia()
  useAuthStore(pinia).user = { userId: 1, userName: 'Me' }
  const store = usePostsStore(pinia)
  vi.spyOn(store, 'fetchPosts').mockResolvedValue()
  // The parent's responsibility is selecting posts and passing identity to cards.
  // Card navigation and carousel behaviour are tested in PostCard.spec.js.
  wrapper = mount(ProfilePosts, {
    global: {
      plugins: [pinia],
      stubs: {
        RouterLink: RouterLinkStub,
        PostCard: {
          props: ['post', 'author'],
          template: '<p data-testid="post-summary">{{ post.title }} by {{ author.userName }}</p>',
        },
      },
    },
  })
  return store
}
describe('ProfilePosts', () => {
  it('shows up to six supplied posts with the current author and navigation links', async () => {
    const store = open()
    store.posts = Array.from({ length: 8 }, (_, i) => ({ postId: i + 1, title: 'Post ' + (i + 1) }))
    await flushPromises()
    expect(wrapper.findAll('[data-testid="post-summary"]')).toHaveLength(6)
    expect(wrapper.text()).toContain('Post 1 by Me')
    expect(wrapper.text()).not.toContain('Post 7 by Me')
    expect(wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))).toEqual([
      '/community/new',
      '/my-posts',
    ])
  })
  it('shows empty and error states and delegates retry to the store', async () => {
    const store = open()
    expect(wrapper.text()).toContain('No posts yet')
    store.error = 'Posts unavailable'
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Posts unavailable')
    store.fetchPosts.mockClear()
    await wrapper.get('button').trigger('click')
    expect(store.fetchPosts).toHaveBeenCalledTimes(1)
  })
})
