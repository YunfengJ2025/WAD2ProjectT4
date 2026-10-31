<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePlantsStore } from '@/stores/plants'
import WeatherHeader from '../components/schedule/WeatherHeader.vue'
import ScheduleCalendar from '../components/schedule/ScheduleCalendar.vue'
import ScheduleList from '../components/schedule/ScheduleList.vue'
import ScheduleAlertBanner from '../components/schedule/ScheduleAlertBanner.vue'
import OpenRequestsPreview from '../components/schedule/OpenRequestsPreview.vue'
import { buildSchedule } from '../composables/schedule/buildSchedule'
import { useWeather } from '../composables/schedule/useWeather'
import { applyWeatherAdjustments } from '../composables/schedule/applyWeatherAdjustments'

const auth = useAuthStore()
const plantsStore = usePlantsStore()

const loading = ref(true)
const errorMessage = ref(null)
const schedule = ref([])   // array of RequestItem-shaped objects
const plants = computed(() => plantsStore.plants)

// the logged-in owner; fall back to central Singapore if lat/lng were never set
const user = computed(() => auth.user)
const lat = auth.user?.lat ?? 1.3521
const lng = auth.user?.lng ?? 103.8198


const isHelper = ref(true) // placeholder, decides when the schedule alert banner shows

// fetch weather, shared to header and schedule logic
const {condition, stationName, forecastText, tempHigh, loading: weatherLoading, error: weatherError, fetchForecast, fetchTemperature} = useWeather(lat, lng)

// 'rain' to test the rain skip, 'sunny' for heat, null for real
const demoCondition = ref(null)
const demoTempHigh = ref(null) // null for real forecast

// Re-runs automatically when the plants, schedule or forecast change (condition.value)
const adjustedSchedule = computed(() =>
  applyWeatherAdjustments(schedule.value, plants.value, {
    condition: weatherLoading.value ? null : (demoCondition.value ?? condition.value),
    stationName: stationName.value,
    tempHigh: weatherLoading.value ? null : (demoTempHigh.value ?? tempHigh.value),
  }),
)

onMounted(async () => {
  // load forecast and plants together
  fetchForecast()
  fetchTemperature()

  try {
    await plantsStore.fetchPlants()          // sends the Bearer token for us
    schedule.value = buildSchedule(plants.value)
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="user">
    <!-- for testing animation
    <div class="d-flex gap-2 mb-2">
      <button class="btn btn-sm btn-outline-primary" @click="demoCondition = 'rain'">Rain</button>
      <button class="btn btn-sm btn-outline-primary" @click="demoCondition = 'sunny'">Sunny</button>
      <button class="btn btn-sm btn-outline-primary" @click="demoTempHigh = 35">Hot (35°C)</button>
      <button class="btn btn-sm btn-outline-secondary" @click="demoCondition = null; demoTempHigh = null">Real</button>
    </div>-->
    <!--
      Rain needs a plant with both Rain exposed and Weather adjustment ticked and due today.
      Hot needs weather adjustment ticked on a plant that isn’t already on today’s schedule.
    -->

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

    <!-- Home page: a few open requests, "View more" goes to Find Nearby -->
    <OpenRequestsPreview />
  </div>
</template>