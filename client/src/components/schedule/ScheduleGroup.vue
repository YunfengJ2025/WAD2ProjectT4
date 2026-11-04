<script setup>
import ScheduleDayCard from './ScheduleDayCard.vue'

defineProps({
    status: { type: String, required: true },   // 'overdue' | 'due' | 'skipped' | 'upcoming' | 'done'
    items: { type: Array, required: true },     // the items in this group
    open: { type: Boolean, default: false },
    layout: { type: String, default: 'stack' }, // passed to each card
})
const emit = defineEmits(['toggle'])

const MAX_THUMBS = 4 // more than this and the strip shows "+N"

const LABELS = {
    overdue: 'Overdue',
    due: 'Due',
    skipped: 'Rain: may skip',
    upcoming: 'Upcoming',
    done: 'Done',
}
</script>

<template>
  <div class="group" :class="`is-${status}`">
    <!-- the folded view: label, count and a row of round photos; click to open or close -->
    <button
      class="group-strip"
      type="button"
      :aria-expanded="open"
      :aria-label="`${LABELS[status] ?? status}, ${items.length} plant${items.length > 1 ? 's' : ''}. ${open ? 'Hide' : 'Show'} them`"
      @click="emit('toggle')"
    >
      <span class="group-head">
        <span class="chevron" :class="{ open }">▸</span>
        <span class="group-label">{{ LABELS[status] ?? status }} · {{ items.length }}</span>
      </span>

      <span v-if="!open" class="thumbs">
        <span v-for="item in items.slice(0, MAX_THUMBS)" :key="item.requestItemId" class="thumb" :title="item.plantName">
          <img v-if="item.photoUrl" :src="item.photoUrl" alt="" />
          <span v-else class="thumb-fallback">🪴</span>
          <span v-if="status === 'done'" class="tick">✓</span>
        </span>
        <span v-if="items.length > MAX_THUMBS" class="more">+{{ items.length - MAX_THUMBS }}</span>
      </span>
    </button>

    <!-- the full cards, only when open -->
    <TransitionGroup name="card" tag="div" appear class="card-list d-flex flex-column gap-2">
      <ScheduleDayCard
        v-for="item in (open ? items : [])"
        :key="item.requestItemId"
        :item="item"
        :layout="layout"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* each status has its own colour, the same as the strip on the left of its cards */
.group { --tone: #6c757d; --tone-bg: rgba(108, 117, 125, 0.1); margin-bottom: 0.5rem; }
.is-overdue  { --tone: #dc3545; --tone-bg: rgba(220, 53, 69, 0.1); }
.is-due      { --tone: #d19a00; --tone-bg: rgba(255, 193, 7, 0.16); }
.is-skipped  { --tone: #0aa2c0; --tone-bg: rgba(13, 202, 240, 0.12); }
.is-upcoming { --tone: #6c757d; --tone-bg: rgba(108, 117, 125, 0.1); }
.is-done     { --tone: #198754; --tone-bg: rgba(22, 163, 74, 0.1); }

.group-strip {
  display: flex;
  flex-wrap: wrap;                 /* in a narrow calendar column the photos drop under the label */
  align-items: center;
  gap: 0.35rem 0.5rem;
  width: 100%;
  margin-bottom: 0.4rem;
  padding: 0.35rem 0.6rem;
  border: 1px dashed var(--tone);
  border-radius: var(--radius-md);
  background: var(--tone-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.group-strip:hover { filter: brightness(0.97); }
.group-strip:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }

.group-head { display: inline-flex; align-items: center; font-size: 0.82rem; font-weight: 600; }
.group-label { color: var(--tone); }

.chevron { display: inline-block; margin-right: 0.3rem; transition: transform 0.2s ease; }
.chevron.open { transform: rotate(90deg); }

/* ---------- round photos ---------- */
.thumbs { display: flex; flex-wrap: wrap; gap: 0.3rem; min-width: 0; }
.thumb {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.thumb img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.thumb-fallback { font-size: 0.9rem; }
.tick {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #16a34a;
  color: #fff;
  font-size: 0.55rem;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  border: 1px solid #fff;
}
.more { align-self: center; font-size: 0.75rem; font-weight: 600; }

/* ---------- cards entering / leaving (TransitionGroup) ---------- */
.card-list { position: relative; } /* so a leaving card can be taken out of the flow */

.card-enter-active {
  /* --i is the day's position, set by the list or calendar, so days ripple in one after another */
  animation: cardIn 0.5s var(--transition-bounce) backwards;
  animation-delay: calc(var(--i) * 70ms);
}
.card-leave-active {
  position: absolute;     /* lets the remaining cards close the gap smoothly */
  width: 100%;
  animation: cardOut 0.25s ease forwards;
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(-14px) scale(0.95); }
  to   { opacity: 1; transform: none; }
}
@keyframes cardOut {
  to { opacity: 0; transform: translateY(10px) scale(0.95); }
}

@media (prefers-reduced-motion: reduce) {
  .card-enter-active, .card-leave-active { animation: none; }
  .chevron { transition: none; }
}
</style>