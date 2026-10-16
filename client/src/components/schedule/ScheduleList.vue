<script setup>
    import ScheduleDayCard from './ScheduleDayCard.vue'
    const props = defineProps({ 
        items: { 
            type: Array, 
            default: () => [] 
        }})
</script>

<template>
  <div>List view ({{ items.length }} items)</div>

  <div class="d-flex flex-column gap-2">
    <ScheduleDayCard v-for="item in items" :key="item.requestItemId" :item="item" />
  </div>

</template>