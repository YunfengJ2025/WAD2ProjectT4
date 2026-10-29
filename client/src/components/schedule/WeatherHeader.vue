<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'

gsap.registerPlugin(Draggable, InertiaPlugin)

const props = defineProps({
  condition: String,
  forecastText: String,
  stationName: String,
  loading: Boolean,
  error: String,
  forceCondition: String, // testing/demo override: 'rain' | 'cloudy' | 'sunny'
  forceNight: Boolean, // testing/demo override, because your demo will probably be in daytime
  forceHour: Number,      // testing/demo override: 0-23, e.g. 6 for dawn, 17 for golden hour
})

// colour of the sky
function singaporeHour() {
  if (props.forceHour != null) {
    return props.forceHour
  }

  return Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Singapore',
    }).format(new Date()),
  )
}

// remove props.forceCondition after testing
const theme = computed(() => props.forceCondition ?? props.condition ?? 'unknown')


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

// create class for the sky gradient, text colour, hill colour
const skyClass = computed(() => {
  if (theme.value === 'rain') return 'sky-rain'
  if (isNight.value) return 'sky-night'
  if (theme.value === 'cloudy') return 'sky-cloudy'
  if (theme.value === 'unknown') return 'sky-unknown'

  const hour = singaporeHour()
  if (hour < 8) return 'sky-dawn'
  if (hour >= 17) return 'sky-golden'
  return 'sky-day'
})

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

// four drifting clouds height in the sky, size, speed, and a negative delay so they spread out
const clouds = [
  { top: 8,  size: 5,   duration: 70, delay: -10 },
  { top: 30, size: 3.5, duration: 95, delay: -60 },
  { top: 18, size: 4.2, duration: 80, delay: -35 },
  { top: 48, size: 3,   duration: 110, delay: -80 },
]

// plants at the bottom that react to the weather
const plants = ['🌱', '🪴', '🌿', '🪴', '🌱', '🌿']
const isHot = computed(() => typeof props.tempHigh === 'number' && props.tempHigh >= 34 && theme.value !== 'rain')

// The clickable weather element
const toy = computed(() => {
  if (theme.value === 'rain') return { icon: '🌧️', label: 'Toggle heavier rain', play: 'wiggle' }
  if (theme.value === 'cloudy') return { icon: isNight.value ? '☁️' : '⛅', label: 'Poke the cloud', play: 'wiggle' }
  return showStars.value ? { icon: '🌙', label: 'Poke the moon', play: 'wiggle' } : { icon: '☀️', label: 'Spin the sun', play: 'spin' }
})
const isSun = computed(() => toy.value.icon === '☀️')

const playing = ref(false)
const headerEl = ref(null)  // the drag area (the toy cannot leave it)
const toyWrap = ref(null)   // GSAP owns this element's transform
const flashEl = ref(null)   // white overlay used for lightning
const farLayer = ref(null)   // parallax layers: GSAP moves these with the mouse
const hillLayer = ref(null)
const plantLayer = ref(null)

// people who ask their device for less motion get no throwing, springing or flashing
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false 

let draggable = null
let homeCall = null
let dragged = false // true right after a drag, so the release is not treated as a click

function goHome() {
  gsap.to(toyWrap.value, { x: 0, y: 0, duration: 1.4, ease: 'elastic.out(1, 0.45)' })
}

function makeDraggable(el) {
  return Draggable.create(el, {
    type: 'x,y',
    bounds: headerEl.value,
    inertia: !reduceMotion,      // keeps gliding after release
    edgeResistance: 0.8,         // soft push-back at the edges
    onPress() {
      homeCall?.kill()                    // cancel a pending return
      gsap.killTweensOf(el, 'x,y')        // stop a return that is in progress
    },
    onDragStart() { dragged = true },
    onRelease() {
      // click fires right after release, so clear the flag one tick later
      setTimeout(() => { dragged = false }, 0)
      if (!reduceMotion) homeCall = gsap.delayedCall(4, goHome) // spring back after 4s idle
    },
  })[0]
}

// the toy is hidden while loading or on error, so (re)attach whenever the element appears or disappears
watch(toyWrap, (el) => {
  draggable?.kill()
  draggable = el ? makeDraggable(el) : null
}, { flush: 'post' })

function flash() {
  if (reduceMotion || !flashEl.value) return
  gsap.timeline()
    .to(flashEl.value, { opacity: 0.85, duration: 0.05 })
    .to(flashEl.value, { opacity: 0, duration: 0.35 })
    .to(flashEl.value, { opacity: 0.55, duration: 0.05 }, '+=0.12')
    .to(flashEl.value, { opacity: 0, duration: 0.5 })
}

function play() {
  if (dragged) return // this click was the end of a drag, not a real click
  playing.value = true
  if (theme.value === 'rain') {
    heavyRain.value = !heavyRain.value
    if (heavyRain.value) flash()
  }
}

// temperature count up
const displayTemp = ref(null)
const tempState = { val: 0 }
let tempTween = null

watch(() => props.tempHigh, (value) => {
  if (typeof value !== 'number') { displayTemp.value = null; return }
  if (reduceMotion) { displayTemp.value = value; return }
  tempTween?.kill()
  tempTween = gsap.to(tempState, {
    val: value,
    duration: 1,
    ease: 'power2.out',
    onUpdate: () => { displayTemp.value = Math.round(tempState.val) },
  })
}, { immediate: true })

// parallax: the layers drift a little against the mouse
let movers = []

function onPointerMove(event) {
  if (!movers.length) return
  const box = headerEl.value.getBoundingClientRect()
  const nx = ((event.clientX - box.left) / box.width - 0.5) * 2   // -1 (left) to 1 (right)
  const ny = ((event.clientY - box.top) / box.height - 0.5) * 2   // -1 (top) to 1 (bottom)
  for (const mover of movers) {
    mover.x(-nx * mover.depth)        // opposite to the mouse
    mover.y(-ny * mover.depth * 0.5)  // less movement up and down
  }
}

function onPointerLeave() {
  for (const mover of movers) { mover.x(0); mover.y(0) }
}

// shrink to bar when scrolling page
const compact = ref(false)
const COMPACT_HEIGHT = 56   // must match .weather-header.compact min-height in the CSS

// prevent glitching
function onScroll() {
  const y = window.scrollY
  if (!compact.value) {
    // how far the page could still scroll after the header shrinks
    const shrinkBy = headerEl.value.offsetHeight - COMPACT_HEIGHT
    const roomAfter = document.documentElement.scrollHeight - window.innerHeight - shrinkBy

    // shrink only if we're well down the page and there is still room to scroll once smaller
    if (y > 80 && roomAfter > 40) compact.value = true
  } else if (y < 20) {
    // grow back only near the very top (a lower number than 80 on purpose)
    compact.value = false
  }
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  if (reduceMotion) return

  // quickTo makes a fast, smooth "move to this value" function. a bigger depth moves more, so it looks closer
  const make = (el, depth) => ({
    x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' }),
    y: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3' }),
    depth,
  })
  movers = [make(farLayer.value, 8), make(hillLayer.value, 16), make(plantLayer.value, 26)]
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  homeCall?.kill()
  tempTween?.kill()
  draggable?.kill()
  for (const el of [toyWrap.value, flashEl.value, farLayer.value, hillLayer.value, plantLayer.value]) {
    if (el) gsap.killTweensOf(el)
  }
})
</script>

<template>
  <div 
    ref="headerEl" 
    class="weather-header rounded mb-3 overflow-hidden" 
    :class="[skyClass, { compact }]"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave">

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

    <!-- layer: GSAP moves it with the mouse. inner clouds: CSS drifts them -->
    <div ref="farLayer" class="layer" aria-hidden="true">
      <span
        v-for="(c, i) in clouds"
        :key="i"
        class="cloud"
        :style="{
          top: c.top + '%',
          fontSize: c.size + 'rem',
          animationDuration: c.duration + 's',
          animationDelay: c.delay + 's',
        }"
      >☁️</span>
    </div>

    <div ref="hillLayer" class="layer" aria-hidden="true">
      <svg class="hills" viewBox="0 0 400 84" preserveAspectRatio="none">
        <path class="hill-back" d="M0 84 L0 40 Q50 18 110 36 T230 32 T340 38 T400 26 L400 84 Z" />
        <path class="hill-front" d="M0 84 L0 54 Q70 36 140 52 T280 50 T400 46 L400 84 Z" />
      </svg>
    </div>

    <div ref="plantLayer" class="layer" aria-hidden="true">
      <div class="plants-row" :class="{ perk: theme === 'rain', droop: isHot }">
        <span
          v-for="(p, i) in plants"
          :key="i"
          class="plant"
          :style="{ animationDelay: (i * -0.7) + 's' }"
        >{{ p }}</span>
      </div>
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

    <div ref="flashEl" class="flash" aria-hidden="true"></div>

    <div class="hero-content d-flex justify-content-between align-items-center">
      <div class="readout">
        <span v-if="loading">Checking weather…</span>
        <span v-else-if="error">Weather unavailable right now ({{ error }})</span>
        <template v-else>
          <div v-if="displayTemp !== null" class="temp">
            {{ displayTemp }}°<span class="temp-label">high today</span>
          </div>
          <strong class="forecast">{{ forecastText }}</strong>
          <span class="chip">near {{ stationName }}</span>
        </template>
      </div>

      <!-- outer span: GSAP drags this. inner button: CSS idle/click animations -->
      <span
        v-if="!loading && !error && theme !== 'unknown'"
        ref="toyWrap"
        class="toy-wrap"
        :class="{ sun: isSun }"
        title="Drag me!"
      >
        <button
          type="button"
          class="toy"
          :class="playing ? toy.play : showStars ? 'idle-night' : `idle-${theme}`"
          :aria-label="toy.label"
          :aria-pressed="theme === 'rain' ? heavyRain : undefined"
          @click="play"
          @animationend="playing = false"
        >{{ toy.icon }}</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
/*hero box sticky, shrinks when compact */
.weather-header {
  position: sticky;            /* stays at the top while the schedule scrolls under it */
  top: 0;
  z-index: 10;                 /* above the cards, below Bootstrap tooltips (1080) */
  min-height: 190px;
  padding: 1rem 1.25rem 2.6rem;
  color: #12324a;
  text-shadow: 0 1px 8px rgba(255, 255, 255, 0.55);
  transition: min-height 0.3s ease, padding 0.3s ease;
}
.weather-header.compact {
  min-height: 56px;
  padding: 0.5rem 1.25rem;
}

/* sky */
.sky-day    { background: linear-gradient(180deg, #5bb8f0, #c4ecff); }
.sky-dawn   { background: linear-gradient(180deg, #ff9f8a, #ffe3b8); }
.sky-golden { background: linear-gradient(180deg, #ff9a5a, #ffd68a); }
.sky-cloudy { background: linear-gradient(180deg, #9fb0c0, #dfe6ec); }
.sky-rain   { background: linear-gradient(180deg, #5f7a93, #a9bdcd); color: #10253a; }
.sky-unknown { background: #f8f9fa; }
.sky-night {
  background: linear-gradient(180deg, #0b1d3a, #2c3e6b);
  color: #f1f3f5;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

/* layers moved by gsap */
.layer {
  position: absolute;
  inset: -24px;
  pointer-events: none;
}

.cloud {
  position: absolute;
  left: 0;
  opacity: 0.55;
  animation: drift linear infinite;
}
.sky-cloudy .cloud, .sky-rain .cloud { opacity: 0.9; filter: grayscale(0.6); }
.sky-night .cloud { opacity: 0.25; filter: brightness(0.6); }
@keyframes drift {
  from { transform: translateX(-10vw); }
  to   { transform: translateX(110vw); }
}

.hills {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 84px;
  transition: opacity 0.3s ease;
}
.hill-back  { fill: rgba(34, 120, 70, 0.35); }
.hill-front { fill: rgba(22, 101, 52, 0.55); }
.sky-night .hill-back  { fill: rgba(5, 20, 30, 0.55); }
.sky-night .hill-front { fill: rgba(3, 14, 22, 0.8); }
.sky-rain .hill-back   { fill: rgba(30, 80, 60, 0.45); }
.sky-rain .hill-front  { fill: rgba(20, 70, 50, 0.65); }

.plants-row {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 26px;
  display: flex;
  justify-content: space-around;
  padding: 0 12%;
  transform-origin: 50% 100%;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.6s ease, opacity 0.3s ease;
}
.plants-row.perk  { transform: translateY(-4px) scale(1.2); }                 /* rain they perk up */
.plants-row.droop { transform: scale(0.88); filter: saturate(0.55) sepia(0.3); } /* heat they wilt a little */
.plant {
  font-size: 1.5rem;
  line-height: 1;
  transform-origin: 50% 100%;
  animation: sway 4s ease-in-out infinite;
}
@keyframes sway {
  0%, 100% { transform: rotate(-4deg); }
  50%      { transform: rotate(4deg); }
}

/* compact bar hides the scenery */
.compact .plants-row, .compact .hills { opacity: 0; }

/* stars rain and lightning */
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
@keyframes drop-fall { to { transform: translateY(300px); } }

.flash {
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  pointer-events: none;
  z-index: 1;
}

/* tet readout */
.hero-content { position: relative; z-index: 2; }
.readout { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; }
.temp {
  font-size: 3.2rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;   /* digits keep the same width while counting */
  transition: font-size 0.3s ease;
}
.temp-label { font-size: 0.9rem; font-weight: 500; margin-left: 0.4rem; opacity: 0.8; }
.forecast { font-size: 1.05rem; }
.chip {
  display: inline-block;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.4);
}
.sky-night .chip { background: rgba(255, 255, 255, 0.15); }
.compact .temp { font-size: 1.3rem; }
.compact .temp-label, .compact .chip { display: none; }

/* toy emoji */
.toy-wrap {
  display: inline-block;
  position: relative;
  z-index: 2;
  cursor: grab;
  touch-action: none;   /* lets a finger drag it without scrolling the page */
  user-select: none;
}
.toy-wrap:active { cursor: grabbing; }

/* soft glow behind the sun, it travels with the sun when dragged */
.toy-wrap.sun::before {
  content: '';
  position: absolute;
  inset: -35%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 235, 130, 0.8), rgba(255, 235, 130, 0) 65%);
  z-index: -1;
  pointer-events: none;
  animation: glow 4s ease-in-out infinite;
}
@keyframes glow { 50% { transform: scale(1.15); opacity: 0.8; } }

.toy {
  background: none;
  border: 0;
  font-size: 4.5rem;
  line-height: 1;
  padding: 0 0.25rem;
  cursor: inherit;
  transition: font-size 0.3s ease;
}
.compact .toy { font-size: 1.8rem; }
.toy:focus:not(:focus-visible) { outline: none; }
.toy:focus-visible { outline: 2px solid #0d6efd; outline-offset: 4px; border-radius: 8px; }

.idle-sunny { animation: spin 12s linear infinite; }
.idle-cloudy, .idle-rain, .idle-night { animation: float 3s ease-in-out infinite; }
.spin { animation: spin 0.8s ease-in-out 2; }
.wiggle { animation: wiggle 0.5s ease-in-out; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes float { 50% { transform: translateY(-6px); } }
@keyframes wiggle {
  25% { transform: rotate(-12deg) scale(1.1); }
  75% { transform: rotate(12deg) scale(1.1); }
}

/* adjustment for phone screen */
@media (max-width: 767.98px) {
  .weather-header { min-height: 150px; padding: 0.75rem 1rem 2.2rem; }
  .temp { font-size: 2.4rem; }
  .toy { font-size: 3.2rem; }
  .plant { font-size: 1.2rem; }
}

@media (prefers-reduced-motion: reduce) {
  .drop, .toy, .star, .cloud, .plant, .toy-wrap::before { animation: none !important; }
  .weather-header, .plants-row, .toy, .temp { transition: none; }
}
</style>