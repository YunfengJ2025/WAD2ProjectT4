<script setup>
import {ref} from 'vue'

const pinSelected = ref(false)
const radiusKm = ref(1)
const selectedDate = ref('')
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
        <div class="map">

        
        </div>
        <!-- this will be the request section (dynamic, and changes)  -->
        <div class="requests">
            <!-- this will be the display if no pin is selected  -->
            <div v-if="pinSelected == false">

            </div>

            <!-- this will be the display if a pin is selected, it would be the care request  -->
            <div v-else>

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
    .pageContent{
        display: grid;
        grid-template-columns: 70% 30%;
        grid-template-areas: "map requests"
    }

    .map{
        grid-area: map;
        height: 70vh;
    }

    .requests {
        grid-area: requests;
        padding: 1rem;
        overflow-y: auto;
        max-height: 70vh;
    }


</style>