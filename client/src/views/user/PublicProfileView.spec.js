import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import PublicProfileView from './PublicProfileView.vue'

let wrapper
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })
const profile = {
  user: { userId: 7, userName: 'Neighbour', bio: 'I grow herbs.', photoUrl: 'https://images.example/user.png', createdAt: '2026-01-01' },
  averageRating: 4.5, reviewCount: 1,
  reviews: [{ reviewId: 1, creatorId: 2, creatorName: 'Author', receiverName: 'Neighbour', type: 'VISIT', rating: 4.5, comment: 'Lovely care', createdAt: '2026-10-25' }],
}
async function openPage(data) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => data })))
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/profile/:userId', component: PublicProfileView }, { path: '/', component: { template: '<p>Home</p>' } },
  ] })
  await router.push('/profile/7')
  wrapper = mount(PublicProfileView, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  return router
}

it('shows the public bio, rating, join date and visit reviews without sending auth credentials', async () => {
  const router = await openPage(profile)
  expect(wrapper.text()).toContain('I grow herbs.')
  expect(wrapper.get('.average').text()).toBe('4.5')
  expect(wrapper.get('.joined').text()).toContain('January 2026')
  expect(wrapper.findAll('.review-card')).toHaveLength(1)
  expect(wrapper.get('.review-card').text()).toContain('Lovely care')
  expect(wrapper.get('.review-card a').attributes('href')).toBe('/profile/2')
  expect(fetch.mock.calls[0][0]).toBe('/api/user/7/profile')
  expect(fetch.mock.calls[0][1].headers.has('Authorization')).toBe(false)
  fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Profile not found' }) })
  await router.push('/profile/999')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Profile not found')
  expect(wrapper.find('.public-identity').exists()).toBe(false)
})

it('shows empty bio and review states without implying a zero-star rating', async () => {
  await openPage({ ...profile, user: { ...profile.user, bio: '' }, averageRating: null, reviewCount: 0, reviews: [] })
  expect(wrapper.text()).toContain("hasn't added a bio")
  expect(wrapper.get('.average').text()).toBe('—')
  expect(wrapper.text()).toContain('No care visit reviews yet')
})

it('returns to the previous page when there is app navigation history', async () => {
  const router = await openPage(profile)
  router.options.history.state.back = '/reviews'
  const back = vi.spyOn(router, 'back').mockImplementation(() => {})
  await wrapper.get('.back-link').trigger('click')
  expect(back).toHaveBeenCalledOnce()
})

it('falls back to reviews when the profile was opened directly', async () => {
  const router = await openPage(profile)
  const replace = vi.spyOn(router, 'replace').mockResolvedValue(undefined)
  await wrapper.get('.back-link').trigger('click')
  expect(replace).toHaveBeenCalledWith('/reviews')
})
