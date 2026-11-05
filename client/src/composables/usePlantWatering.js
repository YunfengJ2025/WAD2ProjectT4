import { computed, ref } from 'vue'
import { usePlantsStore } from '@/stores/plants'
import { useToast } from '@/composables/useToast'
import { isWateredToday } from '@/utils/wateringStatus'

// Shared save state and early-watering confirmation for plant cards and details.
export function usePlantWatering(getPlant, getStatus, successMessage = () => 'Watering recorded') {
  const plantsStore = usePlantsStore()
  const { show: toast } = useToast()
  const watering = ref(false)
  const confirmingEarly = ref(false)
  const wateredToday = computed(() => Boolean(getPlant() && isWateredToday(getPlant())))
  const waterLabel = computed(() => {
    if (watering.value) return 'Saving…'
    return wateredToday.value ? 'Watered today ✓' : 'Mark watered'
  })

  async function markWatered() {
    if (watering.value || !getPlant()) return
    watering.value = true
    try {
      await plantsStore.markWatered(getPlant().plantId)
      toast(successMessage())
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      watering.value = false
      confirmingEarly.value = false
    }
  }

  function onWaterClick() {
    if (getStatus()?.key === 'upcoming') confirmingEarly.value = true
    else return markWatered()
  }

  return { watering, confirmingEarly, wateredToday, waterLabel, markWatered, onWaterClick }
}
