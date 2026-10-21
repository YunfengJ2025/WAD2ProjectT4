<script setup>
import NavBar from './components/nav/NavBar.vue'

const navigationitems = [
    { label: 'Dashboard', to: '/' },
    { label: 'Leaderboard', to: '/leaderboard' },
    { label: 'My Plants', to: '/my-plants' },
    { label: 'Find Nearby', to: '/find-nearby' },
    { label: 'Care Visits', to: '/care-visits' }
]
</script>

<template>
  <!-- Background gradient container defined in main.css -->
  <div class="page-bg"></div>

  <NavBar :navigationitems="navigationitems" />
  <br>

  <RouterView/>
</template>
 