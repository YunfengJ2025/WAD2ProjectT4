import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'
import { usePlantsStore } from './plants'

const user = { userId: 1, userName: 'Gardener' }
const plant = { plantId: 7, plantName: 'Fern', wateringInfo: { frequencyDays: 2, amountMl: 200 } }
const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })

beforeEach(() => {
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('JWT auth and plant stores', () => {
  it.each(['login', 'register'])('%s persists the JWT and exposes the user', async (action) => {
    fetch.mockResolvedValueOnce(reply({ accessToken: 'jwt-token', user }))
    const auth = useAuthStore()
    await auth[action]({ email: 'test@example.com', password: 'password123' })
    expect(auth.isAuthenticated).toBe(true)
    expect(sessionStorage.getItem('leaf-access-token')).toBe('jwt-token')
    expect(fetch.mock.calls[0][0]).toBe(`/api/user/${action}`)
  })

  it('restores a persisted session through /user/me', async () => {
    sessionStorage.setItem('leaf-access-token', 'saved-token')
    fetch.mockResolvedValueOnce(reply({ user }))
    const auth = useAuthStore()
    await Promise.all([auth.restoreSession(), auth.restoreSession()])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer saved-token')
    expect(auth.user).toEqual(user)
  })

  it('exposes login errors and releases the submitting state', async () => {
    fetch.mockResolvedValueOnce(reply({ message: 'Invalid email or password' }, 401))
    const auth = useAuthStore()
    await expect(auth.login({})).rejects.toThrow('Invalid email or password')
    expect(auth.error).toBe('Invalid email or password')
    expect(auth.submitting).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
  })

  it('shares CRUD and watering results and preserves multipart uploads', async () => {
    useAuthStore().accessToken = 'token'
    const store = usePlantsStore()
    fetch.mockResolvedValueOnce(reply({ plants: [plant] }))
    await store.fetchPlants()
    const data = new FormData()
    data.append('photo', new File(['photo'], 'fern.png', { type: 'image/png' }))
    fetch.mockResolvedValueOnce(reply({ plant: { ...plant, plantName: 'Updated fern' } }))
    await store.savePlant(data, 7)
    const options = fetch.mock.calls[1][1]
    expect(options.headers.get('Authorization')).toBe('Bearer token')
    expect(options.headers.has('Content-Type')).toBe(false)
    expect(options.body).toBe(data)
    expect(store.findPlant('7').plantName).toBe('Updated fern')
    fetch.mockResolvedValueOnce(reply({ plant: { ...plant, lastWateredAt: '2026-10-25T10:00:00Z' } }))
    await store.markWatered(7)
    expect(store.findPlant(7).lastWateredAt).toBeTruthy()
    fetch.mockResolvedValueOnce(reply({ plant: { ...plant, plantId: 8 } }, 201))
    await store.savePlant(data)
    expect(store.plants).toHaveLength(2)
    fetch.mockResolvedValueOnce(reply(null, 204))
    await store.deletePlant(7)
    expect(store.plants.map((p) => p.plantId)).toEqual([8])
  })

  it('clears authentication and plant data on a protected 401', async () => {
    const auth = useAuthStore()
    auth.accessToken = 'expired-token'
    auth.user = user
    const store = usePlantsStore()
    store.plants = [plant]
    fetch.mockResolvedValueOnce(reply({ message: 'Invalid or expired access token' }, 401))
    await expect(store.fetchPlants()).rejects.toMatchObject({ status: 401 })
    expect(auth.accessToken).toBe('')
    expect(auth.user).toBeNull()
    expect(store.plants).toEqual([])
  })

  it('clears the local session and plants even if logout fails offline', async () => {
    const auth = useAuthStore()
    auth.accessToken = 'token'
    auth.user = user
    const store = usePlantsStore()
    store.plants = [plant]
    fetch.mockRejectedValueOnce(new TypeError('offline'))
    await expect(auth.logout()).rejects.toThrow('Could not reach the server')
    expect(auth.isAuthenticated).toBe(false)
    expect(store.plants).toEqual([])
    expect(sessionStorage.getItem('leaf-access-token')).toBeNull()
  })

  it('does not restore plant data from a request that finishes after logout', async () => {
    const auth = useAuthStore()
    auth.accessToken = 'token'
    const store = usePlantsStore()
    let finish
    fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const pending = store.fetchPlants()
    auth.clearSession()
    finish(reply({ plants: [plant] }))
    await expect(pending).rejects.toThrow('session changed')
    expect(store.plants).toEqual([])
  })

  it('keeps backend field validation errors available to the form', async () => {
    useAuthStore().accessToken = 'token'
    fetch.mockResolvedValueOnce(reply({ message: 'Fix fields', errors: { plantName: 'Required' } }, 400))
    await expect(usePlantsStore().savePlant(new FormData())).rejects.toMatchObject({
      status: 400, errors: { plantName: 'Required' },
    })
  })
})
