<script setup>
import { onMounted } from 'vue'
import { useWeather } from '@/composables/schedule/useWeather'

const props = defineProps({ userLat: Number, userLng: Number })
const { condition, stationName, loading, fetchForecast } = useWeather(props.userLat, props.userLng)

onMounted(fetchForecast)
</script>

<template>
  <div class="weather-header p-3 rounded" :class="`theme-${condition}`">
    <span v-if="loading">Checking weather…</span>
    <span v-else>
      {{ condition === 'rain' ? '🌧️' : condition === 'cloudy' ? '☁️' : '☀️' }}
      Current conditions near {{ stationName }}
    </span>
  </div>
</template>

<style scoped>
.theme-rain { background: #d6e4f0; }
.theme-sunny { background: #fff3cd; }
.theme-cloudy { background: #e2e3e5; }
</style>