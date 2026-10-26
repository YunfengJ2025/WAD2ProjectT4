<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  user: { type: Object, default: null },
  size: { type: Number, default: 40 },
})
const failed = ref(false)
watch(() => props.user?.photoUrl, () => { failed.value = false })
const initial = computed(() => (props.user?.userName?.trim()?.[0] || 'U').toUpperCase())
</script>

<template>
  <span class="user-avatar" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.38}px` }">
    <img v-if="user?.photoUrl && !failed" :src="user.photoUrl" :alt="`${user.userName}'s profile photo`" @error="failed = true" />
    <span v-else aria-hidden="true">{{ initial }}</span>
  </span>
</template>

<style scoped>
.user-avatar { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 50%; overflow: hidden; background: var(--accent-soft); color: var(--accent); font-weight: 600; vertical-align: middle; }
img { width: 100%; height: 100%; object-fit: cover; }
</style>
