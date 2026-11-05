
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FindNearby from './FindNearby.vue'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ authorizedRequest: request }) }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }))
vi.mock('@/components/map/RequestMap.vue', () => ({
  default: {
    name: 'RequestMap',
    props: ['requests', 'searchPin', 'radiusKm', 'center'],
    emits: ['select', 'drop-pin'],
    // Echo received props. Buttons simulate child events.
    template: `<div aria-label="Map stub">
    <button v-for="request in requests" :key="request.visitId"
      :data-visit-id="request.visitId" @click="$emit('select', request)">
      Plant request at {{ request.address }}
    </button>
  </div>`,
  },
}))
enableAutoUnmount(afterEach)
const today = '2026-11-05'
const tomorrow = '2026-11-06'
const origin = { lat: 1.35, lng: 103.82 }
const visit = {
  visitId: 1,
  ownerId: 2,
  startDate: today,
  endDate: tomorrow,
  date: today,
  visitDate: today,
  ...origin,
  postalCode: '123456',
  address: 'Near home',
  distanceKm: 0.2,
  plants: [],
  ownerName: 'Owner',
}
let visits
function mapPins(wrapper) {
  return wrapper.findAll('[aria-label="Map stub"] button')
}
function panel() {
  return mount(FindNearby, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        UserAvatar: true,
      },
    },
  })
}
async function all(wrapper) {
  await wrapper.get('.allRequests').trigger('click')
  await flushPromises()
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T04:00:00Z'))
  visits = [visit]
  request.mockReset()
  request.mockImplementation(async () => ({ origin, visits }))
})
afterEach(() => vi.useRealTimers())

describe('Find nearby', () => {
  it('includes visits at the radius boundary and excludes visits outside it', async () => {
    // Setup: below, exactly at, and above the 300 m boundary.
    visits = [
      { ...visit, visitId: 1, address: 'Inside radius', distanceKm: 0.299 },
      { ...visit, visitId: 2, address: 'At radius', distanceKm: 0.3 },
      { ...visit, visitId: 3, address: 'Outside radius', distanceKm: 0.301 },
    ]
    const wrapper = panel()
    await flushPromises()
    // Action
    await wrapper.get('input[type=range]').setValue('0.3')
    // Assert: both the list and the child map receive the matching visits.
    expect(wrapper.findAll('.requestCard')).toHaveLength(2)
    expect(wrapper.text()).toContain('Inside radius')
    expect(wrapper.text()).toContain('At radius')
    expect(wrapper.text()).not.toContain('Outside radius')
    expect(mapPins(wrapper)).toHaveLength(2)
  })

  it('shows a loading message until visits arrive', async () => {
    let finishLoading
    request.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoading = resolve
      }),
    )
    const wrapper = panel()
    expect(wrapper.text()).toContain('Finding plants near you')
    expect(wrapper.find('[aria-label="Map stub"]').exists()).toBe(false)
    finishLoading({ origin, visits })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Finding plants near you')
    expect(wrapper.findAll('.requestCard')).toHaveLength(1)
  })

  it('loads nearby visits and defaults to the Singapore date', async () => {
    const wrapper = panel()
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/find-nearby')
    expect(wrapper.get('h1').text()).toBe('Find nearby')
    expect(wrapper.get('input[type=date]').element.value).toBe(today)
    expect(wrapper.findAll('.requestCard')).toHaveLength(1)
  })

  it('filters by distance and date without another API call', async () => {
    visits = [
      visit,
      { ...visit, visitId: 2, distanceKm: 0.8 },
      { ...visit, visitId: 3, date: tomorrow, visitDate: tomorrow },
    ]
    const wrapper = panel()
    await flushPromises()
    expect(wrapper.findAll('.requestCard')).toHaveLength(2)
    await wrapper.get('input[type=range]').setValue('0.3')
    expect(wrapper.findAll('.requestCard')).toHaveLength(1)
    await wrapper.get('input[type=date]').setValue(tomorrow)
    expect(mapPins(wrapper).map((pin) => pin.attributes('data-visit-id'))).toEqual(['3'])
    await wrapper.get('input[type=date]').setValue('2026-11-07')
    expect(wrapper.text()).toContain('No requests within 300 m')
  })

  it('opens details with Enter and returns to the list', async () => {
    const wrapper = panel()
    await flushPromises()
    await wrapper.get('.requestCard').trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('.detail h2').text()).toBe('Near home')
    expect(wrapper.get('.acceptBar button').text()).toBe('Accept request')
    await wrapper.get('.backBtn').trigger('click')
    expect(wrapper.findAll('.requestCard')).toHaveLength(1)
  })

  it('retries a failed load', async () => {
    request.mockRejectedValueOnce(new Error('Unable to load'))
    const wrapper = panel()
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('Unable to load')
    await wrapper.get('[role=alert] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role=alert]').exists()).toBe(false)
    expect(wrapper.findAll('.requestCard')).toHaveLength(1)
  })

  it('shows sign-in errors without a retry button', async () => {
    request.mockRejectedValueOnce(new Error('Please sign in first.'))
    const wrapper = panel()
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toBe('Please sign in first.')
    expect(wrapper.find('[role=alert] button').exists()).toBe(false)
  })

  it('disables acceptance while pending and removes the accepted visit', async () => {
    const wrapper = panel()
    await flushPromises()
    await wrapper.get('.requestCard').trigger('click')
    let resolve
    request.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    await wrapper.get('.acceptBar button').trigger('click')
    expect(wrapper.get('.acceptBar button').element.disabled).toBe(true)
    expect(request).toHaveBeenLastCalledWith('/care-visits/1/accept', { method: 'POST' })
    resolve({})
    await flushPromises()
    expect(wrapper.get('[role=status]').text()).toContain('You accepted the visit')
    expect(mapPins(wrapper)).toHaveLength(0)
  })
})

describe('Find requests', () => {
  it('keeps all visits in a date-matching request and restores today when returning nearby', async () => {
    const nationwideVisits = [
      visit,
      { ...visit, visitId: 2, date: tomorrow, visitDate: tomorrow },
      {
        ...visit,
        visitId: 3,
        ownerId: 3,
        date: tomorrow,
        visitDate: tomorrow,
        postalCode: '654321',
      },
    ]
    request.mockImplementation(async (url) => ({
      origin,
      visits: url.includes('all=1') ? nationwideVisits : [visit],
    }))
    const wrapper = panel()
    await flushPromises()
    await all(wrapper)

    await wrapper.get('input[type=date]').setValue(today)
    expect(wrapper.get('h1').text()).toBe('Find requests')
    expect(wrapper.get('.allRequests').text()).toBe('Back to Find nearby')
    expect(wrapper.findAll('.requestCard')).toHaveLength(1)
    expect(mapPins(wrapper)).toHaveLength(1)

    await wrapper.get('.requestCard').trigger('click')
    expect(wrapper.findAll('.requestCard')).toHaveLength(2)

    await wrapper.get('input[type=date]').setValue('')
    expect(wrapper.get('h1').text()).toBe('Find requests')
    expect(wrapper.findAll('.requestCard')).toHaveLength(2)

    await wrapper.get('.allRequests').trigger('click')
    expect(wrapper.get('h1').text()).toBe('Find nearby')
    expect(wrapper.get('input[type=date]').element.value).toBe(today)
  })

  it('loads nationwide groups with one map pin per postal code', async () => {
    visits = [
      visit,
      { ...visit, visitId: 2, date: tomorrow, visitDate: tomorrow },
      { ...visit, visitId: 3, ownerId: 3, postalCode: '654321', distanceKm: 8 },
    ]
    const wrapper = panel()
    await flushPromises()
    await all(wrapper)
    expect(request).toHaveBeenCalledWith('/find-nearby?all=1')
    expect(wrapper.get('h1').text()).toBe('Find requests')
    expect(wrapper.get('input[type=date]').element.value).toBe('')
    expect(wrapper.find('input[type=range]').exists()).toBe(false)
    expect(wrapper.findAll('.requestCard')).toHaveLength(2)
    expect(wrapper.text()).toContain('2 days open')
    expect(mapPins(wrapper)).toHaveLength(2)
  })

  it('opens a grouped request through a map selection', async () => {
    visits = [visit, { ...visit, visitId: 2, date: tomorrow, visitDate: tomorrow }]
    const wrapper = panel()
    await flushPromises()
    await all(wrapper)
    await mapPins(wrapper)[0].trigger('click')
    expect(wrapper.get('.detail h2').text()).toBe('Near home')
    expect(wrapper.findAll('.requestCard')).toHaveLength(2)
    await wrapper.get('.backBtn').trigger('click')
    expect(wrapper.findAll('.requestCard')).toHaveLength(1)
  })

  it('retries nationwide errors without leaving Find requests', async () => {
    const wrapper = panel()
    await flushPromises()
    request.mockRejectedValueOnce(new Error('Nationwide search unavailable'))
    await all(wrapper)
    expect(wrapper.get('[role=alert]').text()).toContain('Nationwide search unavailable')
    await wrapper.get('[role=alert] button').trigger('click')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Find requests')
    expect(wrapper.find('[role=alert]').exists()).toBe(false)
    expect(wrapper.findAll('.requestCard')).toHaveLength(1)
  })
})

describe('Unavailable visits', () => {
  for (const status of [404, 409]) {
    it(`refreshes Find requests after an acceptance returns ${status}`, async () => {
      const remaining = { ...visit, visitId: 2, date: tomorrow, visitDate: tomorrow }
      let available = [visit, remaining]
      request.mockImplementation(async (url, options) => {
        if (options?.method === 'POST') {
          throw Object.assign(new Error('Visit no longer available'), { status })
        }
        return { origin, visits: url.includes('all=1') ? available : [visit] }
      })
      const wrapper = panel()
      await flushPromises()
      await all(wrapper)
      await wrapper.get('.requestCard').trigger('click')
      await wrapper.findAll('.requestCard')[0].trigger('click')
      available = [remaining]

      await wrapper.get('.acceptBar button').trigger('click')
      await flushPromises()

      expect(request).toHaveBeenLastCalledWith('/find-nearby?all=1')
      expect(wrapper.get('h1').text()).toBe('Find requests')
      expect(wrapper.find('.backBtn').exists()).toBe(false)
      expect(wrapper.find('.acceptBar').exists()).toBe(false)
      expect(mapPins(wrapper).map((pin) => pin.attributes('data-visit-id'))).toEqual(['2'])
      // Opening the surviving group must show only its remaining open day.
      await wrapper.get('.requestCard').trigger('click')
      expect(wrapper.findAll('.requestCard')).toHaveLength(1)
    })
  }

  for (const nationwide of [false, true]) {
    it(`refreshes a dropped-pin search in ${nationwide ? 'Find requests' : 'Find nearby'}`, async () => {
      const wrapper = panel()
      await flushPromises()
      if (nationwide) await all(wrapper)
      const map = wrapper.getComponent({ name: 'RequestMap' })
      const point = { lat: 1.351, lng: 103.821 }
      map.vm.$emit('drop-pin', point)
      await flushPromises()
      await wrapper.get('input[type=range]').setValue('0.5')
      await wrapper.get('input[type=date]').setValue(today)
      await wrapper.get('.requestCard').trigger('click')
      if (nationwide) await wrapper.get('.requestCard').trigger('click')
      request.mockRejectedValueOnce(Object.assign(new Error('Visit taken'), { status: 409 }))
      visits = []

      await wrapper.get('.acceptBar button').trigger('click')
      await flushPromises()

      expect(request).toHaveBeenLastCalledWith('/find-nearby?all=1')
      expect(wrapper.get('h1').text()).toBe(nationwide ? 'Find requests' : 'Find nearby')
      expect(map.props('searchPin')).toEqual(point)
      expect(map.props('radiusKm')).toBe(0.5)
      expect(wrapper.get('input[type=date]').element.value).toBe(today)
      expect(mapPins(wrapper)).toHaveLength(0)
      expect(wrapper.find('.acceptBar').exists()).toBe(false)
    })
  }

  it('removes the unavailable visit even when refreshing Find requests fails', async () => {
    const wrapper = panel()
    await flushPromises()
    await all(wrapper)
    await wrapper.get('.requestCard').trigger('click')
    await wrapper.get('.requestCard').trigger('click')
    request.mockRejectedValueOnce(Object.assign(new Error('Visit taken'), { status: 409 }))
    request.mockRejectedValueOnce(new Error('Could not refresh requests'))

    await wrapper.get('.acceptBar button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role=alert]').text()).toContain('Could not refresh requests')
    expect(mapPins(wrapper)).toHaveLength(0)
    expect(wrapper.find('.acceptBar').exists()).toBe(false)
    visits = []
    await wrapper.get('[role=alert] button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.requestCard')).toHaveLength(0)
  })

  it('still refreshes the nearby endpoint for a search around home', async () => {
    const wrapper = panel()
    await flushPromises()
    await wrapper.get('.requestCard').trigger('click')
    request.mockRejectedValueOnce(Object.assign(new Error('Visit taken'), { status: 409 }))
    visits = []

    await wrapper.get('.acceptBar button').trigger('click')
    await flushPromises()

    expect(request).toHaveBeenLastCalledWith('/find-nearby')
    expect(mapPins(wrapper)).toHaveLength(0)
    expect(wrapper.find('.acceptBar').exists()).toBe(false)
  })
})
