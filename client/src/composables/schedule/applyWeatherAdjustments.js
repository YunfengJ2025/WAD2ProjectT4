import { toDateInputValue } from '../../utils/wateringStatus.js'
import { addDays } from './buildSchedule.js'

// takes schedule items and returns new list, rain-affected items moved to next day
function skipForRain(items, plants, weather, now = new Date()) {
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
                ...item,                               // copies every field, including photoUrl and plantLocation
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

const HEAT_THRESHOLD = 34 // celcius

// add extra watering day for plants that need it in hot weather
function addExtraForHeat(items, plants, weather, now) {
    // if rains no change
    if (weather.condition === 'rain') {
        return items
    }
    // if weather not too hot
    if (typeof weather.tempHigh !== 'number' || weather.tempHigh < HEAT_THRESHOLD) {
        return items
    }    

    const todayISO = toDateInputValue(now)

    const result = []
    for (const item of items) {
        result.push(item)
    }

    for (const plant of plants) {
        let needsExtra = true

        // check if  weatherAdjustment is set to false
        if (plant.weatherAdjustmentEnabled !== true) {
            needsExtra = false
        }

        // check if plant is already on today's schedule
        for (const item of items) {
            if (item.plantId === plant.plantId && item.dueAt === todayISO) {
                needsExtra = false
            }
        }

        // check if plant is already watered today
        if (plant.lastWateredAt) {
            if (toDateInputValue(plant.lastWateredAt) === todayISO) {
                needsExtra = false
            }
        }

        if (needsExtra) {
            result.push({
                requestItemId: `${plant.plantId}-${todayISO}-heat`, // creates new item (task for watering), '-heat' wont clash
                plantId: plant.plantId,
                plantName: plant.plantName,
                photoUrl: plant.photoUrl || '',
                plantLocation: plant.plantLocation || '',
                status: 'due',
                originalDueAt: todayISO,
                dueAt: todayISO,
                adjustmentType: 'extra-heat',
                adjustmentReason: `Forecast high of ${weather.tempHigh}°C today, so an extra watering was added.`,
            })            
        }
    }

    return result
}

// first calls the rain skips then the heat extras
export function applyWeatherAdjustments(items, plants, weather, now = new Date()) {
  const afterRain = skipForRain(items, plants, weather, now)
  return addExtraForHeat(afterRain, plants, weather, now)
}