<script setup>
import Loading from '@/components/Loading.vue'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlantsStore } from '@/stores/plants'
import WeatherHeader from '../components/schedule/WeatherHeader.vue'
import ScheduleCalendar from '../components/schedule/ScheduleCalendar.vue'
import ScheduleList from '../components/schedule/ScheduleList.vue'
import ScheduleAlertBanner from '../components/schedule/ScheduleAlertBanner.vue'
import { buildSchedule } from '../composables/schedule/buildSchedule'
import { useWeather } from '../composables/schedule/useWeather'
import { applyWeatherAdjustments } from '../composables/schedule/applyWeatherAdjustments'
import ScheduleViewToggle from '../components/schedule/ScheduleViewToggle.vue'
import { buildSitterSchedule } from '../composables/schedule/buildSitterSchedule'

const auth = useAuthStore()
const plantsStore = usePlantsStore()
const route = useRoute()
const router = useRouter()

const view = computed({
  get: () => (route.query.view === 'sitting' ? 'sitting' : 'mine'),
  set: (value) => router.replace({ query: { ...route.query, view: value === 'sitting' ? 'sitting' : undefined } }),
})

// my plants
const loading = ref(true)
const errorMessage = ref(null)
const schedule = ref([])   // array of RequestItem-shaped objects
const plants = computed(() => plantsStore.plants)

// plants i am sitting
const sittingVisits = ref([])
const sittingLoading = ref(true)
const sittingError = ref(null)
const sittingItems = computed(() => buildSitterSchedule(sittingVisits.value))
const sittingTodo = computed(() => sittingItems.value.filter((i) => i.status === 'due' || i.status === 'overdue').length)

// what the calendar, list and banner show right now
const activeItems = computed(() => (isHelper.value ? sittingItems.value : adjustedSchedule.value))
const busy = computed(() => (view.value === 'sitting' ? sittingLoading.value : loading.value))
const failure = computed(() => (view.value === 'sitting' ? sittingError.value : errorMessage.value))

async function loadSitting() {
  try {
    const data = await auth.authorizedRequest('/care-visits')
    sittingVisits.value = data.visits
  } catch (error) {
    sittingError.value = error.message
  } finally {
    sittingLoading.value = false
  }
}

// the logged-in owner (useWeather looks up where they live from their postal code)
const user = computed(() => auth.user)


// true while the sitter schedule is on screen; decides which data the alert banner reads
const isHelper = computed(() => view.value === 'sitting')

// fetch weather, shared to header and schedule logic
const {condition, stationName, forecastText, tempHigh, loading: weatherLoading, error: weatherError, fetchForecast, fetchTemperature} = useWeather()

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
  loadSitting()
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

    <ScheduleViewToggle v-model="view" :badge="sittingTodo" />

    <!-- Use the shared tree for both owner and sitter schedule requests. -->
    <Loading v-if="busy" label="Loading schedule…" />
    <div v-else-if="failure" class="alert alert-danger">
      Could not load {{ view === 'sitting' ? 'the plants you are sitting' : 'your schedule' }}: {{ failure }}
    </div>

    <template v-else>
      <ScheduleAlertBanner :key="view" :items="isHelper ? sittingItems : adjustedSchedule" />

      <!-- :key changes with the view, so Vue plays the crossfade -->
      <Transition name="view-fade" mode="out-in">
        <div :key="view">
          <div v-if="view === 'sitting' && !sittingItems.length" class="schedule-empty">
            <div class="schedule-empty-icon">🤝</div>
            <strong>You are not sitting any plants yet</strong>
            <p class="text-muted mb-2">Accept a request and its watering days will appear here.</p>
            <RouterLink class="btn btn-success btn-sm" to="/find-nearby">Find plants nearby</RouterLink>
          </div>
          <!-- No plants at all: point new users to Add plant (on phones it's otherwise hidden in the menu) -->
          <div v-else-if="view !== 'sitting' && !plants.length" class="schedule-empty">
            <div class="schedule-empty-icon">🪴</div>
            <strong>You haven't added any plants yet</strong>
            <p class="text-muted mb-2">Add your first plant and we'll build your watering schedule for you.</p>
            <RouterLink class="btn btn-success btn-sm" to="/plants/new">+ Add your first plant</RouterLink>
          </div>
          <template v-else>
            <ScheduleCalendar class="d-none d-md-block" :items="activeItems" />
            <ScheduleList class="d-md-none" :items="activeItems" />
          </template>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.view-fade-enter-active, .view-fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.view-fade-enter-from { opacity: 0; transform: translateY(8px); }
.view-fade-leave-to   { opacity: 0; transform: translateY(-8px); }

/* Empty box: everything stacked and centred, and never wider than the screen */
.schedule-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
  margin: 1.5rem auto;
  padding: 1.5rem 1rem;
  text-align: center;
  overflow-wrap: anywhere;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.6);
  border: 1px dashed rgba(34, 197, 94, 0.5);
}
.sitting-empty .btn { display: inline-flex; align-items: center; justify-content: center; line-height: 1.5; padding-block: 0.5rem; }
.schedule-empty-icon { font-size: 2rem; }

@media (prefers-reduced-motion: reduce) {
  .view-fade-enter-active, .view-fade-leave-active { transition: none; }
}
</style>
