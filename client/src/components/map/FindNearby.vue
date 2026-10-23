<script setup>
import {ref,computed} from 'vue'
import RequestMap from '../map/RequestMap.vue'
import db from '@/data/mockDb.json'

const myLocation = { lat: 1.3496, lng: 103.7195 } //to change to dynamic one later
const pinSelected = ref(null)
const radiusKm = ref(1)
const selectedDate = ref('')
// join visit + request + owner into the shape the map needs

const openVisits = computed(() =>
  db.careVisits
    .filter((v) => v.status === 'open' && v.helperId === null)
    .map((v) => {
      const request = db.careRequests.find((r) => r._id === v.requestId)
      const owner = db.users.find((u) => u._id === request.ownerId)
      return {
        _id: v._id,
        date: v.date,
        tokenReward: v.tokenReward,
        plantCount: request.plantIds.length,
        notes: request.notes,
        block: owner.block,
        lat: owner.location.lat,
        lng: owner.location.lng,
        // no unitNumber, email or passwordHash: the map must never see those
      }
    })
)

const filteredRequests = computed(() =>
  openVisits.value.filter((r) => {
    if (selectedDate.value && r.date !== selectedDate.value) return false
    return haversine(myLocation.lat, myLocation.lng, r.lat, r.lng) <= radiusKm.value
  })
)

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}


</script>

<template>
    <h1>Find nearby</h1>
    <p>Good day helper! Make someone's day by clicking on any plant on the map!</p>
    <!-- putting the scrollbar on top -->
    <div class="filterBar">
        <label>
            Distance: {{ radiusKm }} km
            <input type="range" min="0.1" max="1" step="0.1" v-model.number="radiusKm" />
        </label>
        <label>
            Date:
            <input type="date" v-model="selectedDate" />
        </label>
    </div>
    <div class="pageContent">
        <!-- this will be the map section, taking up about 70% of the page  -->
        <div>
            <RequestMap 
            class="mapArea"
            :center="myLocation" 
            :radius-km="radiusKm" 
            :requests="filteredRequests"
            @select="pinSelected = $event">
            </RequestMap>
        </div>

        <!-- class="mapArea": applies the grid-area and height from the CSS below -->
        <!-- :center  : the colon means "pass a JS value", not plain text; gives the map its starting point -->
        <!-- :radius-km : passes the slider value; the map's prop radiusKm becomes radius-km in templates -->
        <!-- :requests : passes the already filtered list so the map draws only those pins -->
        <!-- @select : listens for the map's 'select' event; $event is the request object the map sent -->


        <!-- this will be the request section (dynamic, and changes)  -->
        <div class="requests">
            <!-- this will be the display if no pin is selected  -->
            <div v-if="!pinSelected">
                <p>Select a pin to see the care request</p>
            </div>

            <!-- this will be the display if a pin is selected, it would be the care request. To make accurate to care request part later  -->
            <div v-else>
                <h2>Care request</h2>
                <p><strong>Where:</strong> Blk {{ pinSelected.block }}</p> <!-- block only, never the unit -->
                <p><strong>Date:</strong> {{ pinSelected.date }}</p>
                <p><strong>Plants:</strong> {{ pinSelected.plantCount }}</p>
                <p><strong>Reward:</strong> {{ pinSelected.tokenReward }} tokens</p>
                <p><strong>Notes:</strong> {{ pinSelected.notes }}</p>
                <button @click="pinSelected = null">Back</button> <!-- resets to null so the placeholder returns -->


            </div>

        </div>

    </div>
    
</template>

<style scoped>
    .filterBar {
        display: flex;
        gap: 1.5rem;
        margin: 1rem 0;
    }

    .pageContent {
        display: grid;
        grid-template-columns: 70% 30%;
        grid-template-areas: "map requests"
    }

    .mapArea {
        grid-area: map;
        height: 70vh;
    }

    .requests {
        grid-area: requests;
        padding: 1rem;
        overflow-y: auto;
        max-height: 70vh;
    }

    @media (max-width: 768px) {
        .pageContent {
            grid-template-columns: 1fr;
            grid-template-areas:
                "map"
                "requests";
        }

        .mapArea {
            height: 50vh;
        }
    }
</style>