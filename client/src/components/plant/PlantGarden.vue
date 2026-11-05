<script setup>
// Garden view: my plants on a tilted island.
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getWateringStatus } from '@/utils/wateringStatus'
import { usePlantsStore } from '@/stores/plants'
import { useToast } from '@/composables/useToast'
import { useWeather } from '@/composables/schedule/useWeather'
import StatusPill from './StatusPill.vue'
import PlantIcon from './PlantIcon.vue'

const props = defineProps({
  plants: { type: Array, required: true },
})

// Weather: reuses Ari's useWeather composable (data.gov.sg API)
// It finds the user's area from their postal code (same OneMap lookup as Find Nearby)
const {
  condition,
  stationName,
  tempHigh,
  loading: weatherLoading,
  error: weatherError,
  fetchForecast,
  fetchTemperature,
} = useWeather()

onMounted(() => {
  fetchForecast()
  fetchTemperature()
})

// Falls back to sunny while loading or if the API fails
const weather = computed(() => {
  if (weatherLoading.value || weatherError.value || !condition.value) return 'sunny'
  return condition.value
})

const weatherLabel = computed(() => {
  if (weatherLoading.value) return 'Checking the weather…'
  if (weatherError.value || !condition.value) return ''
  let text = '☀️ Sunny'
  if (condition.value === 'cloudy') text = '☁️ Cloudy'
  if (condition.value === 'rain') text = '🌧️ Rain'
  if (stationName.value) text += ` · ${stationName.value}`
  if (tempHigh.value) text += ` · ${tempHigh.value}°C`
  return text
})

// Tiles per side (the island is a square):
//   sqrt  -> side length that fits all plants (6 plants -> 2.45)
//   ceil  -> round up so every plant gets a tile (2.45 -> 3)
//   max 3 -> never smaller than 3 x 3
// e.g. 6 plants -> 3 x 3 (9 tiles), 10 plants -> 4 x 4 (16 tiles)
const size = computed(() => Math.max(3, Math.ceil(Math.sqrt(props.plants.length))))

// Bigger island = smaller plants. CSS reads it as --plant-scale
const plantScale = computed(() => 3 / size.value)

// One item per tile (size x size). The first tiles get a plant, the rest are empty grass:
//   { index: 0, plant: Monstera, status: {...} } ... { index: 8, plant: null, status: null }
// props.plants[i] is undefined when we run out of plants, so || null makes it null
// Sorted by plantId so each plant keeps its own tile (My Plants re-sorts by urgency,
// which would make a plant jump to another tile right when it gets watered)
const placedPlants = computed(() => props.plants.slice().sort((a, b) => a.plantId - b.plantId))

const tiles = computed(() => {
  const list = []
  for (let i = 0; i < size.value * size.value; i++) {
    const plant = placedPlants.value[i] || null
    list.push({
      index: i,
      plant: plant,
      status: plant ? getWateringStatus(plant) : null,
    })
  }
  return list
})

// Revive animation: plays when a plant goes from overdue/due to healthy,
// no matter where it was watered (this list, Today panel, cards, detail page).
// lastStatus remembers each plant's status so watch can see what changed.
const reviving = ref([]) // plantIds playing the animation right now
const lastStatus = {}
for (const tile of tiles.value) {
  if (tile.plant) lastStatus[tile.plant.plantId] = tile.status.key
}

watch(tiles, (newTiles) => {
  for (const tile of newTiles) {
    if (!tile.plant) continue
    const id = tile.plant.plantId
    const before = lastStatus[id]
    const now = tile.status.key
    if ((before === 'overdue' || before === 'due') && now === 'upcoming') startRevive(id)
    lastStatus[id] = now
  }
})

// setTimeout removes the plant again once the animation (1.6s) has finished
function startRevive(id) {
  reviving.value.push(id)
  setTimeout(() => {
    reviving.value = reviving.value.filter((plantId) => plantId !== id)
  }, 1600)
}

function isReviving(plant) {
  return reviving.value.includes(plant.plantId)
}

// 🚿 button in the side list: same store action as Mark watered everywhere else
const plantsStore = usePlantsStore()
const { show: toast } = useToast()
const wateringId = ref(null) // plantId being saved (disables its button)

async function water(plant) {
  if (wateringId.value) return
  wateringId.value = plant.plantId
  try {
    await plantsStore.markWatered(plant.plantId)
    toast(`${plant.plantName} watered`)
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    wateringId.value = null
  }
}

// Side list: most urgent first (daysUntil smallest)
const plantList = computed(() => {
  const list = tiles.value.filter((tile) => tile.plant)
  return list.sort((a, b) => a.status.daysUntil - b.status.daysUntil)
})

// Which PlantIcon to draw: the first row whose words appear in the plant's name.
// Order matters ("snake plant" must be checked before anything else). 'leafy' if nothing matches.
const ICON_WORDS = [
  ['snake', ['snake', 'sansevieria']],
  ['monstera', ['monstera', 'swiss cheese']],
  ['vine', ['pothos', 'money plant', 'ivy', 'vine', 'philodendron']],
  ['succulent', ['aloe', 'jade', 'echeveria', 'succulent', 'haworthia']],
  ['cactus', ['cactus']],
  ['flower', ['orchid', 'hibiscus', 'rose', 'flower', 'lily', 'anthurium']],
  ['herb', ['basil', 'herb', 'mint', 'lemongrass', 'pepper', 'chili', 'pandan']],
  ['tree', ['tree', 'rubber', 'fig', 'bonsai']],
]

function plantType(plant) {
  const name = plant.plantName.toLowerCase()
  for (const [type, words] of ICON_WORDS) {
    for (const word of words) {
      if (name.includes(word)) return type
    }
  }
  return 'leafy'
}

// Checkerboard: work out row + column from the position in the list
function isDark(index) {
  const row = Math.floor(index / size.value)
  const col = index % size.value
  return (row + col) % 2 === 1
}

// Fixed pattern (not random) so the garden looks the same every time
const DECORATIONS = ['🌼', '🍄', '🪨', '🌷', '🌱']
function decoration(index) {
  if (index % 2 === 1) return ''
  return DECORATIONS[index % DECORATIONS.length]
}
</script>

<template>
  <section class="garden" :class="`weather-${weather}`" aria-label="Garden view of your plants">
    <p v-if="weatherLabel" class="weather-label" role="status">{{ weatherLabel }}</p>

    <div class="garden-body">
      <div class="stage">
        <!-- aria-hidden: screen readers skip the decorations -->
        <div class="sky" aria-hidden="true">
          <div class="cloud-group group-left">
            <div class="cloud"></div>
            <div class="cloud cloud-small"></div>
          </div>
          <div class="cloud-group group-right">
            <div class="cloud cloud-small"></div>
            <div class="cloud"></div>
          </div>

          <div v-if="weather === 'sunny'" class="sun"></div>

          <div v-if="weather !== 'sunny'" class="cloud-group group-middle">
            <div class="cloud"></div>
          </div>

          <!-- Each drop gets its own position + delay so they don't fall together -->
          <div v-if="weather === 'rain'" class="rain">
            <span
              v-for="n in 24"
              :key="n"
              class="drop"
              :style="{ left: `${(n * 4.1) % 100}%`, animationDelay: `-${(n * 0.37) % 1.2}s` }"
            ></span>
          </div>

          <!-- Outer span = flight path, inner span = wing flap / buzz -->
          <template v-if="weather !== 'rain'">
            <span class="flyer butterfly"><span class="wings">🦋</span></span>
            <span class="flyer bee"><span class="buzz">🐝</span></span>
          </template>
        </div>

        <!-- '--plant-scale' = a CSS variable set from JS -->
        <div
          class="island"
          :style="{ gridTemplateColumns: `repeat(${size}, 1fr)`, '--plant-scale': plantScale }"
        >
          <div
            v-for="tile in tiles"
            :key="tile.index"
            class="tile"
            :class="[tile.status ? tile.status.key : 'empty', { dark: isDark(tile.index) }]"
          >
            <RouterLink
              v-if="tile.plant"
              :to="`/plants/${tile.plant.plantId}`"
              class="plant"
              :class="[tile.status.key, { reviving: isReviving(tile.plant) }]"
              :aria-label="`${tile.plant.plantName}: ${tile.status.label}`"
            >
              <!-- Revive: a droplet falls onto the plant, then the plant pops back -->
              <span v-if="isReviving(tile.plant)" class="falling-drop" aria-hidden="true">💧</span>
              <span v-if="tile.status.key === 'due'" class="bubble" aria-hidden="true">💧</span>
              <!-- size="1em": the icon follows the font-size set in the CSS -->
              <span class="emoji" aria-hidden="true">
                <PlantIcon
                  :type="plantType(tile.plant)"
                  :overdue="tile.status.key === 'overdue'"
                  size="1em"
                />
              </span>
              <span class="label">{{ tile.plant.plantName }}</span>
            </RouterLink>
            <span v-else-if="decoration(tile.index)" class="decor" aria-hidden="true">
              {{ decoration(tile.index) }}
            </span>
          </div>
        </div>
      </div>

      <aside class="side">
        <h3>Your garden</h3>
        <ul class="plant-list">
          <li v-for="tile in plantList" :key="tile.plant.plantId">
            <span class="list-icon" aria-hidden="true">
              <PlantIcon
                :type="plantType(tile.plant)"
                :overdue="tile.status.key === 'overdue'"
                :size="26"
              />
            </span>
            <!-- Name with its status tag underneath, so the Water button has room -->
            <div class="list-text">
              <RouterLink :to="`/plants/${tile.plant.plantId}`" class="list-name">
                {{ tile.plant.plantName }}
              </RouterLink>
              <StatusPill :status="tile.status" class="list-pill" />
            </div>
            <!-- Water button only for plants that need it -->
            <button
              v-if="tile.status.key !== 'upcoming'"
              type="button"
              class="water-btn"
              :disabled="wateringId !== null"
              :aria-label="`Water ${tile.plant.plantName}`"
              title="Water to revive"
              @click="water(tile.plant)"
            >
              🚿 Water
            </button>
          </li>
        </ul>

        <!-- Hint, only while some plant still needs water -->
        <p v-if="plantList.some((tile) => tile.status.key !== 'upcoming')" class="revive-hint">
          Tap <strong>🚿 Water</strong> next to a plant to water it and watch it revive
        </p>

        <ul class="legend">
          <li><PlantIcon type="leafy" :size="20" aria-hidden="true" /> Healthy</li>
          <li><span aria-hidden="true">💧</span> Needs water today</li>
          <li><PlantIcon type="wilted" :size="20" aria-hidden="true" /> Overdue (dry soil)</li>
        </ul>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.garden {
  position: relative;
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-radius: var(--radius);
  background: radial-gradient(circle at 50% 40%, #e9f7ec, #d4ecd9 70%);
  overflow: hidden;
  transition: background 0.6s ease;
}

.garden.weather-sunny {
  background: radial-gradient(circle at 85% 10%, #fff6d6, #e6f6e9 45%, #d4ecd9 80%);
}

/* Cloudy / rain: mint tints (match the page) but deep enough for white clouds to show */
.garden.weather-cloudy {
  background: radial-gradient(circle at 50% 30%, #e6f1eb, #cfe2d8 75%);
}

.garden.weather-rain {
  background: radial-gradient(circle at 50% 30%, #dfeaec, #c3d6d8 80%);
}

.weather-label {
  position: absolute;
  top: 0.9rem;
  left: 1rem;
  z-index: 3;
  margin: 0;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-heading);
  font-size: 0.85rem;
  font-weight: 600;
}

/* @keyframes = animation steps (used by every animation below) */
.sun {
  position: absolute;
  top: 6%;
  right: 5%;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  background: radial-gradient(circle, #fff3a6 0%, #ffd54a 60%, #ffc021 100%);
  box-shadow: 0 0 2.5rem 1rem rgba(255, 210, 80, 0.45);
  animation: glow 4s ease-in-out infinite;
}

@keyframes glow {
  0%,
  100% {
    box-shadow: 0 0 2.5rem 1rem rgba(255, 210, 80, 0.45);
  }
  50% {
    box-shadow: 0 0 3.5rem 1.6rem rgba(255, 210, 80, 0.3);
  }
}

.weather-cloudy .cloud,
.weather-cloudy .cloud::before,
.weather-cloudy .cloud::after {
  background: #ffffff;
}

.weather-rain .cloud,
.weather-rain .cloud::before,
.weather-rain .cloud::after {
  background: #f2f5f7;
}

.group-middle {
  top: 9%;
  left: 44%;
  animation-duration: 8s;
  animation-delay: -5s;
}

.rain {
  position: absolute;
  inset: 0;
}

.drop {
  position: absolute;
  top: -10%;
  width: 2px;
  height: 14px;
  border-radius: 2px;
  background: rgba(70, 120, 170, 0.55);
  animation: fall 1.2s linear infinite;
}

@keyframes fall {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(560px);
    opacity: 0.2;
  }
}

.stage {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 3rem 0 2.5rem;
}

.island {
  position: relative;
  z-index: 1;
}

/* z-index 2 = above the island. pointer-events: none = clicks go through */
.sky {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
}

.cloud-group {
  position: absolute;
  display: flex;
  align-items: flex-end;
  font-size: 15px;
  animation: float 7s ease-in-out infinite;
}

.group-left {
  top: 24%;
  left: 12%;
}

.group-right {
  top: 20%;
  right: 12%;
  animation-duration: 9s;
  animation-delay: -3s;
}

/* CSS cloud: rounded bar + 2 circles (::before, ::after). em = scales with font-size */
.cloud {
  position: relative;
  width: 9em;
  height: 2.6em;
  border-radius: 999px;
  background: #fff;
  opacity: 0.92;
  box-shadow: 0 0.6em 1.4em rgba(40, 80, 60, 0.22); /* darker shadow so clouds stand out */
}

.cloud::before,
.cloud::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: #fff;
}

.cloud::before {
  width: 3.4em;
  height: 3.4em;
  left: 1.2em;
  top: -1.6em;
}

.cloud::after {
  width: 4.6em;
  height: 4.6em;
  left: 3.6em;
  top: -2.5em;
}

/* Negative margin = clouds overlap into one shape */
.cloud-small {
  font-size: 0.65em;
  margin-left: -2.5em;
}

.group-left .cloud-small {
  order: 1;
  margin: 0 0 0 -2.5em;
}

.group-right .cloud-small {
  margin: 0 -2.5em 0 0;
}

.flyer {
  position: absolute;
}

/* transform only works on inline-block, not plain inline */
.wings,
.buzz {
  display: inline-block;
}

.butterfly {
  top: 14%;
  left: 58%;
  font-size: 1.5rem;
  animation: flutter 9s ease-in-out infinite;
}

.wings {
  animation: flap 0.22s ease-in-out infinite alternate;
}

.bee {
  top: 42%;
  left: 30%;
  font-size: 1.25rem;
  animation: bee-path 12s ease-in-out infinite;
}

.buzz {
  animation: buzz 0.12s linear infinite alternate;
}

/* Squeeze narrow and back fast = wings flapping */
@keyframes flap {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0.3);
  }
}

@keyframes buzz {
  from {
    transform: translateY(0) rotate(-6deg);
  }
  to {
    transform: translateY(-2px) rotate(6deg);
  }
}

@keyframes bee-path {
  0%,
  100% {
    transform: translate(0, 0);
  }
  25% {
    transform: translate(160px, -40px);
  }
  50% {
    transform: translate(320px, 20px);
  }
  75% {
    transform: translate(150px, 70px);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(8px, -10px);
  }
}

@keyframes flutter {
  0%,
  100% {
    transform: translate(0, 0) rotate(-8deg);
  }
  25% {
    transform: translate(-60px, 20px) rotate(8deg);
  }
  50% {
    transform: translate(-20px, -15px) rotate(-4deg);
  }
  75% {
    transform: translate(40px, 10px) rotate(6deg);
  }
}

/* Same stand-up trick as .plant */
.decor {
  position: absolute;
  left: 50%;
  bottom: 50%;
  display: flex;
  justify-content: center;
  width: 0;
  line-height: 1;
  transform-origin: 50% 100%;
  transform: rotate(-45deg) scaleY(1.724);
  font-size: calc(1.2rem * var(--plant-scale, 1));
  opacity: 0.9;
}

.island {
  display: grid;
  /* Diamond is ~1.4x wider after rotating, so keep this small */
  width: min(420px, 60vw);
  aspect-ratio: 1 / 1;
  /* 3D look: rotate into a diamond, then squash height to 58% */
  transform: scaleY(0.58) rotate(45deg);
  border-radius: 6px;
  /* Stacked shadows = grass edge + soil sides */
  box-shadow:
    2px 2px 0 #7cbf4f,
    4px 4px 0 #6aa842,
    6px 6px 0 #8b5a2b,
    9px 9px 0 #7a4e25,
    12px 12px 0 #6b4320,
    15px 15px 0 #5c3a1c,
    18px 18px 0 #4d3018;
}

.tile {
  position: relative;
  background: #9bd36b;
  border: 1px solid rgba(255, 255, 255, 0.25);
  /* Brown to green fades slowly after watering (waits 0.4s for the drop to land) */
  transition: background-color 1s ease 0.4s;
}

.tile.dark {
  background: #8cc95c;
}

.tile.due {
  background: #c3dd7e;
}

.tile.overdue {
  background: #cdb57a;
}

.plant {
  position: absolute;
  /* The bottom of the plant (base of the pot) sits on the middle of the tile */
  left: 50%;
  bottom: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 0;
  /* Undo the island tilt so the plant stands up (1 / 0.58 = 1.724).
     transform-origin: turn around the base of the pot, so it stays on the tile's middle */
  transform-origin: 50% 100%;
  transform: rotate(-45deg) scaleY(1.724);
  text-decoration: none;
}

.emoji {
  /* calc + CSS variable: smaller plants on bigger islands */
  font-size: calc(3rem * var(--plant-scale, 1));
  /* block + line-height 0: no empty text space under the icon */
  display: block;
  line-height: 0;
  filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.25));
  transition: transform 0.2s ease;
}

.plant.upcoming .emoji {
  animation: bob 3s ease-in-out infinite;
}

.plant:hover .emoji,
.plant:focus-visible .emoji {
  transform: scale(1.2);
}

.bubble {
  font-size: calc(1rem * var(--plant-scale, 1));
  animation: bob 1.6s ease-in-out infinite;
}

.label {
  position: absolute;
  top: 100%;
  margin-top: 0.2rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(20, 40, 25, 0.85);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.plant:hover .label,
.plant:focus-visible .label {
  opacity: 1;
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.25rem;
  margin: 0.75rem 0 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  list-style: none;
  font-size: 0.85rem;
  color: var(--muted);
}

.legend li {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.side {
  padding: 1rem 1.1rem;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.7);
}

.side h3 {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

.plant-list li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  /* padding left/right + the same negative margin: the hover highlight has room,
     but the text still lines up with the "Your garden" heading */
  padding: 0.4rem 0.5rem;
  margin: 0 -0.5rem;
  border-radius: 10px;
  transition: background-color 0.15s ease;
}

/* Hovering anywhere on a row: soft mint highlight */
.plant-list li:hover {
  background: rgba(124, 207, 90, 0.14);
}

.plant-list li + li {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.list-icon {
  display: flex;
  flex-shrink: 0;
  width: 1.7rem;
  justify-content: center;
}

/* Name on top, status tag underneath */
.list-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

/* Long names wrap onto a second line instead of being cut off */
.list-name {
  max-width: 100%;
  overflow-wrap: anywhere;
  line-height: 1.3;
  font-weight: 600;
  color: var(--color-heading);
  text-decoration: none;
}

/* No underline (Bootstrap) and no green box (main.css a:hover) on hover.
   The name turns the darker green instead. */
.list-name:hover {
  text-decoration: none;
  background: transparent;
  color: var(--accent);
}

/* A "›" after the name that slides in when you hover the row (::after adds it with CSS) */
.list-name::after {
  content: '›';
  display: inline-block;
  margin-left: 0.4rem; /* space between the name and the arrow */
  font-size: 1.35em; /* bigger than the name text */
  line-height: 0.8;
  vertical-align: -0.05em;
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.plant-list li:hover .list-name::after {
  opacity: 1;
  transform: translateX(0);
}

/* Plants on the island: no green box either; they grow and show their name instead */
.plant:hover,
.plant:focus-visible {
  background: transparent;
}

.plant-list .list-pill {
  flex-shrink: 0;
  padding: 0.15rem 0.5rem;
  font-size: 0.7rem;
  box-shadow: none;
}

.plant-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .garden-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: center;
    gap: 1.5rem;
  }

  .side {
    align-self: start;
  }

  .island {
    width: min(520px, 38vw);
  }

  .emoji {
    font-size: calc(3.8rem * var(--plant-scale, 1));
  }

  .decor {
    font-size: calc(1.5rem * var(--plant-scale, 1));
  }
}

@media (max-width: 600px) {
  .cloud-group {
    font-size: 9px;
  }

  .bee {
    animation-name: bee-path-small;
  }

  .emoji {
    font-size: calc(2.2rem * var(--plant-scale, 1));
  }

  .island {
    width: 54vw;
  }

  .stage {
    padding: 2.5rem 0 2rem;
  }
}

@keyframes bee-path-small {
  0%,
  100% {
    transform: translate(0, 0);
  }
  25% {
    transform: translate(80px, -20px);
  }
  50% {
    transform: translate(160px, 10px);
  }
  75% {
    transform: translate(75px, 35px);
  }
}

/* ---------- Revive animation (plays for 1.6s after watering) ---------- */

/* The droplet falls from above onto the plant and splashes away */
.falling-drop {
  position: absolute;
  top: -1.5rem;
  font-size: calc(1.3rem * var(--plant-scale, 1));
  animation: drop-fall 0.6s ease-in both;
}

@keyframes drop-fall {
  0% {
    transform: translateY(-60px);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  75% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(6px) scale(1.5);
    opacity: 0;
  }
}

/* The plant waits for the drop (0.5s delay), then pops up bigger and settles */
.plant.reviving .emoji {
  animation: pop 0.6s ease-out 0.5s both;
}

@keyframes pop {
  0% {
    transform: scale(0.3);
  }
  60% {
    transform: scale(1.35);
  }
  100% {
    transform: scale(1);
  }
}

/* Hint under the list: "Tap 🚿 next to a plant to water it and watch it revive" */
.revive-hint {
  margin: 0.6rem 0 0;
  padding: 0.45rem 0.7rem;
  border-radius: 8px;
  background: #e6f4ff;
  color: #1e4f73;
  font-size: 0.82rem;
  font-weight: 600;
}

/* "🚿 Water" button in the side list: a clear blue pill so it looks clickable */
.water-btn {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border: 1px solid #7fb8e6;
  border-radius: 999px;
  background: #e6f4ff;
  color: #1e4f73;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    background-color 0.15s ease;
}

.water-btn:hover:not(:disabled) {
  background: #cfe8ff;
  transform: translateY(-1px);
}

.water-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

/* Stop animations if the user turned on "reduce motion" */
@media (prefers-reduced-motion: reduce) {
  .plant .emoji,
  .bubble,
  .cloud-group,
  .flyer,
  .wings,
  .buzz,
  .sun,
  .drop,
  .plant.reviving .emoji {
    animation: none;
  }

  .falling-drop {
    display: none;
  }

  .tile {
    transition: none;
  }
}
</style>
