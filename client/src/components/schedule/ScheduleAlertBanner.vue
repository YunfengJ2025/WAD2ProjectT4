<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ 
    items: { 
        type: Array, 
        default: () => [] 
    }
})

const dismissed = ref(false)
const changed = computed(() => props.items.filter(item => item.adjustmentType))
</script>

<template>
  <div
    v-if="changed.length && !dismissed"
    class="alert alert-warning alert-dismissible"
    role="alert"
  >
    <strong>Weather update:</strong>
    {{ changed.length }} watering{{ changed.length > 1 ? 's' : '' }} changed.
    <ul class="mb-0 mt-1">
      <li v-for="item in changed" :key="item.requestItemId">
        <strong>{{ item.plantName }}</strong>: {{ item.adjustmentReason }}
      </li>
    </ul>
    <button type="button" class="btn-close" aria-label="Dismiss" @click="dismissed = true"></button>
  </div>
</template>