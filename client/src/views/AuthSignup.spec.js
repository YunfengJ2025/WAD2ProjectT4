import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import AuthView from './AuthView.vue'
import { useAuthStore } from '@/stores/auth'

// Sign up checks the postal code with OneMap (through our server) and fills in the block.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), resolve: () => ({ meta: {} }) }),
  useRoute: () => ({ query: {} }),
  RouterLink: RouterLinkStub,
}))

let wrapper
let auth
beforeEach(() => {
  setActivePinia(createPinia())
  auth = useAuthStore()
  vi.spyOn(auth, 'register').mockResolvedValue()
  vi.stubGlobal('fetch', vi.fn())
  wrapper = mount(AuthView, {
    props: { createAccount: true },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
})
afterEach(() => { wrapper.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const answer = (status, body) => ({ ok: status === 200, status, json: async () => body })

async function fillForm(postalCode) {
  await wrapper.get('#username').setValue('Gardener')
  await wrapper.get('#email').setValue('garden@example.com')
  await wrapper.get('#password').setValue('password123')
  await wrapper.get('#unit-number').setValue('#05-12')
  await wrapper.get('#postal-code').setValue(postalCode)
  await flushPromises()
}

it('fills in the block from a real postal code and lets the user sign up', async () => {
  fetch.mockResolvedValueOnce(answer(200, { postalCode: '200640', block: '640', road: 'ROWELL ROAD' }))
  await fillForm('200640')
  expect(fetch.mock.calls[0][0]).toBe('/api/user/postal/200640')
  expect(wrapper.text()).toContain('Blk 640 ROWELL ROAD')
  expect(wrapper.get('#block').element.value).toBe('640')
  expect(wrapper.get('#block').attributes('readonly')).toBeDefined()
  expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(auth.register).toHaveBeenCalledWith(expect.objectContaining({ postalCode: '200640', block: '640' }))
})

it('blocks sign up when the postal code does not exist', async () => {
  fetch.mockResolvedValueOnce(answer(404, { message: 'Not found' }))
  await fillForm('000000')
  expect(wrapper.text()).toContain("doesn't exist")
  expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  await wrapper.get('form').trigger('submit')
  expect(auth.register).not.toHaveBeenCalled()
})

it('blocks sign up when OneMap cannot be reached', async () => {
  fetch.mockResolvedValueOnce(answer(503, { message: 'Could not reach OneMap' }))
  await fillForm('200640')
  expect(wrapper.text()).toContain("Couldn't check your postal code")
  expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
})
