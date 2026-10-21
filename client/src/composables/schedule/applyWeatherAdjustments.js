import { toDateInputValue } from '../../utils/wateringStatus.js'
import { addDays } from './buildSchedule.js'

// takes schedule items and returns new list, rain-affected items moved to next day
export function applyWeatherAdjustments(items, plants, weather, now = new Date()) {
    // if no rain no change
    if (weather.condition !== 'rain') {
        return items
    }
    // standardise dates
    const todayISO = toDateInputValue(now)
    const tomorrowISO = toDateInputValue(addDays(now, 1))

    const result = []

    for (const item of items) {
        let plant = null
        // find plant with same id as item id
        for (const p of plants) {
            if (p.plantId === item.plantId) {
                plant = p
                break
            }
        }

        // check if items hould be skipped due to rain
        let shouldSkip = false
        if (plant !== null) {
            if (plant.rainExposed === true && plant.weatherAdjustmentEnabled === true) {
                if (item.status === 'due' && item.dueAt === todayISO) {
                    shouldSkip = true
                }
            }
        }

        if (shouldSkip) {
            const area = weather.stationName ? ` near ${weather.stationName}` : ''
            result.push({
                requestItemId: item.requestItemId,
                plantId: item.plantId,
                plantName: item.plantName,
                status: 'upcoming',
                originalDueAt: item.originalDueAt,     // stays today, so the card knows it moved
                dueAt: tomorrowISO,                    // the new date
                adjustmentType: 'skipped-rain',
                adjustmentReason: `Rain forecast${area}, so watering was moved to tomorrow.`,
            })
        } else {
            result.push(item)
        }
    }
    
    return result
}