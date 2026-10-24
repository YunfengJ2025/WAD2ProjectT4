<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Tooltip } from 'bootstrap'

const props = defineProps({
    item: {
        type: Object,
        required: true,
    }
})

const ICONS = {'skipped-rain': '🌧️', 'extra-heat': '☀️'}
const icon = computed(() => ICONS[props.item.adjustmentType] ?? null)
const isMoved = computed(() => props.item.originalDueAt !== props.item.dueAt)
const isExtraHeat = computed(() => props.item.adjustmentType === 'extra-heat')

const STATUS_CLASS = {
    upcoming: 'text-bg-secondary',
    due: 'text-bg-warning',
    overdue: 'text-bg-danger',
    done: 'text-bg-success',
}

const statusClass = computed(() => STATUS_CLASS[props.item.status] ?? 'text-bg-light')

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
onMounted(() => { if (iconEl.value) tip = new Tooltip(iconEl.value, {conatiner: 'body'}) })
onBeforeUnmount(() => tip?.dispose())
</script>

<template>
  <div
    class="plant-card h-100"
    :class="[`is-${item.status}`, { adjusted: item.adjustmentType, 'is-extra-heat': isExtraHeat }]"
  >
    <img
      v-if="item.photoUrl"
      :src="item.photoUrl"
      :alt="item.plantName"
      class="plant-photo"
    />
    <div v-else class="plant-photo plant-photo-fallback" aria-hidden="true">🪴</div>

    <span
        v-if="icon"
        ref="iconEl"
        tabindex="0"
        data-bs-toggle="tooltip"
        :title="item.adjustmentReason"
        role="img"
        aria-label="Weather adjusted. Hover or tap for the reason"
        class="adjust-icon"
    >{{ icon }}</span>

    <div class="plant-info">
        <strong class="plant-name d-block">{{ item.plantName }}</strong>
        
        <div v-if="item.plantLocation" class="small text-muted">{{ item.plantLocation }}</div>
        
        <!-- only shown when rain moved it, so the old date is useful rather than repeated noise -->
        <div v-if="isMoved" class="small text-muted">
            was <span class="text-decoration-line-through">{{ formatDate(item.originalDueAt) }}</span>
        </div>
        
        <span class="badge text-capitalize mt-1" :class="statusClass">{{ item.status }}</span>
    </div>
  </div>
</template>

<style scoped>
.plant-card {
  position: relative;
  overflow: hidden;
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: var(--space-sm);
  padding-right: 2rem;
  border-radius: var(--radius-lg);
  border-left: 4px solid transparent;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--shadow-md);
  transition: transform var(--transition-bounce), box-shadow var(--transition-base);
}
.plant-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: var(--shadow-lg);
}

/* status colour strip on the left edge */
.is-overdue  { border-left-color: #dc3545; }
.is-due      { border-left-color: #ffc107; }
.is-upcoming { border-left-color: #6c757d; }
.is-done { border-left-color: #198754; opacity: 0.8; }
.is-done .plant-photo { filter: grayscale(0.4); }

/* weather-adjusted cards get a soft amber outline */
.adjusted {
  outline: 2px solid rgba(255, 193, 7, 0.55);
  outline-offset: -2px;
}

.plant-photo {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  object-fit: cover;
}
.plant-photo-fallback {
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  background: rgba(25, 135, 84, 0.12);
}

.plant-info { min-width: 0; flex: 1; }
.plant-info .small { line-height: 1.3; }

.plant-name { 
    overflow-wrap: break-word;  /* only breaks a word if it cant fit */
    line-height: 1.2;
    font-size: 0.95rem;
}

.adjust-icon { 
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 1.1rem;
    line-height: 1;
    cursor: help;
    z-index: 1; /* show above shimmer overlay */
}
.adjust-icon:focus-visible {
  outline: 2px solid #0d6efd;
  outline-offset: 2px;
  border-radius: 4px;
}

/* sun-glint sweep across extra-heat cards, using the same  foilShimmer keyframe from main.css */
.is-extra-heat::after {
  content: '';
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.7) 50%, transparent 60%);
  animation: foilShimmer 5s ease-in-out infinite;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .plant-card { transition: none; }
  .plant-card:hover { transform: none; }
  .is-extra-heat::after { animation: none; }
}
</style>