import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

export const usePlantsStore = defineStore('plants', () => {
  const auth = useAuthStore()
  const plants = ref([])
  function reset() { plants.value = [] }
  watch(() => auth.accessToken, reset, { flush: 'sync' })

  const findPlant = (id) => plants.value.find((plant) => String(plant.plantId) === String(id))
  function upsert(plant) {
    const index = plants.value.findIndex((item) => item.plantId === plant.plantId)
    if (index < 0) plants.value.unshift(plant)
    else plants.value[index] = plant
  }

  async function load(url, options) {
    const token = auth.accessToken
    const data = await auth.authorizedRequest(url, options)
    // Ignore responses belonging to a session that has ended.
    if (auth.accessToken !== token) throw new Error('Your session changed. Please try again.')
    return data
  }
  async function fetchPlants() {
    const data = await load('/plants')
    plants.value = data.plants
    return plants.value
  }
  async function fetchPlant(id) {
    const { plant } = await load(`/plants/${id}`)
    upsert(plant)
    return plant
  }
  async function savePlant(formData, id) {
    const { plant } = await load(id == null ? '/plants' : `/plants/${id}`, {
      method: id == null ? 'POST' : 'PATCH', body: formData,
    })
    upsert(plant)
    return plant
  }
  async function deletePlant(id) {
    await load(`/plants/${id}`, { method: 'DELETE' })
    plants.value = plants.value.filter((plant) => String(plant.plantId) !== String(id))
  }
  async function markWatered(id) {
    const { plant } = await load(`/plants/${id}/water`, { method: 'PATCH' })
    upsert(plant)
    return plant
  }
  return { plants, findPlant, fetchPlants, fetchPlant, savePlant, deletePlant, markWatered, reset }
})
