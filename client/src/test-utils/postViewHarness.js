import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { afterEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { useLikesStore } from '@/stores/likes'
import { vi } from 'vitest'

// Match the fetch response contract consumed by the real shared HTTP helper.
export const reply = (data, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => data })

// Each suite gets its own wrapper and every test gets a fresh application session.
// Destination pages are placeholders: we assert routing, not another page's content.
export function createPostViewHarness(onMount) {
  let wrapper
  afterEach(() => {
    wrapper?.unmount()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })
  async function open(component, path = '/community') {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.accessToken = 'test-token'
    auth.user = { userId: 3, userName: 'Fern Friend' }
    // Start with known empty liked state, so mounting real LikeButtons does not
    // consume the fixture response intended for the page. Toggling still uses
    // the real likes store and HTTP helper; the liked page explicitly reloads.
    useLikesStore().loaded = true
    const emptyPage = { template: '<p>Destination page</p>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/community', component: emptyPage },
        { path: '/community/new', component: emptyPage },
        { path: '/my-posts', component: emptyPage },
        { path: '/community/:postId/edit', component: emptyPage },
        { path: '/community/:postId', component: emptyPage },
        { path: '/signin', name: 'sign-in', component: emptyPage },
        { path: '/profile/:userId', component: emptyPage },
      ],
    })
    await router.push(path)
    wrapper = mount(component, { global: { plugins: [pinia, router] } })
    onMount(wrapper)
    await flushPromises()
    return router
  }
  return { open }
}
