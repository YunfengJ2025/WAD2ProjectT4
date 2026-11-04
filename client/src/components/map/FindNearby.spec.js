import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import FindNearby from './FindNearby.vue'
const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ authorizedRequest: request }) }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }))
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
const visit = { visitId: 1, ownerId: 2, startDate: today, endDate: '2099-12-01', date: today, visitDate: today,
  lat: 1.35, lng: 103.82, postalCode: '123456', address: 'Near home', distanceKm: 0.2,
  plants: [], ownerName: 'Owner' }
function mountPanel() {
  return mount(FindNearby, { global: { stubs: { RequestMap: { name: 'RequestMap', props: ['requests'], template: '<div />' }, RouterLink: true, UserAvatar: true } } })
}

it('keeps Find requests active and includes every visit of a date-matching request', async () => {
  const otherDate = '2099-12-01'
  request.mockImplementation(async (url) => ({ origin: { lat: 1.35, lng: 103.82 },
    visits: url.includes('all=1') ? [visit,
      { ...visit, visitId: 2, date: otherDate, visitDate: otherDate },
      { ...visit, visitId: 3, ownerId: 3, date: otherDate, visitDate: otherDate, postalCode: '654321' }] : [visit] }))
  const wrapper = mountPanel()
  await flushPromises()
  await wrapper.get('.allRequests').trigger('click')
  await flushPromises()
  await wrapper.get('input[type=date]').setValue(today)
  expect(wrapper.get('h1').text()).toBe('Find requests')
  expect(wrapper.get('.allRequests').text()).toBe('Back to Find nearby')
  expect(wrapper.findAll('.requestCard')).toHaveLength(1)
  expect(wrapper.findComponent({ name: 'RequestMap' }).props('requests')).toHaveLength(1)
  await wrapper.get('.requestCard').trigger('click')
  expect(wrapper.findAll('.requestCard')).toHaveLength(2)
  await wrapper.get('input[type=date]').setValue('')
  expect(wrapper.get('h1').text()).toBe('Find requests')
  expect(wrapper.findAll('.requestCard')).toHaveLength(2)
  await wrapper.get('.allRequests').trigger('click')
  expect(wrapper.get('h1').text()).toBe('Find nearby')
  expect(wrapper.get('input[type=date]').element.value).toBe(today)
  wrapper.unmount()
})
