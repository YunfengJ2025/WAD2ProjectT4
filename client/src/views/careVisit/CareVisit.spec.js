import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import CareVisitsView from './CareVisitsView.vue'
import { useAuthStore } from '@/stores/auth'

let wrapper

afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

it('accepts a visit and submits one proof photo for each plant', async () => {
  sessionStorage.setItem('leaf-access-token', 'sitter-token')
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore(pinia)
  auth.user = { userId: 7, userName: 'Sitter', tokenBalance: 4 }

  const availableVisit = makeVisit('open')
  let accepted = false
  let completed = false
  let submittedProof
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url === '/api/user/me') return response({ user: auth.user })
    if (url === '/api/care-visits/available')
      return response({ visits: accepted ? [] : [availableVisit] })
    if (url === '/api/care-visits/assignments')
      return response({ visits: accepted && !completed ? [makeVisit('accepted')] : [] })
    if (url === '/api/care-visits')
      return response({ visits: completed ? [makeVisit('completed')] : [] })
    if (url === '/api/token/user/7') return response([])
    if (url === '/api/care-visits/101/accept' && options.method === 'POST') {
      accepted = true
      return response({ visit: makeVisit('accepted') })
    }
    if (url === '/api/care-visits/101/proof' && options.method === 'POST') {
      submittedProof = options.body
      completed = true
      return response({ visit: { ...makeVisit('completed'), proofUrl: '/proof.jpg' } })
    }
    if (url === '/api/token/' && options.method === 'POST')
      return response({ transaction: { amount: 3 } })
    throw new Error(`Unexpected request: ${url}`)
  }))

  wrapper = mount(CareVisitsView, { global: { plugins: [pinia] } })
  await flushPromises()
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('You accepted the visit for 2 plants.')
  expect(wrapper.findAll('.plant-care-card')).toHaveLength(2)

  const actionInputs = wrapper.findAll('.plant-care-card input:not([type="file"])')
  await actionInputs[0].setValue('Watered Fern')
  await actionInputs[1].setValue('Watered Pothos')
  const photoInputs = wrapper.findAll('.plant-care-card input[type="file"]')
  const fernPhoto = new File(['fern'], 'fern.jpg', { type: 'image/jpeg' })
  const pothosPhoto = new File(['pothos'], 'pothos.jpg', { type: 'image/jpeg' })
  Object.defineProperty(photoInputs[0].element, 'files', { value: [fernPhoto] })
  Object.defineProperty(photoInputs[1].element, 'files', { value: [pothosPhoto] })
  await photoInputs[0].trigger('change')
  await photoInputs[1].trigger('change')
  await wrapper.get('.visit-form').trigger('submit')
  await flushPromises()

  expect(JSON.parse(submittedProof.get('actions'))).toEqual({ 11: 'Watered Fern', 12: 'Watered Pothos' })
  expect(submittedProof.get('photo_11').name).toBe('fern.jpg')
  expect(submittedProof.get('photo_12').name).toBe('pothos.jpg')
  expect(wrapper.text()).toContain('Visit #101 saved with photo proof.')
  expect(wrapper.text()).toContain('3 tokens awarded.')
})

function makeVisit(status) {
  return {
    visitId: 101,
    requestId: 50,
    visitDate: '2026-11-03T04:00:00.000Z',
    status,
    request: { tokenReward: 3, waterSource: 'left_out', note: 'Thank you!' },
    plants: [
      { plantId: 11, plantName: 'Fern', photoUrl: '' },
      { plantId: 12, plantName: 'Pothos', photoUrl: '' },
    ],
    items: [
      { plantId: 11, amountToWater: 120, plant: { plantId: 11, plantName: 'Fern' } },
      { plantId: 12, amountToWater: 250, plant: { plantId: 12, plantName: 'Pothos' } },
    ],
  }
}

function response(body) {
  return { ok: true, status: 200, json: async () => body }
}
