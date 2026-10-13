import router from '@/router'

const BASE = '/api/plants'

// Throws an Error with .status and .errors ({ field: message }) on failure.
async function request(url, options = {}) {
  let res
  try {
    res = await fetch(url, { credentials: 'same-origin', ...options })
  } catch {
    throw Object.assign(new Error('Could not reach the server. Is it running?'), { errors: {} })
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) {
      await router.replace('/signin')
    }
    const err = new Error(body?.message || `Request failed (${res.status})`)
    err.status = res.status
    err.errors = body?.errors || {}
    throw err
  }
  return body
}

export const listPlants = () => request(BASE).then((b) => b.plants)
export const getPlant = (plantId) => request(`${BASE}/${plantId}`).then((b) => b.plant)
export const createPlant = (formData) =>
  request(BASE, { method: 'POST', body: formData }).then((b) => b.plant)
export const updatePlant = (plantId, formData) =>
  request(`${BASE}/${plantId}`, { method: 'PATCH', body: formData }).then((b) => b.plant)
export const markWatered = (plantId) =>
  request(`${BASE}/${plantId}/water`, { method: 'PATCH' }).then((b) => b.plant)
export const deletePlant = (plantId) => request(`${BASE}/${plantId}`, { method: 'DELETE' })

// photoUrl is a full Cloudinary link, so it can go straight into <img src>.
export const photoSrc = (photoUrl) => photoUrl || ''
