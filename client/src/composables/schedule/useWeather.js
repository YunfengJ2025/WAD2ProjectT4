import { ref } from 'vue'

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export function findNearestStation(stations, userLat, userLng) {
  // stations: [{ id, name, location: { latitude, longitude } }]
  return stations.reduce((nearest, s) => {
    const d = haversine(userLat, userLng, s.location.latitude, s.location.longitude)
    return !nearest || d < nearest.distance ? { ...s, distance: d } : nearest
  }, null)
}

export function useWeather(userLat, userLng) {
  const condition = ref(null)   // 'rain' | 'sunny' | 'cloudy'
  const stationName = ref(null)
  const loading = ref(true)
  const error = ref(null)

  async function fetchForecast() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast')
      if (!res.ok) throw new Error('Weather service unavailable')
      const json = await res.json()
      const areas = json.data.area_metadata
      const forecasts = json.data.items[0].forecasts

      const nearestArea = findNearestStation(
        areas.map(a => ({ ...a, location: a.label_location })),
        userLat, userLng
      )
      const match = forecasts.find(f => f.area === nearestArea.name)
      stationName.value = nearestArea.name
      condition.value = classifyForecast(match?.forecast ?? '')
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  function classifyForecast(text) {
    const t = text.toLowerCase()
    if (t.includes('rain') || t.includes('shower') || t.includes('thundery')) return 'rain'
    if (t.includes('cloudy') || t.includes('overcast')) return 'cloudy'
    return 'sunny'
  }

  return { condition, stationName, loading, error, fetchForecast }
}