<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import plantPin from '@/assets/plant.png'
import homePin from '@/assets/home.png'

maplibregl.setWorkerUrl(maplibreWorkerUrl) // must run before any map is created

const props = defineProps({
  center: { type: Object, required: true },
  radiusKm: { type: Number, default: 1 },
  requests: { type: Array, default: () => [] },
  selected: { type: Object, default: null },
})
const emit = defineEmits(['select'])

const mapEl = ref(null)
let map = null
let ready = false // true once the style and layers have loaded
let plantMarkers = []
let homeMarker = null


const RADIUS_COLOR = '#2563eb' // blue, like your original; change to taste
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let displayRadius = 0 // the radius currently drawn; it eases towards props.radiusKm
let introDone = false // becomes true once the opening flight finishes
let rippleId = null // requestAnimationFrame handles, so we can cancel them
let tweenId = null

// MapLibre zoom is about 1 lower than Leaflet's for the same view
const NEIGHBOURHOOD = { zoom: 14, pitch: 45, bearing: 0 }
const STREET = { zoom: 16.5, pitch: 0, bearing: 0 }

const ATTRIBUTION =
  '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;"/> ' +
  '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> © contributors | ' +
  '<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a> | ' +
  'Boundaries: URA via data.gov.sg (Singapore Open Data Licence)'

// base style: a pale "sea" plus the OneMap tiles, which only appear once you zoom in
const mapStyle = {
  version: 8,
  sources: {
    onemap: {
      type: 'raster',
      tiles: ['https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'sea', type: 'background', paint: { 'background-color': '#e8f0f4' } },
    {
      id: 'onemap',
      type: 'raster',
      source: 'onemap',
      minzoom: 12, // don't download street tiles while viewing the whole island
      paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.5, 1] },
    },
  ],
}

// a circle on the ground, so it keeps its real size as you zoom
function circlePolygon(lat, lng, radiusKm, steps = 64) {
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }
}

// ease the circle to a new size
function animateRadius(toKm) {
  cancelAnimationFrame(tweenId)
  if (reduceMotion) {
    displayRadius = toKm
    map.getSource('radius').setData(circlePolygon(props.center.lat, props.center.lng, toKm))
    return
  }
  const from = displayRadius
  const start = performance.now()
  const DURATION = 600
  const step = (now) => {
    const t = Math.min((now - start) / DURATION, 1)
    const eased = 1 - Math.pow(1 - t, 3) // starts fast, settles gently
    displayRadius = from + (toKm - from) * eased
    map.getSource('radius').setData(circlePolygon(props.center.lat, props.center.lng, displayRadius))
    if (t < 1) tweenId = requestAnimationFrame(step)
  }
  tweenId = requestAnimationFrame(step)
}

// a ring that expands from home to the edge of the radius, then fades out and repeats
function startRipple() {
  if (reduceMotion || rippleId) return // skip if reduced motion, or already running
  const PERIOD = 2800 // ms per ping
  const tick = (now) => {
    const p = (now % PERIOD) / PERIOD // 0 to 1, repeating
    const grow = 1 - Math.pow(1 - p, 2) // ease-out: expands fast, then slows towards the edge
    const km = Math.max(displayRadius * grow, 0.001)
    const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3 // solid for 70% of the ping, then fades

    map.getSource('ripple').setData(circlePolygon(props.center.lat, props.center.lng, km))
    map.setPaintProperty('ripple-line', 'line-opacity', 0.9 * alpha)
    map.setPaintProperty('ripple-fill', 'fill-opacity', 0.22 * alpha)
    rippleId = requestAnimationFrame(tick)
  }
  rippleId = requestAnimationFrame(tick)
}
// the user's home
// builds the home marker from an image file
function makeHomeEl(sizePx = 40) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    width: `${sizePx}px`,
    height: `${sizePx}px`,
    backgroundImage: `url(${homePin})`,
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
  })
  return el
}

function drawMarkers() {
  if (!ready) return

  plantMarkers.forEach((m) => m.remove())
  plantMarkers = []

  const seen = {} // spread out pins that share a location
  props.requests.forEach((r) => {
    const key = `${r.lat},${r.lng}`
    const n = seen[key] ?? 0
    seen[key] = n + 1
    const offset = n * 0.00008 // roughly 9 m per step; only the drawn pin moves

    const el = document.createElement('button')
    el.setAttribute('aria-label', `Plant request at ${r.address}`)
    Object.assign(el.style, {
      width: '40px',
      height: '40px',
      border: 'none',
      padding: '0',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      backgroundImage: `url(${plantPin})`,
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
    })
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      emit('select', r)
    })

    plantMarkers.push(
      new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([r.lng + offset, r.lat + offset]) // MapLibre uses [lng, lat]
        .addTo(map)
    )
  })
}

onMounted(() => {
  map = new maplibregl.Map({
    container: mapEl.value,
    style: mapStyle,
    center: [103.8198, 1.3521], // start on the whole island
    zoom: 9.4,
    pitch: 55,
    bearing: -15,
    minZoom: 8.5,
    maxZoom: 18,
    attributionControl: false, // we add our own below, with OneMap's required credit
  })
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: ATTRIBUTION }))

  map.on('load', async () => {
    // 3D island: the planning areas extruded upwards, shrinking to flat as you zoom in
    try {
      const areas = await (await fetch('/sg-areas.json')).json()
      map.addSource('areas', { type: 'geojson', data: areas })
      map.addLayer({
        id: 'areas-3d',
        type: 'fill-extrusion',
        source: 'areas',
        maxzoom: 14,
        paint: {
          'fill-extrusion-color': '#dfe3e1',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 10, 1500, 12.5, 400, 13.5, 0],
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 14, 0],
        },
      })
    } catch (e) {
      console.error('Could not load the island outline', e)
    }

    // search radius
        // search radius: starts as a dot and grows once the camera has landed
    displayRadius = props.radiusKm
    map.addSource('radius', {
      type: 'geojson',
      data: circlePolygon(props.center.lat, props.center.lng, props.radiusKm),
    })
    map.addLayer({
      id: 'radius-fill',
      type: 'fill',
      source: 'radius',
      paint: { 'fill-color': RADIUS_COLOR, 'fill-opacity': 0.14 },
    })
    map.addLayer({
      id: 'radius-line',
      type: 'line',
      source: 'radius',
      paint: { 'line-color': RADIUS_COLOR, 'line-width': 2.5 },
    })

    // the ripple, drawn on top
    map.addSource('ripple', {
      type: 'geojson',
      data: circlePolygon(props.center.lat, props.center.lng, 0.001),
    })
    map.addLayer({
      id: 'ripple-fill',
      type: 'fill',
      source: 'ripple',
      paint: { 'fill-color': '#60a5fa', 'fill-opacity': 0 },
    })
    map.addLayer({
      id: 'ripple-line',
      type: 'line',
      source: 'ripple',
      paint: { 'line-color': '#60a5fa', 'line-width': 3, 'line-opacity': 0 },
    })

    
    homeMarker = new maplibregl.Marker({ element: makeHomeEl(40), anchor: 'bottom' })
      .setLngLat([props.center.lng, props.center.lat])
      .addTo(map)
    
    ready = true
    try {
      drawMarkers()
    } catch (e) {
      console.error('Could not draw the plant pins', e) // a bad request shouldn't stop the radius
    }

    startRipple() // no longer waits for the camera
    map.flyTo({ center: [props.center.lng, props.center.lat], ...NEIGHBOURHOOD, duration: 4000, essential: true })
  })
})

watch(() => [props.requests, props.radiusKm], drawMarkers)

watch(
  () => props.selected,
  (r) => {
    if (!ready) return
    if (r) {
      map.flyTo({ center: [r.lng, r.lat], ...STREET, duration: 2200, essential: true })
    } else {
      map.flyTo({ center: [props.center.lng, props.center.lat], ...NEIGHBOURHOOD, duration: 1800, essential: true })
    }
  }
)

watch(
  () => props.radiusKm,
  (km) => {
    if (ready) animateRadius(km)
  }
)

onBeforeUnmount(() => {
  cancelAnimationFrame(rippleId)
  cancelAnimationFrame(tweenId)
  map?.remove()
})
</script>

<template>
  <div ref="mapEl" class="map"></div>
</template>

<style scoped>
.map {
  height: 100%;
  min-height: 300px;
}
</style>


<!-- <script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import plantPin from '@/assets/plant.png' // Vite gives this a correct URL

const plantIcon = L.icon({
  iconUrl: plantPin,
  iconSize: [40, 40],    // width and height in pixels
  iconAnchor: [20, 40],  // bottom-centre touches the location
})

// props = data coming IN from the page
const props = defineProps({
  center: { type: Object, required: true },
  radiusKm: { type: Number, default: 1 },
  requests: { type: Array, default: () => [] },
  selected: { type: Object, default: null }, // the request chosen in the list or by clicking a pin
})

// emits = events going OUT to the page
const emit = defineEmits(['select'])

const mapEl = ref(null)
let map, markerLayer, radiusCircle

function drawMarkers() {
  markerLayer.clearLayers()
  radiusCircle.setRadius(props.radiusKm * 1000)

  const seen = {} // counts how many pins already sit at each location

  props.requests.forEach((r) => {
    const key = `${r.lat},${r.lng}`
    const n = seen[key] ?? 0 // 0 for the first pin here, 1 for the second, and so on
    seen[key] = n + 1
    const offset = n * 0.00008 // roughly 9 m per step; only the drawn pin moves, not the data

    L.marker([r.lat + offset, r.lng + offset], { icon: plantIcon })
      .addTo(markerLayer)
      .on('click', () => emit('select', r))
  })
}

onMounted(() => {
  map = L.map(mapEl.value).setView([props.center.lat, props.center.lng], 15)

  // OneMap basemap (replaces the OpenStreetMap tiles)
  L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
    minZoom: 11, // OneMap only covers Singapore, so don't let users zoom out to the world
    maxZoom: 19, // most zoomed-in level
    // OneMap's terms require the logo and attribution to stay visible
    attribution:
      '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;"/> ' +
      '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> © contributors | ' +
      '<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>',
  }).addTo(map)

  L.circleMarker([props.center.lat, props.center.lng], { radius: 8, color: 'blue' }).addTo(map)
  radiusCircle = L.circle([props.center.lat, props.center.lng], {
    radius: props.radiusKm * 1000,
  }).addTo(map)
  markerLayer = L.layerGroup().addTo(map)

  drawMarkers()
})

watch(() => [props.requests, props.radiusKm], drawMarkers)
// pan the map when a request is selected (from a card or a pin), and return home when deselected
watch(
  () => props.selected,
  (r) => {
    if (!map) return // map isn't created yet
    if (r) {
      map.flyTo([r.lat, r.lng], 17, { duration: 0.8 }) // zoom 17 is street level
    } else {
      map.flyTo([props.center.lat, props.center.lng], 15, { duration: 0.8 }) // back to the sitter's view
    }
  }
)

onBeforeUnmount(() => map.remove())
</script>

<template>
  <div ref="mapEl" class="map"></div>
</template>

<style scoped>
.map {
  height: 100%;
  min-height: 300px;
}
</style> -->