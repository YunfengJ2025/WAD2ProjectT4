<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Tooltip } from 'bootstrap'
import { RouterLink } from 'vue-router'

const props = defineProps({
    item: {
        type: Object,
        required: true,
    },
    layout: {
        type: String,
        default: 'stack', // 'stack' = big photo on top (calendar columns), 'row' = photo on the left (mobile list)
    }
})

const ICONS = {'skipped-rain': '🌧️', 'extra-heat': '☀️'}
const icon = computed(() => ICONS[props.item.adjustmentType] ?? null)
const isExtraHeat = computed(() => props.item.adjustmentType === 'extra-heat')

const STATUS_CLASS = {
    upcoming: 'text-bg-secondary',
    due: 'text-bg-warning',
    overdue: 'text-bg-danger',
    done: 'text-bg-success',
    skipped: 'text-bg-info',
}

const statusClass = computed(() => STATUS_CLASS[props.item.status] ?? 'text-bg-light')
const statusLabel = computed(() => (props.item.status === 'skipped' ? 'rain: may skip' : props.item.status))

const iconEl = ref(null)
let tip
onMounted(() => { if (iconEl.value) tip = new Tooltip(iconEl.value, {container: 'body'}) })
onBeforeUnmount(() => tip?.dispose())
</script>

<template>
  <RouterLink
    :to="item.link ?? { name: 'plant-detail', params: { plantId: item.plantId } }"
    class="plant-card h-100"
    :class="[`is-${statusLabel}`, `layout-${layout}`, { adjusted: item.adjustmentType, 'is-extra-heat': isExtraHeat }]"
  >
    <div class="photo-wrap">
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
          @click.prevent.stop 
      >{{ icon }}</span> <!-- tapping the icon to read the tooltip on a phone would also open the plant page. 
                              with @click.prevent.stop, the icon still shows its tooltip and the rest of the card navigates -->
    </div>

    <div class="plant-info">
        <strong class="plant-name">{{ item.plantName }}</strong>
        <span class="badge text-capitalize" :class="statusClass">{{ statusLabel }}</span>
    </div>
  </RouterLink>
</template>

<style scoped>
.plant-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;       /* stack layout: photo on top */
  gap: 0.5rem;
  padding: var(--space-sm);
  border-radius: var(--radius-lg);
  border-left: 4px solid transparent;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--shadow-md);
  transition: transform var(--transition-bounce), box-shadow var(--transition-base);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
.plant-card:focus-visible {
  outline: 2px solid #0d6efd;      /* keyboard users can see which card is focused */
  outline-offset: 2px;
}
.plant-card.layout-row {        /* row layout: photo on the left */
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
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
.is-skipped  { border-left-color: #0dcaf0; }

/* weather-adjusted cards get a soft amber outline */
.adjusted {
  outline: 2px solid rgba(255, 193, 7, 0.55);
  outline-offset: -2px;
}

/* ---------- photo ---------- */
.photo-wrap { position: relative; flex-shrink: 0; }
.plant-photo {
  display: block;
  border-radius: var(--radius-md);
  object-fit: cover;
}
.layout-stack .plant-photo { width: 100%; aspect-ratio: 1 / 1; }   /* fills the column */
.layout-row .plant-photo   { width: 72px; height: 72px; }
.plant-photo-fallback {
  display: grid;
  place-items: center;
  font-size: 2rem;
  background: rgba(25, 135, 84, 0.12);
}

/* weather icon sits on the photo corner, on a small white disc so it reads on any picture */
.adjust-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  font-size: 1rem;
  line-height: 1;
  cursor: help;
  z-index: 1;                   /* show above the shimmer overlay */
}
.adjust-icon:focus-visible {
  outline: 2px solid #0d6efd;
  outline-offset: 2px;
}

/* ---------- name and badge ---------- */
.plant-info {
  min-width: 0;
  max-width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
}
.plant-name { 
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
    line-height: 1.2;
    font-size: 0.95rem;
}

.plant-info .badge {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
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
