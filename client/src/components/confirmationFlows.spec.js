import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { beforeAll, afterAll, afterEach, expect, it, vi } from 'vitest'
import NavBar from './nav/NavBar.vue'
import CareRequestCard from './careRequest/CareRequestCard.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

let wrapper
// jsdom does not implement the browser's modal dialog methods.
const dialogPrototype = window.HTMLDialogElement.prototype
const originalShow = Object.getOwnPropertyDescriptor(dialogPrototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(dialogPrototype, 'close')
beforeAll(() => {
  Object.defineProperty(dialogPrototype, 'showModal', { configurable: true, value() { this.open = true } })
  Object.defineProperty(dialogPrototype, 'close', { configurable: true, value() { this.open = false } })
})
afterAll(() => {
  if (originalShow) Object.defineProperty(dialogPrototype, 'showModal', originalShow)
  else delete dialogPrototype.showModal
  if (originalClose) Object.defineProperty(dialogPrototype, 'close', originalClose)
  else delete dialogPrototype.close
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  sessionStorage.clear()
  const { toasts, dismiss } = useToast()
  toasts.slice().forEach((toast) => dismiss(toast.id))
})

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.accessToken = 'test-token'
  auth.user = { userId: 1, userName: 'Gardener' }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/:pathMatch(.*)*', component: { template: '<p />' } },
  ] })
  await router.push('/plants')
  return { auth, global: { plugins: [pinia, router] } }
}

it('clears notifications only after confirming, disables repeat clicks and shows a toast', async () => {
  const { auth, global } = await setup()
  let finishDelete
  const request = vi.spyOn(auth, 'authorizedRequest').mockImplementation((url, options) => {
    if (options?.method === 'DELETE') return new Promise((resolve) => { finishDelete = resolve })
    return Promise.resolve({ notifications: [{ _id: 'test', message: 'Test notice', readAt: null }] })
  })
  wrapper = mount(NavBar, { global })
  await flushPromises()
  const clearButton = () => wrapper.findAll('button').find((button) => button.text() === 'Clear all')
  await clearButton().trigger('click')
  const dialog = wrapper.getComponent(ConfirmDialog)
  expect(dialog.props('open')).toBe(true)
  await dialog.findAll('button')[0].trigger('click')
  expect(dialog.props('open')).toBe(false)
  expect(request).toHaveBeenCalledTimes(1)
  await clearButton().trigger('click')
  await dialog.findAll('button')[1].trigger('click')
  expect(dialog.props('busy')).toBe(true)
  expect(dialog.findAll('button').every((button) => button.element.disabled)).toBe(true)
  finishDelete({ deleted: 1 })
  await flushPromises()
  expect(dialog.props('open')).toBe(false)
  expect(wrapper.findAll('.notification-item')).toHaveLength(0)
  expect(useToast().toasts.some((toast) => toast.message === 'All notifications cleared')).toBe(true)
})

it('keeps notifications and allows retry when clearing fails', async () => {
  const { auth, global } = await setup()
  vi.spyOn(auth, 'authorizedRequest').mockImplementation(async (url, options) => {
    if (options?.method === 'DELETE') throw new Error('Server unavailable')
    return { notifications: [{ _id: 'test', message: 'Test notice', readAt: null }] }
  })
  wrapper = mount(NavBar, { global })
  await flushPromises()
  await wrapper.findAll('button').find((button) => button.text() === 'Clear all').trigger('click')
  const dialog = wrapper.getComponent(ConfirmDialog)
  await dialog.findAll('button')[1].trigger('click')
  await flushPromises()
  expect(dialog.props('open')).toBe(true)
  expect(dialog.props('busy')).toBe(false)
  expect(wrapper.findAll('.notification-item')).toHaveLength(1)
  expect(useToast().toasts.some((toast) => toast.type === 'error')).toBe(true)
})

it('cancelling the request dialog leaves the request untouched; confirming emits the action', async () => {
  const { global } = await setup()
  const request = { requestId: 8, status: 'open', plants: [{ plantId: 1, plantName: 'Fern' }] }
  wrapper = mount(CareRequestCard, { props: { request }, global })
  await wrapper.get('.cancel-link').trigger('click')
  const dialog = wrapper.getComponent(ConfirmDialog)
  await dialog.findAll('button')[0].trigger('click')
  expect(wrapper.emitted('cancel-request')).toBeUndefined()
  await wrapper.get('.cancel-link').trigger('click')
  await dialog.findAll('button')[1].trigger('click')
  expect(wrapper.emitted('cancel-request')).toEqual([[request]])
  expect(dialog.props('open')).toBe(false)
})
