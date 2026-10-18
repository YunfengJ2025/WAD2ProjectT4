<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import WeatherHeader from '../components/schedule/WeatherHeader.vue'
import ScheduleCalendar from '../components/schedule/ScheduleCalendar.vue'
import ScheduleList from '../components/schedule/ScheduleList.vue'
import ScheduleAlertBanner from '../components/schedule/ScheduleAlertBanner.vue'

const loading = ref(true)
const errorMessage = ref(null)
const schedule = ref([])   // array of RequestItem-shaped objects
// const user = ref(null)     // logged-in owner, has Lat/Lng
const user = ref({ lat: 1.3521, lng: 103.8198, userRole: 'user' }) // placeholder test user hardcoded

const USE_MOCK = true // set bacjk to false oncce GET / schedule exists
// dates relative to today so the demo always falls inside the calendar's 7-day window
function daysFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

// placeholder remove later
const MOCK_SCHEDULE = [
  { requestItemId: 1, plantName: 'Money Plant', status: 'upcoming',
    originalDueAt: daysFromToday(0), dueAt: daysFromToday(0),
    adjustmentType: null, adjustmentReason: null },
  { requestItemId: 2, plantName: 'Chilli', status: 'upcoming',
    originalDueAt: daysFromToday(1), dueAt: daysFromToday(2), adjustmentType: 'skipped-rain',
    adjustmentReason: 'Heavy rain recorded nearby, so watering was moved back a day.' },
  { requestItemId: 3, plantName: 'Hibiscus', status: 'upcoming',
    originalDueAt: daysFromToday(3), dueAt: daysFromToday(2), adjustmentType: 'extra-heat',
    adjustmentReason: 'No rain for 3 days and temperatures above 33°C, so an extra watering was added.' },
]

const isHelper = ref(true) // placeholder

onMounted(async () => {
  // remove later
  if (USE_MOCK) {
    schedule.value = MOCK_SCHEDULE
    loading.value = false
    return
  }

  try {
    const url = 'http://localhost:8000/schedule'
    const response = await axios.get(url, { 
      params: { 
        ownerId: user.value.userId 
      } 
    })

    schedule.value = response.data
    
  } catch (error) {
    errorMessage.value = error.response?.data?.message ?? error.message
  } finally {
    loading.value = false
  }
})
</script>


<template>
  <div v-if="user" style="grid-column: 1 / -1">
    <!--force-condition="sunny", "cloudy" or "rain" or <WeatherHeader ... force-night />-->
    <WeatherHeader :user-lat="user.lat" :user-lng="user.lng" force-condition="sunny"/>

    <div v-if="loading" class="text-center my-3">
      <div class="spinner-border" role="status"><span class="visually-hidden">Loading…</span></div>
    </div>
    <div v-else-if="errorMessage" class="alert alert-danger">
      Could not load your schedule: {{ errorMessage }}
    </div>

    <template v-else>
      <ScheduleAlertBanner v-if="isHelper" :items="schedule" />
      <ScheduleCalendar class="d-none d-md-block" :items="schedule" />
      <ScheduleList class="d-md-none" :items="schedule" />
    </template>
  </div>
</template>