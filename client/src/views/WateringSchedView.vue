<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import WeatherHeader from '../components/schedule/WeatherHeader.vue'
import ScheduleCalendar from '../components/schedule/ScheduleCalendar.vue'
import ScheduleList from '../components/schedule/ScheduleList.vue'
import ScheduleAlertBanner from '../components/schedule/ScheduleAlertBanner.vue'
import { buildSchedule } from '../composables/schedule/buildSchedule'
import { useWeather } from '../composables/schedule/useWeather'
import { applyWeatherAdjustments } from '../composables/schedule/applyWeatherAdjustments'

const loading = ref(true)
const errorMessage = ref(null)
const schedule = ref([])   // array of RequestItem-shaped objects
const plants = ref([])
// const user = ref(null)     // logged-in owner, has Lat/Lng
const user = ref({ lat: 1.3521, lng: 103.8198, userRole: 'user' }) // placeholder test user hardcoded

const isHelper = ref(true) // placeholder

// fetch weather, shared to header and schedule logic
const {condition, stationName, forecastText, loading: weatherLoading, error: weatherError, fetchForecast} = useWeather(user.value.lat, user.value.lng)

// For testing: set to 'rain' to force a rainy day. Use null for the real forecast.
const demoCondition = null

// Re-runs automatically when the plants, schedule or forecast change (condition.value)
const adjustedSchedule = computed(() =>
  applyWeatherAdjustments(schedule.value, plants.value, {
    condition: weatherLoading.value ? null : (demoCondition ?? condition.value),
    stationName: stationName.value,
  }),
)

onMounted(async () => {
  // load forecast and plants together
  fetchForecast()

  try {
    const response = await axios.get('/api/plants')

    plants.value = response.data.plants // the response is {count, plants}
    schedule.value = buildSchedule(plants.value)
    
  } catch (error) {
    errorMessage.value = error.response?.data?.message ?? error.message
  } finally {
    loading.value = false
  }
})
</script>


<template>
  <div v-if="user">
    <!--force-condition="sunny", "cloudy" or "rain" or <WeatherHeader ... force-night />-->
    <WeatherHeader 
      :condition="condition"
      :force-condition="demoCondition"
      :forecast-text="forecastText"
      :station-name="stationName"
      :loading="weatherLoading"
      :error="weatherError"
    />

    <div v-if="loading" class="text-center my-3">
      <div class="spinner-border" role="status"><span class="visually-hidden">Loading…</span></div>
    </div>
    <div v-else-if="errorMessage" class="alert alert-danger">
      Could not load your schedule: {{ errorMessage }}
    </div>

    <template v-else>
      <ScheduleAlertBanner v-if="isHelper" :items="adjustedSchedule" />
      <ScheduleCalendar class="d-none d-md-block" :items="adjustedSchedule" />
      <ScheduleList class="d-md-none" :items="adjustedSchedule" />
    </template>
  </div>
</template>