<script setup>
import { ref, onMounted } from 'vue'
import WeatherHeader from '@/components/schedule/WeatherHeader.vue'
import ScheduleCalendar from '@/components/schedule/ScheduleCalendar.vue'
import ScheduleList from '@/components/schedule/ScheduleList.vue'

const schedule = ref([])   // array of RequestItem-shaped objects
const user = ref(null)     // logged-in owner, has Lat/Lng

onMounted(async () => {
  // fetch /api/users/me and /api/schedule?ownerId=... from backend
  // backend applies the weather-adjustment logic server-side and should return items already carrying adjustmentType / adjustmentReason
})
</script>

<template>
  <div v-if="user">
    <WeatherHeader :user-lat="user.Lat" :user-lng="user.Lng" />
    <ScheduleCalendar class="d-none d-md-block" :items="schedule" />
    <ScheduleList class="d-md-none" :items="schedule" />
  </div>
</template>