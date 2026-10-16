<script setup>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
  import { Tooltip } from 'bootstrap'

  const props = defineProps({
    item: {
        type: Object,
        required: true,
    }})

  const ICONS = {'skipped-rain': '🌧️', 'extra-heat': '☀️'}
  const icon = computed(() => ICONS[props.item.adjustmentType] ?? null)
  const isMoved = computed(() => props.item.originalDueAt !== props.item.dueAt)

  function formatDate(iso) {
    // standardising T00:00:00 keep it in local time so the day does not shift
    return new Date(iso + "T00:00:00").toLocaleDateString('en-SG', {
        weekday: 'short', 
        day: 'numeric',
        month: 'short',
    })
  }

  const iconEl = ref(null)
  let tip
  onMounted(() => { if (iconEl.value) tip = new Tooltip(iconEl.value) })
  onBeforeUnmount(() => tip?.dispose())
</script>

<template>
    <div class="card h-100" :class="{ 'border-warning': item.adjustmentType }">
        <div class="card-body p-2">
            <div class="d-flex justify-content-between align-items-start">
                <strong>{{ item.plantName }}</strong>
                <span
                v-if="icon"
                ref="iconEl"
                tabindex="0"
                data-bs-toggle="tooltip"
                :title="item.adjustmentReason"
                role="img"
                aria-label="Weather adjusted. Hover or tap for the reason"
                style="cursor: help"
                >{{ icon }}</span>
            </div>

            <div class="small">
                <span v-if="isMoved" class="text-muted text-decoration-line-through me-1">
                {{ formatDate(item.originalDueAt) }}
                </span>
                {{ formatDate(item.dueAt) }}
            </div>

        <!-- PLS ADD: a Bootstrap badge for item.status -->
        </div>
  </div>
</template>