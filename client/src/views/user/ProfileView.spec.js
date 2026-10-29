import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import ProfileView from './ProfileView.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'

let wrapper
let auth
beforeEach(() => {
  sessionStorage.clear()
  const pinia = createPinia()
  auth = useAuthStore(pinia)
  auth.accessToken = 'token'
  auth.user = { userId: 1, userName: 'Gardener', email: 'garden@example.com', block: '123A',
    unitNumber: '#05-12', postalCode: '123456', tokenBalance: 50, photoUrl: '', createdAt: '2026-01-01' }
  vi.stubGlobal('fetch', vi.fn())
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  wrapper = mount(ProfileView, { global: { plugins: [pinia], stubs: {
    RouterLink: RouterLinkStub,
    ProfilePosts: { template: '<section id="profile-posts">Posts</section>' },
    ProfileReviews: { template: '<section id="profile-reviews">Reviews</section>' },
  } } })
})
afterEach(() => { wrapper.unmount(); vi.unstubAllGlobals() })
const reply = (user) => ({ ok: true, status: 200, json: async () => ({ user }) })

it('saves an optional bio below the user icon and allows it to be cleared', async () => {
  const edit = () => wrapper.findAll('button').find((button) => ['Add a bio', 'Edit bio'].includes(button.text()))
  await edit().trigger('click')
  await wrapper.get('#profile-bio').setValue('I love growing herbs.')
  fetch.mockResolvedValueOnce(reply({ ...auth.user, bio: 'I love growing herbs.' }))
  await wrapper.get('.bio-editor').trigger('submit')
  await flushPromises()
  expect(wrapper.get('.profile-bio').text()).toContain('I love growing herbs.')
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ bio: 'I love growing herbs.' })
  await edit().trigger('click')
  await wrapper.get('#profile-bio').setValue('')
  fetch.mockResolvedValueOnce(reply({ ...auth.user, bio: '' }))
  await wrapper.get('.bio-editor').trigger('submit')
  await flushPromises()
  expect(auth.user.bio).toBe('')
})

it('includes reviews navigation and highlights only the section reached by scrolling', async () => {
  const positions = { 'about-me': -500, 'personal-details': 20, address: 300, 'profile-reviews': 600, 'profile-posts': 900 }
  for (const id of Object.keys(positions)) {
    wrapper.get(`#${id}`).element.getBoundingClientRect = () => ({ top: positions[id] })
  }
  window.dispatchEvent(new Event('scroll'))
  await vi.waitFor(() => {
    expect(wrapper.get('.profile-sidebar .selected').attributes('href')).toBe('#personal-details')
  })
  positions['personal-details'] = -400
  positions.address = -200
  positions['profile-reviews'] = 20
  window.dispatchEvent(new Event('scroll'))
  await vi.waitFor(() => {
    expect(wrapper.get('.profile-sidebar .selected').attributes('href')).toBe('#profile-reviews')
  })
  expect(wrapper.findAll('.profile-sidebar .selected')).toHaveLength(1)
  expect(wrapper.get('.profile-sidebar [aria-current="location"]').text()).toContain('My reviews')
})
async function pick(file) {
  Object.defineProperty(wrapper.get('#profile-photo').element, 'files', { configurable: true, value: [file] })
  await wrapper.get('#profile-photo').trigger('change')
}

it('displays real user details and discards cancelled edits', async () => {
  expect(wrapper.text()).toContain('Gardener')
  expect(wrapper.text()).toContain('123456')
  await wrapper.get('.edit-button').trigger('click')
  await wrapper.get('#userName').setValue('Unsaved')
  await wrapper.get('.form-actions .text-button').trigger('click')
  expect(auth.user.userName).toBe('Gardener')
  expect(wrapper.find('#userName').exists()).toBe(false)
})

it('validates and saves account and address details through Pinia', async () => {
  await wrapper.get('.edit-button').trigger('click')
  await wrapper.get('#postalCode').setValue('bad')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.text()).toContain('Enter a 6-digit postal code')
  expect(fetch).not.toHaveBeenCalled()
  await wrapper.get('#postalCode').setValue('654321')
  fetch.mockResolvedValueOnce(reply({ ...auth.user, postalCode: '654321' }))
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(auth.user.postalCode).toBe('654321')
  expect(wrapper.get('[role="status"]').text()).toContain('saved')
})

it('previews and uploads a photo without forcing a multipart Content-Type header', async () => {
  const file = new File(['image'], 'avatar.png', { type: 'image/png' })
  await pick(file)
  expect(wrapper.getComponent(UserAvatar).props('user').photoUrl).toBe('blob:preview')
  fetch.mockResolvedValueOnce(reply({ ...auth.user, photoUrl: 'https://images.example/avatar.png' }))
  await wrapper.get('.photo-actions .btn-primary').trigger('click')
  await flushPromises()
  const [url, options] = fetch.mock.calls[0]
  expect(url).toBe('/api/user/me')
  expect(options.headers.get('Authorization')).toBe('Bearer token')
  expect(options.headers.has('Content-Type')).toBe(false)
  expect(options.body.get('photo').name).toBe('avatar.png')
  expect(auth.user.photoUrl).toBe('https://images.example/avatar.png')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
})

it('rejects invalid photos and releases a cancelled preview', async () => {
  await pick(new File(['bad'], 'bad.svg', { type: 'image/svg+xml' }))
  expect(wrapper.text()).toContain('Choose a JPG')
  await pick(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))
  expect(wrapper.text()).toContain('2MB or smaller')
  await pick(new File(['good'], 'good.png', { type: 'image/png' }))
  await wrapper.get('.photo-actions .text-button').trigger('click')
  expect(wrapper.getComponent(UserAvatar).props('user').photoUrl).toBe('')
  expect(fetch).not.toHaveBeenCalled()
})

it('keeps the previous saved avatar and reports upload errors', async () => {
  await pick(new File(['image'], 'avatar.png', { type: 'image/png' }))
  fetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ message: 'Could not upload photo' }) })
  await wrapper.get('.photo-actions .btn-primary').trigger('click')
  await flushPromises()
  expect(wrapper.get('.feedback[role="alert"]').text()).toContain('Could not upload')
  expect(auth.user.photoUrl).toBe('')
})
