<script setup>
import {ref,computed} from 'vue'
import RequestMap from '../map/RequestMap.vue'
import db from '@/data/mockDb.json'
import plantPlaceholder from '@/assets/plant.png' // shown when a plant's photoUrl fails to load

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
      const firstPlant = db.plants.find((p) => p._id === request.plantIds[0]) // photo for the card
      return {
        _id: v._id,
        date: v.date,
        tokenReward: v.tokenReward,
        plantCount: request.plantIds.length,
        plantName: firstPlant?.name,
        photoUrl: firstPlant?.photoUrl,
        notes: request.notes,
        block: owner.block,
        address: `Blk ${owner.block}, Singapore ${owner.postalCode}`, // card title, block-level only
        lat: owner.location.lat,
        lng: owner.location.lng,
        // still no unitNumber, email or passwordHash
      }
    })
)

const filteredRequests = computed(() =>
  openVisits.value
    // attach each request's distance from the sitter
    .map((r) => ({
      ...r,
      distanceKm: haversine(myLocation.lat, myLocation.lng, r.lat, r.lng),
    }))
    // keep only those matching the date (if chosen) and inside the radius
    .filter((r) => (!selectedDate.value || r.date === selectedDate.value) && r.distanceKm <= radiusKm.value)
    // nearest first
    .sort((a, b) => a.distanceKm - b.distanceKm)
)

// 0.45 km shows as "450 m", 1.2 km as "1.2 km"
function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}


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
        
        <RequestMap 
            class="mapArea"
            :center="myLocation" 
            :radius-km="radiusKm" 
            :requests="filteredRequests"
            :selected="pinSelected"
            @select="pinSelected = $event">
        </RequestMap>
    
        

        <!-- class="mapArea": applies the grid-area and height from the CSS below -->
        <!-- :center  : the colon means "pass a JS value", not plain text; gives the map its starting point -->
        <!-- :radius-km : passes the slider value; the map's prop radiusKm becomes radius-km in templates -->
        <!-- :requests : passes the already filtered list so the map draws only those pins -->
        <!-- @select : listens for the map's 'select' event; $event is the request object the map sent -->


        <!-- this will be the request section (dynamic, and changes)  -->
        <div class="requests">
            <!-- no pin selected: scrollable list, nearest first -->
            <div v-if="!pinSelected">
                <p v-if="filteredRequests.length === 0">No requests within {{ radiusKm }} km. Try widening the distance
                    or changing the date.</p>

                <ul v-else class="requestList">
                    <li v-for="r in filteredRequests" :key="r._id" class="requestCard" @click="pinSelected = r">
                        <img :src="r.photoUrl" :alt="r.plantName" class="plantPhoto"
                            @error="$event.target.src = plantPlaceholder" />
                        <div class="cardText">
                            <h3>{{ r.address }}</h3>
                            <p>{{ formatDistance(r.distanceKm) }} away · {{ r.date }}</p>
                            <p>{{ r.plantCount }} plant(s) · {{ r.tokenReward }} tokens</p>
                        </div>
                    </li>
                </ul>
            </div>

            <!-- pin selected: details -->
            <div v-else>
                <button @click="pinSelected = null">← Back to list</button>
                <img :src="pinSelected.photoUrl" :alt="pinSelected.plantName" class="plantPhoto big"
                    @error="$event.target.src = plantPlaceholder" />
                <h2>{{ pinSelected.address }}</h2>
                <p><strong>Distance:</strong> {{ formatDistance(pinSelected.distanceKm) }}</p>
                <p><strong>Date:</strong> {{ pinSelected.date }}</p>
                <p><strong>Plants:</strong> {{ pinSelected.plantCount }}</p>
                <p><strong>Reward:</strong> {{ pinSelected.tokenReward }} tokens</p>
                <p><strong>Notes:</strong> {{ pinSelected.notes }}</p>
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
    .requestList {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .requestCard {
        display: flex;
        gap: 0.75rem;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        cursor: pointer;
    }

    .requestCard:hover {
        background: #f3f8f3;
    }

    .plantPhoto {
        width: 64px;
        height: 64px;
        object-fit: cover; /* crop to fill the square instead of squashing */
        border-radius: 6px;
        flex-shrink: 0;
    }

    .plantPhoto.big {
        width: 100%;
        height: 160px;
    }

    .cardText h3 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
    }

    .cardText p {
        margin: 0;
        font-size: 0.85rem;
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