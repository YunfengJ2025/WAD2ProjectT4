<script setup>
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="bg-light min-vh-100">
    <nav class="navbar navbar-expand-lg navbar-dark bg-success shadow-sm mb-4">
      <div class="container">
        <router-link to="/" class="navbar-brand fw-bold">🌱 Leaf It To Us</router-link>
        <div class="navbar-nav ms-auto d-flex flex-row gap-3">
          <router-link to="/" class="nav-link text-white fw-semibold">🌿 Owner View</router-link>
          <router-link to="/sitter" class="nav-link text-white fw-semibold">🏡 Sitter View</router-link>
        </div>
      </div>
    </nav>

    <router-view />
  </div>
</template>