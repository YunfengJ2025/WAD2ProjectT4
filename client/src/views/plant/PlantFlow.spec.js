import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import App from '@/App.vue'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { usePlantsStore } from '@/stores/plants'

let wrapper
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

it('signs in through the form, creates and edits a shared plant, and redirects on expiry', async () => {
  sessionStorage.clear()
  const pinia = createPinia()
  let plants = []
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    let body
    if (url === '/api/user/login') {
      body = { user: { userId: 1, userName: 'Gardener' }, accessToken: 'test-token' }
    } else {
      expect(options.headers.get('Authorization')).toBe('Bearer test-token')
      if (url === '/api/plants' && !options.method) body = { plants: [...plants] }
      else if (options.method === 'POST' || options.method === 'PATCH') {
        const data = options.body
        plants = [{ plantId: 1, plantName: data.get('plantName'), plantLocation: data.get('plantLocation'),
          rainExposed: false, createdAt: new Date().toISOString(), lastWateredAt: null,
          wateringInfo: { frequencyDays: 2, amountMl: 200, notes: '' } }]
        body = { plant: plants[0] }
      } else body = { plant: plants[0] }
    }
    return { ok: true, status: 200, json: async () => body }
  }))
  const auth = useAuthStore(pinia)
  await router.push('/plants')
  expect(router.currentRoute.value.name).toBe('sign-in')
  wrapper = mount(App, { global: { plugins: [pinia, router] } })
  await flushPromises()
  await wrapper.get('#email').setValue('gardener@example.com')
  await wrapper.get('#password').setValue('password123')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(wrapper.text()).toContain('No plants yet'))
  expect(auth.user.userName).toBe('Gardener')

  await router.push('/plants/new')
  await flushPromises()
  await wrapper.get('#plantName').setValue('Fern')
  await wrapper.get('#plantLocation').setValue('By the door')
  await wrapper.get('#frequencyDays').setValue('2')
  await wrapper.get('#amountMl').setValue('200')
  await wrapper.get('input[name="rainExposed"][value="false"]').setValue(true)
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/plants'))
  await flushPromises()
  expect(wrapper.get('.name-link').text()).toBe('Fern')

  await router.push('/plants/1/edit')
  await flushPromises()
  expect(wrapper.get('#plantName').element.value).toBe('Fern')
  await wrapper.get('#plantName').setValue('Happy fern')
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/plants/1'))
  await flushPromises()
  expect(wrapper.get('h1').text()).toBe('Happy fern')
  expect(usePlantsStore(pinia).findPlant(1).plantName).toBe('Happy fern')

  fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Token expired' }) })
  await expect(usePlantsStore(pinia).fetchPlants()).rejects.toThrow('Token expired')
  await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'))
  expect(usePlantsStore(pinia).plants).toEqual([])
})
