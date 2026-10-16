<script setup>
import { ref, onMounted } from 'vue'
import WeatherHeader from '../components/schedule/WeatherHeader.vue'
import ScheduleCalendar from '../components/schedule/ScheduleCalendar.vue'
import ScheduleList from '../components/schedule/ScheduleList.vue'

// const schedule = ref([])   // array of RequestItem-shaped objects
// const user = ref(null)     // logged-in owner, has Lat/Lng
const user = ref({ lat: 1.3521, lng: 103.8198, userRole: 'user' }) // placeholder test user hardcoded

// placeholder test schedule hardcoded
const schedule = ref([
  { requestItemId: 1, plantName: 'Money Plant', status: 'upcoming',
    originalDueAt: '2026-10-17', dueAt: '2026-10-17', adjustmentType: null, adjustmentReason: null },
  { requestItemId: 2, plantName: 'Chilli', status: 'upcoming',
    originalDueAt: '2026-10-18', dueAt: '2026-10-19', adjustmentType: 'skipped-rain',
    adjustmentReason: 'Heavy rain recorded nearby on 18 Oct, so watering was moved back a day.' },
  { requestItemId: 3, plantName: 'Hibiscus', status: 'upcoming',
    originalDueAt: '2026-10-20', dueAt: '2026-10-19', adjustmentType: 'extra-heat',
    adjustmentReason: 'No rain for 3 days and temperatures above 33°C, so an extra watering was added.' },
])

onMounted(async () => {
  // fetch /api/users/me and /api/schedule?ownerId=... from backend
  // backend applies the weather-adjustment logic server-side and should return items already carrying adjustmentType / adjustmentReason
})
</script>

<template>
  <div v-if="user" style="grid-column: 1 / -1">
    <WeatherHeader :user-lat="user.lat" :user-lng="user.lng" />
    <ScheduleCalendar class="d-none d-md-block" :items="schedule" />
    <ScheduleList class="d-md-none" :items="schedule" />
  </div>
</template>