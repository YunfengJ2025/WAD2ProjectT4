<script setup>
import NavBar from './components/nav/NavBar.vue'

const navigationitems = [
    { label: 'Home', to: '/' },
    { label: 'My Plants', to: '/my-plants' },
    { label: 'Find Nearby', to:'/find-nearby'},
    { label: 'Care Visits', to: '/care-visits' }
]
</script>

<template>
  <NavBar :navigationitems="navigationitems" />
  <br>

  <RouterView/>
</template>
 