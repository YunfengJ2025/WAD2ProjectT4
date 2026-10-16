<script setup>
    defineProps({ items: { type: Array, default: () => [] } })
</script>

<template>
  <div>Calendar view ({{ items.length }} items)</div>
</template>