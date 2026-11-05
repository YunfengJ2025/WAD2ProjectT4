import { beforeEach, expect, it, vi } from 'vitest'
import { usePlantWatering } from './usePlantWatering'

const { markWatered, toast } = vi.hoisted(() => ({ markWatered: vi.fn(), toast: vi.fn() }))
vi.mock('@/stores/plants', () => ({ usePlantsStore: () => ({ markWatered }) }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ show: toast }) }))
const plant = { plantId: 7, plantName: 'Fern', lastWateredAt: null }
beforeEach(() => vi.resetAllMocks())

it('asks for confirmation before saving an upcoming watering', async () => {
  const action = usePlantWatering(() => plant, () => ({ key: 'upcoming' }))
  await action.onWaterClick()
  expect(action.confirmingEarly.value).toBe(true)
  expect(markWatered).not.toHaveBeenCalled()
  await action.markWatered()
  expect(markWatered).toHaveBeenCalledWith(7)
  expect(action.confirmingEarly.value).toBe(false)
})

it('prevents duplicate saves while pending and uses the caller’s success message', async () => {
  let complete
  markWatered.mockReturnValue(new Promise((resolve) => { complete = resolve }))
  const action = usePlantWatering(() => plant, () => ({ key: 'due' }), () => 'Fern watered')
  const pending = action.onWaterClick()
  expect(action.waterLabel.value).toBe('Saving…')
  await action.onWaterClick()
  expect(markWatered).toHaveBeenCalledTimes(1)
  complete()
  await pending
  expect(toast).toHaveBeenCalledWith('Fern watered')
  expect(action.watering.value).toBe(false)
})

it('shows save errors and allows another attempt', async () => {
  markWatered.mockRejectedValueOnce(new Error('Could not save'))
  const action = usePlantWatering(() => plant, () => ({ key: 'due' }))
  await action.onWaterClick()
  expect(toast).toHaveBeenCalledWith('Could not save', 'error')
  expect(action.watering.value).toBe(false)
  await action.onWaterClick()
  expect(markWatered).toHaveBeenCalledTimes(2)
})

it('handles a missing plant while its page loads', async () => {
  const action = usePlantWatering(() => null, () => null)
  expect(action.wateredToday.value).toBe(false)
  await action.onWaterClick()
  expect(markWatered).not.toHaveBeenCalled()
})
