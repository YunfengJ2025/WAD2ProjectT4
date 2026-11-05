import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import CareRequestsView from './CareRequestsView.vue'
import { useAuthStore } from '@/stores/auth'

let wrapper

afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

it('creates one request with separate care details for each selected plant', async () => {
  sessionStorage.setItem('leaf-access-token', 'test-token')
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore(pinia)
  auth.user = { userId: 1, userName: 'Gardener', tokenBalance: 20, availableTokenBalance: 20 }

  // Fix: the visit planner needs each plant's watering schedule (and outdoor plants only),
  // so the sample plants now include wateringInfo and isOutdoor
  const plants = [
    { plantId: 11, plantName: 'Fern', plantLocation: 'Balcony', photoUrl: '', isOutdoor: true, wateringInfo: { frequencyDays: 1, amountMl: 120 } },
    { plantId: 12, plantName: 'Pothos', plantLocation: 'Kitchen', photoUrl: '', isOutdoor: true, wateringInfo: { frequencyDays: 1, amountMl: 250 } },
  ]
  // Fix: dates were fixed (3-4 Nov 2026) and became past dates, which the form no longer allows
  const startDate = dayFromToday(1)
  const endDate = dayFromToday(2)
  let requests = []
  let createdRequest
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url === '/api/plants') return response({ plants })
    if (url === '/api/user/me') return response({ user: auth.user })
    if (url === '/api/care-requests' && options.method === 'POST') {
      createdRequest = JSON.parse(options.body)
      requests = [{ requestId: 31, ...createdRequest, status: 'open', plants, visits: [] }]
      return response({ request: requests[0] })
    }
    if (url === '/api/care-requests') return response({ requests })
    throw new Error(`Unexpected request: ${url}`)
  }))

  // Fix: the page now reads route.query.requestId (to focus a request from a notification),
  // so it must be mounted with a router; without one, useRoute() is undefined and the page crashes.
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/requests', component: CareRequestsView }],
  })
  await router.push('/requests')
  wrapper = mount(CareRequestsView, { global: { plugins: [pinia, router] } })
  await flushPromises()

  const plantCards = wrapper.findAll('.plant-option')
  await plantCards[0].trigger('click')
  await plantCards[1].trigger('click')

  const waterAmounts = wrapper.findAll('.plant-care input[type="number"]')
  await waterAmounts[0].setValue('120')
  await waterAmounts[1].setValue('250')
  const plantNotes = wrapper.findAll('.plant-care textarea')
  await plantNotes[0].setValue('Keep the soil lightly damp')
  await plantNotes[1].setValue('Avoid direct sun')
  const dates = wrapper.findAll('input[type="date"]')
  await dates[0].setValue(startDate)
  await dates[1].setValue(endDate)
  const numberInputs = wrapper.findAll('input[type="number"]')
  await numberInputs[2].setValue('2')
  await wrapper.get('input[name="waterSource"][value="left_out"]').setValue(true)
  await wrapper.get('textarea[maxlength="1000"]').setValue('Please check both plants.')
  await wrapper.get('.request-form').trigger('submit')
  await flushPromises()

  expect(createdRequest.plantIds).toEqual([11, 12])
  expect(createdRequest.plantDetails).toEqual([
    { plantId: 11, amountToWater: 120, careInstructions: 'Keep the soil lightly damp' },
    { plantId: 12, amountToWater: 250, careInstructions: 'Avoid direct sun' },
  ])
  expect(createdRequest.waterSource).toBe('left_out')
  expect(wrapper.text()).toContain('Request #31 posted.')
  expect(wrapper.text()).toContain('Fern')
  expect(wrapper.text()).toContain('Pothos')
})

// "YYYY-MM-DD" for today + n days (local time, like the date inputs)
function dayFromToday(n) {
  const day = new Date()
  day.setDate(day.getDate() + n)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

function response(body) {
  return { ok: true, status: 200, json: async () => body }
}
