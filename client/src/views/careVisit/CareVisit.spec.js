import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import CareVisitsView from './CareVisitsView.vue'
import { useAuthStore } from '@/stores/auth'

// Fix: rewritten for the current visit flow. The old test typed an "action" per plant into
// .plant-care-card inputs, which no longer exist. Now the sitter opens the visit with
// "Start visit", ticks every care step, adds one photo per plant and submits (only on the visit day).

let wrapper

afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

it('accepts a visit, ticks every care step and submits one proof photo for each plant', async () => {
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

  // teleport stub keeps the visit pop-up inside the wrapper so find() can see it
  wrapper = mount(CareVisitsView, {
    global: { plugins: [pinia], stubs: { teleport: true, RouterLink: true } },
  })
  await flushPromises()

  // 1. Accept the open visit
  await wrapper.get('.available-list button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('You accepted the visit for 2 plants.')

  // 2. Open it from My Sits (the visit is today, so the button says "Start visit")
  const startButton = wrapper.findAll('button').find((button) => button.text() === 'Start visit')
  expect(startButton).toBeTruthy()
  await startButton.trigger('click')
  await flushPromises()

  // 3. Tick every care step (Fern has 2 steps, Pothos has 1)
  // (find the boxes again each time: ticking one re-renders the list, so old references go stale)
  const boxCount = wrapper.findAll('input[type="checkbox"]').length
  expect(boxCount).toBe(3)
  for (let i = 0; i < boxCount; i++) {
    await wrapper.findAll('input[type="checkbox"]')[i].setValue(true)
  }

  // 4. Add one photo per plant
  const photoInputs = wrapper.findAll('input[type="file"]')
  expect(photoInputs).toHaveLength(2)
  const fernPhoto = new File(['fern'], 'fern.jpg', { type: 'image/jpeg' })
  const pothosPhoto = new File(['pothos'], 'pothos.jpg', { type: 'image/jpeg' })
  Object.defineProperty(photoInputs[0].element, 'files', { value: [fernPhoto] })
  Object.defineProperty(photoInputs[1].element, 'files', { value: [pothosPhoto] })
  await photoInputs[0].trigger('change')
  await photoInputs[1].trigger('change')
  await flushPromises()

  // 5. Submit is enabled now; send the proof
  const submitButton = wrapper.get('button[type="submit"]')
  expect(submitButton.attributes('disabled')).toBeUndefined()
  await wrapper.get('form').trigger('submit')
  await flushPromises()

  expect(JSON.parse(submittedProof.get('completedSteps'))).toEqual({
    11: ['Water the soil', 'Check the leaves'],
    12: ['Wipe the leaves'],
  })
  expect(submittedProof.get('photo_11').name).toBe('fern.jpg')
  expect(submittedProof.get('photo_12').name).toBe('pothos.jpg')
  expect(wrapper.text()).toContain('Visit #101 saved with photo proof.')
  expect(wrapper.text()).toContain('3 tokens awarded.')
})

function makeVisit(status) {
  return {
    visitId: 101,
    requestId: 50,
    // today, so the visit can be completed (proof is only allowed on the visit day)
    visitDate: new Date().toISOString(),
    status,
    request: { tokenReward: 3, waterSource: 'left_out', note: 'Thank you!' },
    plants: [
      { plantId: 11, plantName: 'Fern', photoUrl: '' },
      { plantId: 12, plantName: 'Pothos', photoUrl: '' },
    ],
    items: [
      {
        requestItemId: 1,
        plantId: 11,
        amountToWater: 120,
        careInstructions: 'Water the soil\nCheck the leaves',
        plant: { plantId: 11, plantName: 'Fern' },
      },
      {
        requestItemId: 2,
        plantId: 12,
        amountToWater: 250,
        careInstructions: 'Wipe the leaves',
        plant: { plantId: 12, plantName: 'Pothos' },
      },
    ],
  }
}

function response(body) {
  return { ok: true, status: 200, json: async () => body }
}
