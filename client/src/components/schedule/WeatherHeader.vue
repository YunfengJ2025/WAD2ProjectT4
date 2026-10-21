<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  condition: String,
  forecastText: String,
  stationName: String,
  loading: Boolean,
  error: String,
  forceCondition: String, // testing/demo override: 'rain' | 'cloudy' | 'sunny'
  forceNight: Boolean, // testing/demo override, because your demo will probably be in daytime
})

function singaporeHour() {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Singapore',
    }).format(new Date()),
  )
}

// remove props.forceCondition after testing
const theme = computed(() => props.forceCondition ?? props.condition ?? 'unknown')

//const isNight = computed(() => forecastText.value?.includes('Night'))
const isNight = computed(() => {
  if (props.forceNight) return true
  const text = props.forecastText ?? ''
  if (text.includes('(Night)')) return true
  if (text.includes('(Day)')) return false
  const hour = singaporeHour() // no label (e.g. plain "Cloudy"), so use the clock
  return hour >= 19 || hour < 7
})

// Rain keeps its own look, so stars only show for clear or cloudy nights
const showStars = computed(() => isNight.value && theme.value !== 'rain')

const stars = Array.from({ length: 35 }, () => ({
  left: Math.random() * 100,
  top: Math.random() * 100,
  size: 1 + Math.random() * 2.5,
  duration: 1.5 + Math.random() * 2.5,
  delay: Math.random() * 3,
}))

// Raindrops: random position, speed and delay, generated once
const drops = Array.from({ length: 40 }, () => ({
  left: Math.random() * 100,
  height: 10 + Math.random() * 14,
  duration: 0.6 + Math.random() * 0.6,
  delay: Math.random() * 1.5,
}))
const heavyRain = ref(false)
const visibleDrops = computed(() => drops.slice(0, heavyRain.value ? 40 : 18))

// The clickable weather element
const toy = computed(() => {
  if (theme.value === 'rain') return { icon: '🌧️', label: 'Toggle heavier rain', play: 'wiggle' }
  if (theme.value === 'cloudy') return { icon: isNight.value ? '☁️' : '⛅', label: 'Poke the cloud', play: 'wiggle' }
  return showStars.value ? { icon: '🌙', label: 'Poke the moon', play: 'wiggle' } : { icon: '☀️', label: 'Spin the sun', play: 'spin' }
})

const playing = ref(false)
function play() {
  playing.value = true
  if (theme.value === 'rain') heavyRain.value = !heavyRain.value
}

</script>

<template>
  <div class="weather-header rounded mb-3 p-3 position-relative overflow-hidden" :class="[`theme-${theme}`, { night: showStars }]">
    <div v-if="showStars" class="stars" aria-hidden="true">
      <span
        v-for="(s, i) in stars"
        :key="i"
        class="star"
        :style="{
          left: s.left + '%',
          top: s.top + '%',
          width: s.size + 'px',
          height: s.size + 'px',
          animationDuration: s.duration + 's',
          animationDelay: s.delay + 's',
        }"
      ></span>
    </div>
    <div v-if="theme === 'rain'" class="rain" aria-hidden="true">
      <span
        v-for="(d, i) in visibleDrops"
        :key="i"
        class="drop"
        :style="{
          left: d.left + '%',
          height: d.height + 'px',
          animationDuration: d.duration + 's',
          animationDelay: d.delay + 's',
        }"
      ></span>
    </div>

    <div class="position-relative d-flex justify-content-between align-items-center">
      <div>
        <span v-if="loading">Checking weather…</span>
        <span v-else-if="error">Weather unavailable right now ({{ error }})</span>
        <template v-else>
          <strong>{{ forecastText }}</strong>
          <span class="small ms-2">near {{ stationName }}</span>
        </template>
      </div>

      <button
        v-if="!loading && !error && theme !== 'unknown'"
        type="button"
        class="toy"
        :class="playing ? toy.play : showStars ? 'idle-night' : `idle-${theme}`"
        :aria-label="toy.label"
        :aria-pressed="theme === 'rain' ? heavyRain : undefined"
        @click="play"
        @animationend="playing = false"
      >{{ toy.icon }}</button>
    </div>
  </div>
</template>

<style scoped>
.weather-header { color: #212529; min-height: 80px; }
.theme-sunny { background: linear-gradient(135deg, #fff3cd, #ffd966); }
.theme-cloudy { background: linear-gradient(135deg, #e9ecef, #ced4da); }
.theme-rain { background: linear-gradient(135deg, #b8cde0, #8aa4bd); color: #1d2b3a; }
.theme-unknown { background: #f8f9fa; }

.night { background: linear-gradient(135deg, #0b1d3a, #2c3e6b); color: #f1f3f5; }

.stars { position: absolute; inset: 0; pointer-events: none; }
.star {
  position: absolute;
  border-radius: 50%;
  background: #fff;
  opacity: 0.8;
  animation: twinkle ease-in-out infinite;
}
@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.3); }
}

.rain { position: absolute; inset: 0; pointer-events: none; }
.drop {
  position: absolute;
  top: -30px;
  width: 2px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.7);
  animation: drop-fall linear infinite;
}
@keyframes drop-fall { to { transform: translateY(160px); } }

.toy {
  background: none;
  border: 0;
  font-size: 2.5rem;
  line-height: 1;
  padding: 0 0.25rem;
  cursor: pointer;
}
.idle-sunny { animation: spin 12s linear infinite; }
.idle-cloudy, .idle-rain .idle-night { animation: float 3s ease-in-out infinite; }
.spin { animation: spin 0.8s ease-in-out 2; }
.wiggle { animation: wiggle 0.5s ease-in-out; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes float { 50% { transform: translateY(-6px); } }
@keyframes wiggle {
  25% { transform: rotate(-12deg) scale(1.1); }
  75% { transform: rotate(12deg) scale(1.1); }
}

@media (prefers-reduced-motion: reduce) {
  .drop, .toy { animation: none !important; }
}
</style>