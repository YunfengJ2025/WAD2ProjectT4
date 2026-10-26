<script setup>
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
</style>